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

  async getVolunteerById(id: number): Promise<FosterVolunteer> {
    const volunteer = await this.repo.findOneBy({ volunteerId: id });
    if (!volunteer) {
      throw new NotFoundException(`Volunteer with id ${id} not found`);
    }
    return volunteer;
  }

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
