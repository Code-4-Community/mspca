import { Injectable, NotFoundException } from '@nestjs/common';
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

  /**
   * Gets a single foster volunteer by ID.
   * Looks up the volunteer in the database and throws if no volunteer has that ID.
   * @param id - ID of the volunteer to get
   * @returns The volunteer with the given ID
   * @throws NotFoundException if no volunteer exists with the given ID
   */
  async getVolunteerById(id: number): Promise<FosterVolunteer> {
    const volunteer = await this.repo.findOneBy({ volunteerId: id });
    if (!volunteer) {
      throw new NotFoundException(`Volunteer with id ${id} not found`);
    }
    return volunteer;
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
    const volunteer = await this.repo.findOneBy({ volunteerId: id });
    if (!volunteer) {
      throw new NotFoundException(`Volunteer with id ${id} not found`);
    }
    Object.assign(volunteer, dto);
    return this.repo.save(volunteer);
  }
}
