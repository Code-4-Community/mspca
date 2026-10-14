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
import { VolunteerStatus } from './volunteers.types';
import { UpdateVolunteerDto } from './dto/update-volunteer.dto';
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
   * Gets all foster volunteers.
   * Returns every volunteer regardless of match status, or an empty array if there are none.
   * @returns A list of all volunteers
   */
  async getAllVolunteers(): Promise<FosterVolunteer[]> {
    return this.repo.find();
  }
}
