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
import { VolunteerStatus } from './volunteers.types';
import { CreateVolunteerDto } from './dtos/create-volunteer.dto';
import { ConfirmVolunteerDto } from './dtos/confirm-volunteer.dto';
import { UpdateVolunteerDto } from './dtos/update-volunteer.dto';
import { UpdateAnimalPreferencesDto } from './dtos/update-animal-preferences.dto';
import { CognitoService } from '../aws/cognito/cognito.service';
import { CognitoRole } from '../aws/cognito/cognito.types';
import { EmailsService } from '../aws/ses/email.service';
import {
  EmailContent,
  volunteerApprovedEmail,
} from '../emails/bodies/volunteerApproved';
import { coordinatorGainedVolunteerEmail } from '../emails/bodies/coordinatorGainedVolunteer';
import { coordinatorLostVolunteerEmail } from '../emails/bodies/coordinatorLostVolunteer';
import { CoordinatorsService } from '../coordinators/coordinators.service';
import { FosterCoordinator } from '../coordinators/coordinators.entity';
import { Homebase } from '../types';

@Injectable()
export class VolunteersService {
  private readonly logger = new Logger(VolunteersService.name);

  constructor(
    @InjectRepository(FosterVolunteer)
    private repo: Repository<FosterVolunteer>,
    private cognitoService: CognitoService,
    private emailsService: EmailsService,
    private coordinatorsService: CoordinatorsService,
  ) {}

  /**
   * Fetches a Volunteer by ID, with their assigned Foster Coordinators.
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
      relations: ['assignedCoordinators'],
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
   * Assigns every active coordinator at the Volunteer's homebase.
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

    // Looked up before Cognito so a failure here leaves nothing to roll back.
    const assignedCoordinators =
      await this.coordinatorsService.findActiveByHomebase(profile.homebase);

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
        assignedCoordinators,
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

  /**
   * Reactivates a currently Inactive Volunteer.
   *
   * Does not apply to Pending Volunteers; those are moved to Active through
   * the approval flow instead.
   *
   * @param id - The Volunteer's ID.
   * @returns The updated Volunteer.
   * @throws {NotFoundException} If no Volunteer with the ID exists.
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
   * Moves a Volunteer to a different homebase and reassigns their coordinators.
   *
   * Saves the new homebase and coordinators first, then emails the old
   * coordinators and the new ones. Emails are best-effort: a failed send is
   * logged rather than failing the request, since the reassignment is already
   * committed.
   *
   * @param id - The Volunteer's ID.
   * @param homebase - The new homebase.
   * @returns The updated Volunteer, with their new homebase and assigned coordinators.
   * @throws {NotFoundException} If no Volunteer with the ID exists.
   * @throws {BadRequestException} If the Volunteer is inactive, or is already
   * at the homebase.
   */
  async changeHomebase(
    id: number,
    homebase: Homebase,
  ): Promise<FosterVolunteer> {
    const volunteer = await this.findByIdOrFail(id);

    // Pending Volunteers can still fix the homebase they picked at sign-up.
    if (volunteer.status === VolunteerStatus.INACTIVE) {
      throw new BadRequestException(`Volunteer with ID ${id} is inactive`);
    }

    if (volunteer.homebase === homebase) {
      throw new BadRequestException(
        `Volunteer with ID ${id} is already assigned to the ${homebase} homebase`,
      );
    }

    const previous = volunteer.assignedCoordinators.filter((c) => c.active);
    const next = await this.coordinatorsService.findActiveByHomebase(homebase);

    volunteer.homebase = homebase;
    volunteer.assignedCoordinators = next;
    const saved = await this.repo.save(volunteer);

    // A coordinator has one homebase, so the old and new lists never overlap.
    await Promise.all([
      this.notifyCoordinators(
        previous,
        coordinatorLostVolunteerEmail(saved, homebase),
        saved.volunteerId,
      ),
      this.notifyCoordinators(
        next,
        coordinatorGainedVolunteerEmail(saved),
        saved.volunteerId,
      ),
    ]);

    return saved;
  }

  /**
   * Sends one email to the sender address with the coordinators cc'd.
   * Logs a warning and sends nothing when there are no coordinators, and logs
   * a failed send instead of throwing.
   *
   * @param coordinators - The coordinators to cc.
   * @param email - The email's subject and body.
   * @param volunteerId - The Volunteer the email is about, for log messages.
   */
  private async notifyCoordinators(
    coordinators: FosterCoordinator[],
    email: EmailContent,
    volunteerId: number,
  ): Promise<void> {
    if (coordinators.length === 0) {
      this.logger.warn(
        `No coordinators to send "${email.subject}" email to for volunteer ${volunteerId}.`,
      );
      return;
    }

    try {
      await this.emailsService.sendEmail({
        toEmail: process.env.AWS_SES_SENDER_EMAIL ?? '',
        ccEmails: coordinators.map((c) => c.email),
        ...email,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send "${email.subject}" email for volunteer ${volunteerId}.`,
        error instanceof Error ? error.stack : String(error),
      );
    }
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
   * The homebase is changed through changeHomebase instead.
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
   * Gets all foster volunteers.
   * Returns every volunteer regardless of match status, or an empty array if there are none.
   * @returns A list of all volunteers
   */
  async getAllVolunteers(): Promise<FosterVolunteer[]> {
    return this.repo.find({ relations: ['assignedCoordinators'] });
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
}
