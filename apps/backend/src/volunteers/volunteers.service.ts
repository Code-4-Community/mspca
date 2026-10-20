import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FosterVolunteer } from './volunteers.entity';
import { FosterType, VolunteerStatus } from './volunteers.types';
import { UpdateVolunteerDto } from './dto/update-volunteer.dto';
import { UpdateFosterTypePreferencesDto } from './dto/update-foster-type-preferences.dto';
import { EmailsService } from '../aws/ses/email.service';
import { volunteerApprovedEmail } from '../emails/bodies/volunteerApproved';

@Injectable()
export class VolunteersService {
  private readonly logger = new Logger(VolunteersService.name);

  constructor(
    @InjectRepository(FosterVolunteer)
    private repo: Repository<FosterVolunteer>,
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

  /** Deactivates a currently active Volunteer. */
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
