import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FosterVolunteer } from './volunteers.entity';

@Injectable()
export class VolunteersService {
  constructor(
    @InjectRepository(FosterVolunteer)
    private repo: Repository<FosterVolunteer>,
  ) {}

  // Example service functions
  // find(email: string) {
  //   return this.repo.find({ where: { email } });
  // }

  // async update(id: number, attrs: Partial<User>) {
  //   const user = await this.findOne(id);

  //   if (!user) {
  //     throw new NotFoundException('User not found');
  //   }

  //   Object.assign(user, attrs);

  //   return this.repo.save(user);
  // }

  async deactivate(id: number): Promise<FosterVolunteer> {
    const volunteer = await this.repo.findOne({ where: { volunteerId: id } });

    if (!volunteer) {
      throw new NotFoundException(`Volunteer with ID ${id} not found`);
    }

    volunteer.active = false;

    return this.repo.save(volunteer);
  }

  async activate(id: number): Promise<FosterVolunteer> {
    const volunteer = await this.repo.findOne({ where: { volunteerId: id } });

    if (!volunteer) {
      throw new NotFoundException(`Volunteer with ID ${id} not found`);
    }

    volunteer.active = true;

    return this.repo.save(volunteer);
  }
}
