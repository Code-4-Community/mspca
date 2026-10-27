import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { FosterVolunteer } from './volunteers.entity';
import { FosterType, VolunteerStatus } from './volunteers.types';
import { CreateVolunteerDto } from './dtos/create-volunteer.dto';
import { ConfirmVolunteerDto } from './dtos/confirm-volunteer.dto';
import { UpdateVolunteerDto } from './dtos/update-volunteer.dto';
import { UpdateAnimalPreferencesDto } from './dtos/update-animal-preferences.dto';
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

  /**
   * Fetches a Volunteer by ID, with their assigned Foster Coordinator.
   *
   * Returns the Volunteer so callers can reuse it instead of fetching again.
   *
   * @param id - The Volunteer's ID.
   * @returns The Volunteer.
   * @throws {NotFoundException} If no Volunteer with the ID exists.
   */
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
   * CognitoService handles both email confirmation and role assignment.
   * If role assignment fails, CognitoService handles Cognito user cleanup.
   *
   * @param dto - The Volunteer's email and the verification code Cognito emailed them.
   * @throws {NotFoundException} If no Volunteer or Cognito user with the email exists.
   * @throws {BadRequestException} If the code is wrong or has expired, or the user can't be confirmed or is already confirmed.
   * @throws {HttpException} 429 if there have been too many attempts.
   * @throws {InternalServerErrorException} If confirmation or adding the role fails.
   */
  async confirm(dto: ConfirmVolunteerDto): Promise<void> {
    const email = dto.email.toLowerCase();

    const volunteer = await this.repo.findOneBy({ email });
    if (!volunteer) {
      throw new NotFoundException('No volunteer with this email exists');
    }

    await this.cognitoService.confirmUser(
      email,
      dto.code,
      CognitoRole.FosterVolunteer,
    );
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

  /**
   * Reactivates a currently Inactive Volunteer.
   *
   * Does not apply to Pending Volunteers; those are moved to Active through
   * the approval flow instead.
   *
   * @param id - The Volunteer's ID.
   * @returns The updated Volunteer.
   * @throws {NotFoundException} If the Volunteer with the ID exists.
   * @throws {BadRequestException} If the Volunteer is not currently Inactive.
   */
  async reactivate(id: number): Promise<FosterVolunteer> {
    const volunteer = await this.findByIdOrFail(id);

    if (volunteer.status !== VolunteerStatus.INACTIVE) {
      throw new BadRequestException(`Volunteer with ID ${id} is not inactive`);
    }

    volunteer.status = VolunteerStatus.ACTIVE;

    return this.repo.save(volunteer);
  }

  /**
   * Fetches a Volunteer by ID, requiring that they are active.
   *
   * Returns the Volunteer so callers can reuse it instead of fetching again.
   *
   * @param id - The Volunteer's ID.
   * @returns The active Volunteer.
   * @throws {NotFoundException} If no Volunteer with the ID exists.
   * @throws {BadRequestException} If the Volunteer is not active.
   */
  async findActiveOrFail(id: number): Promise<FosterVolunteer> {
    const volunteer = await this.findByIdOrFail(id);

    this.checkVolunteerActive(volunteer);

    return volunteer;
  }

  /**
   * Ensures a Volunteer's account is active.
   *
   * @param volunteer - The Volunteer to check.
   * @throws {BadRequestException} If the Volunteer's status is not Active.
   */
  checkVolunteerActive(volunteer: FosterVolunteer): void {
    if (volunteer.status !== VolunteerStatus.ACTIVE) {
      throw new BadRequestException(
        `Volunteer with ID ${volunteer.volunteerId} is not active`,
      );
    }
  }

  /**
   * Updates a foster volunteer by ID.
   * Only the fields included in the DTO are changed; all other fields keep their current values.
   * @param id - ID of the volunteer to update
   * @param dto - The fields to update
   * @returns The updated volunteer
   * @throws NotFoundException if no volunteer exists with the given ID
   */
  async updateVolunteerById(
    id: number,
    dto: UpdateVolunteerDto,
  ): Promise<FosterVolunteer> {
    const volunteer = await this.findByIdOrFail(id);
    Object.assign(volunteer, dto);
    return this.repo.save(volunteer);
  }

  /**
   * Approves a pending Volunteer, setting their status to Active and emailing
   * them that they can now log in.
   *
   * If the email fails to send, the approval is kept and the failure is logged,
   * so the coordinator isn't left with an approved Volunteer they can't re-approve.
   *
   * @param id - The Volunteer's ID.
   * @returns The approved Volunteer.
   * @throws {NotFoundException} If no Volunteer with the ID exists.
   * @throws {ConflictException} If the Volunteer is not pending.
   */
  async approve(id: number): Promise<FosterVolunteer> {
    const volunteer = await this.findByIdOrFail(id);

    if (volunteer.status !== VolunteerStatus.PENDING) {
      throw new ConflictException(`Only pending Volunteers can be approved`);
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

  /**
   * Denies a pending Volunteer by permanently deleting them from both Cognito
   * and the database. No email is sent.
   *
   * Cognito is deleted first so that a Cognito failure leaves everything
   * untouched. If Cognito succeeds but the database delete fails, the
   * Volunteer is left in a partial state (no login, but a database row), so
   * a loud error with the Volunteer's ID is logged and thrown for manual cleanup.
   *
   * @param id - The Volunteer's ID.
   * @throws {NotFoundException} If no Volunteer with the ID exists.
   * @throws {ConflictException} If the Volunteer is not pending.
   * @throws {InternalServerErrorException} If the Cognito deletion fails, or
   *   if the database deletion fails after Cognito succeeded (partial deletion).
   */
  async deny(id: number): Promise<void> {
    const volunteer = await this.findByIdOrFail(id);

    if (volunteer.status !== VolunteerStatus.PENDING) {
      throw new ConflictException(`Only pending Volunteers can be denied`);
    }

    await this.cognitoService.deleteUser(volunteer.email);

    try {
      await this.repo.delete({ volunteerId: id });
    } catch (err) {
      const message = `Volunteer: { volunteerId: ${id}, email: ${volunteer.email} } was deleted from Cognito but not from database`;
      this.logger.error(
        message,
        err instanceof Error ? err.stack : String(err),
      );
      throw new InternalServerErrorException(message);
    }
  }

  /**
   * Gets all foster volunteers.
   * Returns every volunteer regardless of match status, or an empty array if there are none.
   * @returns A list of all volunteers
   */
  async getAllVolunteers(): Promise<FosterVolunteer[]> {
    return this.repo.find();
  }

  /**
   * Updates a Volunteer's animal preferences by adding and removing Chameleon animal IDs.
   *
   * Removals are applied first, then additions. Adding an ID that is already in the
   * list does not create a duplicate.
   *
   * @param id - The Volunteer's ID.
   * @param dto - The animal IDs to add and/or remove.
   * @returns The Volunteer's updated list of animal IDs.
   * @throws {NotFoundException} If no Volunteer with the ID exists.
   * @throws {BadRequestException} If the Volunteer is not active, animals are removed from
   * an empty list, an ID is in both the added and removed lists, or a removed ID is not in
   * the Volunteer's preferences.
   */
  async updateAnimalPreferences(
    id: number,
    dto: UpdateAnimalPreferencesDto,
  ): Promise<number[]> {
    // TODO: validate that all animals being added actually exist in our database
    const volunteer = await this.findActiveOrFail(id);
    const { added = [], removed = [] } = dto;
    const removedSet = new Set(removed);
    const preferences = new Set(volunteer.animalPreferences);

    if (removed.length > 0 && preferences.size === 0) {
      throw new BadRequestException(
        `Volunteer with ID ${id} has no animal preferences to remove`,
      );
    }

    const overlapping = added.filter((animalId) => removedSet.has(animalId));
    if (overlapping.length > 0) {
      throw new BadRequestException(
        `Animal IDs cannot be both added and removed: ${overlapping.join(
          ', ',
        )}`,
      );
    }

    const missing = removed.filter((animalId) => !preferences.has(animalId));
    if (missing.length > 0) {
      throw new BadRequestException(
        `Animal IDs not in the volunteer's preferences: ${missing.join(', ')}`,
      );
    }

    removed.forEach((animalId) => preferences.delete(animalId));
    added.forEach((animalId) => preferences.add(animalId));

    volunteer.animalPreferences = [...preferences];
    const saved = await this.repo.save(volunteer);
    return saved.animalPreferences;
  }

  /**
   * Gets every active Volunteer whose foster type is one of `fosterTypes`.
   *
   * An empty `fosterTypes` matches every active Volunteer. Pending and inactive
   * Volunteers are never returned.
   *
   * @param fosterTypes - The foster types to match, or an empty array for all.
   * @returns The matching active Volunteers, or an empty array if there are none.
   */
  async findActiveByFosterTypes(
    fosterTypes: FosterType[],
  ): Promise<FosterVolunteer[]> {
    // shortcut: fosterType is a single enum today, so In() is an exact match.
    // Once PR #11 makes the column an array this needs the && overlap operator.
    return this.repo.find({
      where: {
        status: VolunteerStatus.ACTIVE,
        ...(fosterTypes.length > 0 && { fosterType: In(fosterTypes) }),
      },
    });
  }
}
