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
import { VolunteerWithoutPrivateFields } from './dtos/volunteer-without-private-fields.dto';
import { CreateVolunteerDto } from './dtos/create-volunteer.dto';
import { ConfirmVolunteerDto } from './dtos/confirm-volunteer.dto';
import { UpdateVolunteerDto } from './dtos/update-volunteer.dto';
import { CoordinatorUpdateVolunteerDto } from './dtos/coordinator-update-volunteer.dto';
import { UpdateAnimalPreferencesDto } from './dtos/update-animal-preferences.dto';
import { CognitoService } from '../aws/cognito/cognito.service';
import { CognitoRole } from '../aws/cognito/cognito.types';
import { EmailsService } from '../aws/ses/email.service';
import { volunteerApprovedEmail } from './emails/volunteerApproved';
import { EmailContent } from '../utils/emails.utils';
import { coordinatorGainedVolunteerEmail } from '../coordinators/emails/coordinatorGainedVolunteer';
import { coordinatorLostVolunteerEmail } from '../coordinators/emails/coordinatorLostVolunteer';
import { CoordinatorsService } from '../coordinators/coordinators.service';
import { FosterCoordinator } from '../coordinators/coordinators.entity';
import { Homebase } from '../types';
import { AnimalsService } from '../animals/animals.service';

@Injectable()
export class VolunteersService {
  private readonly logger = new Logger(VolunteersService.name);

  constructor(
    @InjectRepository(FosterVolunteer)
    private repo: Repository<FosterVolunteer>,
    private cognitoService: CognitoService,
    private emailsService: EmailsService,
    private coordinatorsService: CoordinatorsService,
    private animalsService: AnimalsService,
  ) {}

  /**
   * Removes fields only coordinators may see, so the Volunteer is safe to
   * return from a standard endpoint.
   *
   * @param volunteer - The full Volunteer.
   * @returns The same Volunteer without coordinator-only fields.
   */
  private withoutPrivateFields(
    volunteer: FosterVolunteer,
  ): VolunteerWithoutPrivateFields {
    delete volunteer.coordinatorNotes;
    return volunteer;
  }

  /**
   * Fetches a full Volunteer by ID, including coordinator-only fields such as
   * coordinatorNotes. Only use this for coordinator-facing operations;
   * everything else should use {@link findByIdOrFail}.
   *
   * @param id - The Volunteer's ID.
   * @returns The full Volunteer, notes included.
   * @throws {NotFoundException} If no Volunteer with the ID exists.
   */
  async coordinatorFindByIdOrFail(id: number): Promise<FosterVolunteer> {
    const volunteer = await this.repo.findOne({
      where: { volunteerId: id },
      relations: ['assignedCoordinators', 'pets'],
    });

    if (!volunteer) {
      throw new NotFoundException(`Volunteer with ID ${id} not found`);
    }

    return volunteer;
  }

  /**
   * Fetches a Volunteer by ID, with their assigned Foster Coordinator.
   *
   * Returns the Volunteer so callers can reuse it instead of fetching again.
   * Pets are only loaded when asked for, since most callers don't need them.
   *
   * @param id - The Volunteer's ID.
   * @param options.withPets - Also load the Volunteer's pets.
   * @returns The Volunteer.
   * @throws {NotFoundException} If no Volunteer with the ID exists.
   */
  async findByIdOrFail(
    id: number,
    { withPets = false }: { withPets?: boolean } = {},
  ): Promise<VolunteerWithoutPrivateFields> {
    const volunteer = await this.repo.findOne({
      where: { volunteerId: id },
      relations: withPets
        ? ['assignedCoordinators', 'pets']
        : ['assignedCoordinators'],
    });

    if (!volunteer) {
      throw new NotFoundException(`Volunteer with ID ${id} not found`);
    }

    return this.withoutPrivateFields(volunteer);
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
   * @throws {BadRequestException} If childrenAges doesn't match hasChildren (checked before Cognito is called).
   * @throws {ConflictException} If a Volunteer or Cognito user with the email already exists.
   * @throws {BadRequestException} If Cognito rejects the password.
   * @throws {InternalServerErrorException} If the Cognito user could not be registered.
   * @throws {InternalServerErrorException} If the Volunteer could not be saved (the Cognito user is deleted).
   */
  async create(
    dto: CreateVolunteerDto,
  ): Promise<VolunteerWithoutPrivateFields> {
    // The password only goes to Cognito; keep it out of the saved and returned Volunteer.
    const { password, ...profile } = dto;
    const email = profile.email.toLowerCase();
    const childrenAges = profile.childrenAges ?? [];
    const pets = profile.pets ?? [];

    this.checkChildrenConsistent(profile.hasChildren, childrenAges);

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

    // Inside the try so a failed lookup also deletes the Cognito user.
    try {
      const assignedCoordinators =
        await this.coordinatorsService.findActiveByHomebase(profile.homebase);
      const saved = await this.repo.save({
        ...profile,
        email,
        childrenAges,
        pets,
        status: VolunteerStatus.PENDING,
        mostRecentWaiverSigned: true,
        cognitoSub,
        assignedCoordinators,
      });
      return this.withoutPrivateFields(saved);
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
  async deactivate(id: number): Promise<VolunteerWithoutPrivateFields> {
    const volunteer = await this.findByIdOrFail(id);

    if (volunteer.status !== VolunteerStatus.ACTIVE) {
      throw new BadRequestException(`Volunteer with ID ${id} is not active`);
    }

    volunteer.status = VolunteerStatus.INACTIVE;

    return this.withoutPrivateFields(await this.repo.save(volunteer));
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
  async reactivate(id: number): Promise<VolunteerWithoutPrivateFields> {
    const volunteer = await this.findByIdOrFail(id);

    if (volunteer.status !== VolunteerStatus.INACTIVE) {
      throw new BadRequestException(`Volunteer with ID ${id} is not inactive`);
    }

    volunteer.status = VolunteerStatus.ACTIVE;

    return this.withoutPrivateFields(await this.repo.save(volunteer));
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
  ): Promise<VolunteerWithoutPrivateFields> {
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

    const previousHomebase = volunteer.homebase;
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
        saved,
      ),
      this.notifyCoordinators(
        next,
        coordinatorGainedVolunteerEmail(saved, previousHomebase),
        saved,
      ),
    ]);

    return this.withoutPrivateFields(saved);
  }

  /**
   * Sends one email to the sender address with the coordinators cc'd.
   * Logs a warning and sends nothing when there are no coordinators, and logs
   * a failed send instead of throwing.
   *
   * @param coordinators - The coordinators to cc.
   * @param email - The email's subject and body.
   * @param volunteer - The Volunteer the email is about, for log messages.
   */
  private async notifyCoordinators(
    coordinators: FosterCoordinator[],
    email: EmailContent,
    volunteer: FosterVolunteer,
  ): Promise<void> {
    const volunteerLabel = `volunteer ${volunteer.volunteerId} (${volunteer.firstName} ${volunteer.lastName})`;

    if (coordinators.length === 0) {
      this.logger.warn(
        `No coordinators to send "${email.subject}" email to for ${volunteerLabel}.`,
      );
      return;
    }

    try {
      await this.emailsService.sendEmail({
        // AWSSESModule throws at startup when SES is enabled and this is unset,
        // so the fallback is only here to satisfy TypeScript.
        toEmail: process.env.AWS_SES_SENDER_EMAIL ?? '',
        ccEmails: coordinators.map((c) => c.email),
        ...email,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send "${email.subject}" email for ${volunteerLabel}.`,
        error,
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
  async findActiveOrFail(id: number): Promise<VolunteerWithoutPrivateFields> {
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
  checkVolunteerActive(volunteer: VolunteerWithoutPrivateFields): void {
    if (volunteer.status !== VolunteerStatus.ACTIVE) {
      throw new BadRequestException(
        `Volunteer with ID ${volunteer.volunteerId} is not active`,
      );
    }
  }

  /**
   * Updates a foster volunteer by ID.
   * Only the fields included in the DTO are changed; all other fields keep their current values.
   * Pets, when included, replace the whole list; pets left out are deleted.
   * Setting hasChildren to false without sending childrenAges clears the saved ages.
   * The homebase is changed through changeHomebase instead, since changing it
   * also reassigns coordinators and emails them.
   * @param id - ID of the volunteer to update
   * @param dto - The fields to update
   * @returns The updated volunteer
   * @throws NotFoundException if no volunteer exists with the given ID
   * @throws {BadRequestException} If the saved and updated fields together
   * leave childrenAges not matching hasChildren.
   */
  async updateVolunteerById(
    id: number,
    dto: UpdateVolunteerDto,
  ): Promise<VolunteerWithoutPrivateFields> {
    const volunteer = await this.findByIdOrFail(id, { withPets: true });
    this.applyProfileUpdate(volunteer, dto);
    return this.withoutPrivateFields(await this.repo.save(volunteer));
  }

  /**
   * Updates a Volunteer's profile as a coordinator. Accepts every field a
   * Volunteer can edit themselves, plus coordinator-only fields
   * (coordinator notes and completed trainings).
   * Only the fields included in the DTO are changed; completed trainings
   * and pets are replaced as whole lists. Setting hasChildren to false
   * without sending childrenAges clears the saved ages.
   *
   * @param id - The Volunteer's ID.
   * @param dto - The fields to update.
   * @returns The updated Volunteer, including private fields.
   * @throws {NotFoundException} If no Volunteer with the ID exists.
   * @throws {BadRequestException} If the saved and updated fields together
   * leave childrenAges not matching hasChildren.
   */
  async coordinatorUpdateVolunteerById(
    id: number,
    dto: CoordinatorUpdateVolunteerDto,
  ): Promise<FosterVolunteer> {
    const volunteer = await this.coordinatorFindByIdOrFail(id);
    this.applyProfileUpdate(volunteer, dto);
    return this.repo.save(volunteer);
  }

  /**
   * Copies an update onto a loaded Volunteer, after checking that the saved
   * and updated fields together still satisfy the children rule.
   *
   * @throws {BadRequestException} If childrenAges doesn't match hasChildren.
   */
  private applyProfileUpdate(
    volunteer: VolunteerWithoutPrivateFields,
    dto: UpdateVolunteerDto,
  ): void {
    const hasChildren = dto.hasChildren ?? volunteer.hasChildren;
    const childrenAges =
      dto.childrenAges ??
      (dto.hasChildren === false ? [] : volunteer.childrenAges);
    this.checkChildrenConsistent(hasChildren, childrenAges);
    Object.assign(volunteer, dto, { childrenAges });
  }

  /**
   * Ensures childrenAges lists at least one age when hasChildren is true,
   * and none when it is false. Mirrors CHK_foster_volunteers_children_ages,
   * so a bad request is a 400 instead of a database error.
   *
   * @throws {BadRequestException} If childrenAges doesn't match hasChildren.
   */
  private checkChildrenConsistent(
    hasChildren: boolean,
    childrenAges: number[],
  ): void {
    if (hasChildren && childrenAges.length === 0) {
      throw new BadRequestException(
        'childrenAges must not be empty when hasChildren is true',
      );
    }
    if (!hasChildren && childrenAges.length > 0) {
      throw new BadRequestException(
        'childrenAges must be empty when hasChildren is false',
      );
    }
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
  async approve(id: number): Promise<VolunteerWithoutPrivateFields> {
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

    return this.withoutPrivateFields(saved);
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
  async getAllVolunteers(): Promise<VolunteerWithoutPrivateFields[]> {
    const volunteers = await this.repo.find({
      relations: ['assignedCoordinators', 'pets'],
    });
    return volunteers.map((volunteer) => this.withoutPrivateFields(volunteer));
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
   * @throws {NotFoundException} If no Volunteer with the ID exists, or an added animal does not exist.
   * @throws {BadRequestException} If the Volunteer is not active, animals are removed from
   * an empty list, an ID is in both the added and removed lists, or a removed ID is not in
   * the Volunteer's preferences.
   */
  async updateAnimalPreferences(
    id: number,
    dto: UpdateAnimalPreferencesDto,
  ): Promise<string[]> {
    const volunteer = await this.findActiveOrFail(id);
    const { added = [], removed = [] } = dto;

    if (added.length > 0) {
      await this.animalsService.checkAllExistOrFail(added);
    }
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
