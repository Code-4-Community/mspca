import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FosterVolunteer } from './volunteers.entity';
import { VolunteerStatus } from './volunteers.types';

@Injectable()
export class VolunteersService {
  constructor(
    @InjectRepository(FosterVolunteer)
    private repo: Repository<FosterVolunteer>,
  ) {}

  async setStatus(
    id: number,
    status: VolunteerStatus,
  ): Promise<FosterVolunteer> {
    const volunteer = await this.repo.findOne({ where: { volunteerId: id } });

    if (!volunteer) {
      throw new NotFoundException(`Volunteer with ID ${id} not found`);
    }

    volunteer.status = status;

    return this.repo.save(volunteer);
  }
}
