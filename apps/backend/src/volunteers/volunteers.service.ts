import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FosterVolunteer } from './volunteers.entity';
import { UpdateVolunteerDto } from './dto/update-volunteer.dto';

@Injectable()
export class VolunteersService {
  constructor(
    @InjectRepository(FosterVolunteer)
    private repo: Repository<FosterVolunteer>,
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

    if (!volunteer.active) {
      throw new BadRequestException(`Volunteer with ID ${id} is not active`);
    }

    return volunteer;
  }

  /**
   * Gets a single foster volunteer by ID.
   * Includes the volunteer's assigned coordinator.
   * @param id - ID of the volunteer to get
   * @returns The volunteer with the given ID
   * @throws NotFoundException if no volunteer exists with the given ID
   */
  async getVolunteerById(id: number): Promise<FosterVolunteer> {
    return this.findByIdOrFail(id);
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
}
