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
   * Fetches a Volunteer by ID.
   *
   * Returns the Volunteer so callers can reuse it instead of fetching again.
   *
   * @param id - The Volunteer's ID.
   * @returns The Volunteer.
   * @throws {NotFoundException} If no Volunteer with the ID exists.
   */
  async findByIdOrFail(id: number): Promise<FosterVolunteer> {
    const volunteer = await this.repo.findOneBy({ volunteerId: id });

    if (!volunteer) {
      throw new NotFoundException(`Volunteer with ID ${id} not found`);
    }

    return volunteer;
  }

  async deactivate(id: number): Promise<FosterVolunteer> {
    const volunteer = await this.findByIdOrFail(id);

    volunteer.status = VolunteerStatus.INACTIVE;

    return this.repo.save(volunteer);
  }

  async activate(id: number): Promise<FosterVolunteer> {
    const volunteer = await this.findByIdOrFail(id);

    volunteer.status = VolunteerStatus.ACTIVE;

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
   * @throws {ConflictException} If the Volunteer is already active.
   * @throws {BadRequestException} If the Volunteer is not pending.
   */
  async approve(id: number): Promise<FosterVolunteer> {
    const volunteer = await this.findByIdOrFail(id);

    if (volunteer.status === VolunteerStatus.ACTIVE) {
      throw new ConflictException(`Volunteer with ID ${id} is already active`);
    }

    if (volunteer.status !== VolunteerStatus.PENDING) {
      throw new BadRequestException(
        `Only pending Volunteers can be approved`,
      );
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
}
