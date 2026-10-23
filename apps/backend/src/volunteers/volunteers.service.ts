import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FosterVolunteer } from './volunteers.entity';
import { FosterType, VolunteerStatus } from './volunteers.types';
import { CreateVolunteerDto } from './dto/create-volunteer.dto';
import { ConfirmVolunteerDto } from './dto/confirm-volunteer.dto';
import { UpdateVolunteerDto } from './dto/update-volunteer.dto';
import { UpdateFosterTypePreferencesDto } from './dto/update-foster-type-preferences.dto';
import { CognitoService } from '../aws/cognito/cognito.service';
import { CognitoRole } from '../aws/cognito/cognito.types';
import { EmailsService } from '../aws/ses/email.service';
import { volunteerApprovedEmail } from '../emails/bodies/volunteerApproved';

@Injectable()
export class VolunteersService {
  private readonly logger = new Logger(VolunteersService.name);

  constructor(
    @InjectRepository(FosterVolunteer)
    private repo: Repository<FosterVolunteer>,
    private cognitoService: CognitoService,
    private emailsService: EmailsService,
  ) {}

  /** Fetches a Volunteer by ID, including their assigned Foster Coordinator. */
  async findByIdOrFail(id: number): Promise<FosterVolunteer> {
    const volunteer = await this.repo.findOne({
      where: { volunteerId: id },
      relations: ['assignedCoordinator'],
    });

    if (!volunteer) {
      throw new NotFoundException(`Volunteer with ID ${id} not found`);
    }

    return volunteer;
  }

  /**
   * Signs up a Volunteer account.
   *
   * The Cognito user is registered first; the Postgres row is only saved once
   * that succeeds, so a Cognito failure never leaves a Volunteer without a login.
   * If the save fails, the Cognito user is deleted so the email can be reused.
   * Cognito emails the Volunteer a verification code, which they pass to
   * {@link confirm}. New Volunteers are pending until a coordinator approves them.
   *
   * @param dto - The Volunteer's profile fields and chosen password.
   * @returns The saved Volunteer.
   * @throws {ConflictException} If a Volunteer or Cognito user with the email already exists.
   * @throws {BadRequestException} If Cognito rejects the password.
   * @throws {InternalServerErrorException} If the Cognito user could not be registered.
   * @throws {InternalServerErrorException} If the Volunteer could not be saved (the Cognito user is deleted).
   */
  async create(dto: CreateVolunteerDto): Promise<FosterVolunteer> {
    // The password only goes to Cognito; keep it out of the saved and returned Volunteer.
    const { password, ...profile } = dto;
    const email = profile.email.toLowerCase();

    const existing = await this.repo.findOneBy({ email });
    if (existing) {
      throw new ConflictException('A volunteer with this email already exists');
    }

    const cognitoSub = await this.cognitoService.signUpUser({
      firstName: profile.firstName,
      lastName: profile.lastName,
      email,
      password,
    });

    try {
      return await this.repo.save({
        ...profile,
        email,
        status: VolunteerStatus.PENDING,
        mostRecentWaiverSigned: true,
        cognitoSub,
      });
    } catch (error) {
      this.logger.error(`Failed to save Volunteer ${email}`, error);
      try {
        await this.cognitoService.deleteUser(email);
      } catch {
        this.logger.error(
          `Created Cognito user ${cognitoSub} for ${email} but failed to save the Volunteer or delete the Cognito user`,
        );
      }
      throw new InternalServerErrorException('Failed to save the Volunteer');
    }
  }

  /**
   * Confirms a signed-up Volunteer's email and gives them the FosterVolunteer role.
   *
   * Only emails with a Volunteer row can be confirmed. The app client is public,
   * so this stops someone who signed up directly with Cognito (skipping
   * {@link create}) from getting the role without a Volunteer profile.
   *
   * If the role can't be added, both the Cognito user and the Volunteer are
   * deleted so the Volunteer can sign up again with the same email.
   *
   * @param dto - The Volunteer's email and the verification code Cognito emailed them.
   * @throws {NotFoundException} If no Volunteer or Cognito user with the email exists.
   * @throws {BadRequestException} If the code is wrong or has expired, or the user can't be confirmed or is already confirmed.
   * @throws {HttpException} 429 if there have been too many attempts.
   * @throws {InternalServerErrorException} If confirmation fails.
   * @throws {InternalServerErrorException} If adding the role fails (the Cognito user and Volunteer are deleted).
   */
  async confirm(dto: ConfirmVolunteerDto): Promise<void> {
    const email = dto.email.toLowerCase();

    const volunteer = await this.repo.findOneBy({ email });
    if (!volunteer) {
      throw new NotFoundException('No volunteer with this email exists');
    }

    await this.cognitoService.confirmUser(email, dto.code);

    try {
      await this.cognitoService.addUserToGroup(
        email,
        CognitoRole.FosterVolunteer,
      );
    } catch {
      // addUserToGroup already logs the Cognito error.
      try {
        await this.cognitoService.deleteUser(email);
      } catch {
        this.logger.error(
          `Failed to delete Cognito user ${email} after adding the role failed`,
        );
      }
      try {
        await this.repo.delete({ volunteerId: volunteer.volunteerId });
      } catch (error) {
        this.logger.error(
          `Failed to delete Volunteer ${volunteer.volunteerId} after adding the role failed`,
          error,
        );
      }
      throw new InternalServerErrorException('Failed to confirm the Volunteer');
    }
  }

  /**
   * Deactivates a currently Active Volunteer.
   *
   * @param id - The Volunteer's ID.
   * @returns The updated Volunteer.
   * @throws {NotFoundException} If no Volunteer with the ID exists.
   * @throws {BadRequestException} If the Volunteer is not currently Active.
   */
  async deactivate(id: number): Promise<FosterVolunteer> {
    const volunteer = await this.findByIdOrFail(id);

    if (volunteer.status !== VolunteerStatus.ACTIVE) {
      throw new BadRequestException(`Volunteer with ID ${id} is not active`);
    }

    volunteer.status = VolunteerStatus.INACTIVE;
    return this.repo.save(volunteer);
  }

  /** Reactivates a currently inactive Volunteer. */
  async reactivate(id: number): Promise<FosterVolunteer> {
    const volunteer = await this.findByIdOrFail(id);

    if (volunteer.status !== VolunteerStatus.INACTIVE) {
      throw new BadRequestException(`Volunteer with ID ${id} is not inactive`);
    }

    volunteer.status = VolunteerStatus.ACTIVE;
    return this.repo.save(volunteer);
  }

  /** Fetches a Volunteer by ID and requires an active account. */
  async findActiveOrFail(id: number): Promise<FosterVolunteer> {
    const volunteer = await this.findByIdOrFail(id);
    this.checkVolunteerActive(volunteer);
    return volunteer;
  }

  /** Ensures a Volunteer's account is active. */
  checkVolunteerActive(volunteer: FosterVolunteer): void {
    if (volunteer.status !== VolunteerStatus.ACTIVE) {
      throw new BadRequestException(
        `Volunteer with ID ${volunteer.volunteerId} is not active`,
      );
    }
  }

  /** Updates the supplied fields on a Volunteer. */
  async updateVolunteerById(
    id: number,
    dto: UpdateVolunteerDto,
  ): Promise<FosterVolunteer> {
    const volunteer = await this.findByIdOrFail(id);
    Object.assign(volunteer, dto);
    return this.repo.save(volunteer);
  }

  /**
   * Updates an active Volunteer's foster type preferences.
   * Validates all changes before mutating the Volunteer or saving.
   * Removals are applied before additions.
   *
   * @throws {NotFoundException} If the Volunteer does not exist.
   * @throws {BadRequestException} If the Volunteer is inactive or the update is invalid.
   */
  async updateFosterTypePreferences(
    id: number,
    dto: UpdateFosterTypePreferencesDto,
  ): Promise<FosterType[]> {
    const volunteer = await this.findActiveOrFail(id);
    const added = dto.added ?? [];
    const removed = dto.removed ?? [];
    const currentPreferences = volunteer.fosterTypePreferences ?? [];

    if (!added.length && !removed.length) {
      throw new BadRequestException(
        'At least one of added or removed must be provided',
      );
    }

    const overlapping = [...new Set(added)].filter((type) =>
      removed.includes(type),
    );

    if (overlapping.length > 0) {
      throw new BadRequestException(
        `Foster types cannot be both added and removed: ${overlapping.join(
          ', ',
        )}`,
      );
    }

    if (removed.length > 0 && currentPreferences.length === 0) {
      throw new BadRequestException(
        `Volunteer with ID ${id} has no foster type preferences to remove`,
      );
    }

    const invalidRemovals = [...new Set(removed)].filter(
      (type) => !currentPreferences.includes(type),
    );

    if (invalidRemovals.length > 0) {
      throw new BadRequestException(
        `Foster types not in the volunteer's preferences: ${invalidRemovals.join(
          ', ',
        )}`,
      );
    }

    const existingAdditions = [...new Set(added)].filter((type) =>
      currentPreferences.includes(type),
    );

    if (existingAdditions.length > 0) {
      throw new BadRequestException(
        `Foster type preferences already exist: ${existingAdditions.join(
          ', ',
        )}`,
      );
    }

    if (new Set(added).size !== added.length) {
      throw new BadRequestException(
        'Duplicate foster types cannot be added in the same request',
      );
    }

    const preferences = currentPreferences.filter(
      (type) => !removed.includes(type),
    );

    preferences.push(...added);

    volunteer.fosterTypePreferences = preferences;
    const saved = await this.repo.save(volunteer);
    return saved.fosterTypePreferences;
  }

  /** Approves a pending Volunteer and attempts to send an approval email. */
  async approve(id: number): Promise<FosterVolunteer> {
    const volunteer = await this.findByIdOrFail(id);

    if (volunteer.status !== VolunteerStatus.PENDING) {
      throw new ConflictException('Only pending Volunteers can be approved');
    }

    volunteer.status = VolunteerStatus.ACTIVE;
    const saved = await this.repo.save(volunteer);

    try {
      await this.emailsService.sendEmail({
        toEmail: saved.email,
        ...volunteerApprovedEmail(saved.firstName),
      });
    } catch (err) {
      this.logger.error(
        `Volunteer with ID ${id} was approved but the approval email didn't send`,
        err instanceof Error ? err.stack : String(err),
      );
    }

    return saved;
  }

  /** Gets all foster volunteers. */
  async getAllVolunteers(): Promise<FosterVolunteer[]> {
    return this.repo.find();
  }
}
