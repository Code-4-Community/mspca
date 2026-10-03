import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FosterVolunteer } from './volunteers.entity';

@Injectable()
export class VolunteersService {
  constructor(
    @InjectRepository(FosterVolunteer)
    private repo: Repository<FosterVolunteer>,
  ) {}

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
    const volunteer = await this.repo.findOneBy({ volunteerId: id });

    if (!volunteer) {
      throw new NotFoundException(`Volunteer with ID ${id} not found`);
    }

    if (!volunteer.active) {
      throw new BadRequestException(`Volunteer with ID ${id} is not active`);
    }

    return volunteer;
  }
}
