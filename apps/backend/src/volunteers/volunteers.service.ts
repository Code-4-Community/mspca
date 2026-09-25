import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FosterVolunteer } from './volunteers.entity';
import { UpdateVolunteerDto } from './update-volunteer.dto';
import { FosterCoordinator } from '../coordinators/coordinators.entity';
import { NotFoundException } from '@nestjs/common';

@Injectable()
export class VolunteersService {
  constructor(
    @InjectRepository(FosterVolunteer)
    private repo: Repository<FosterVolunteer>,
    @InjectRepository(FosterCoordinator)
    private coordinatorRepo: Repository<FosterCoordinator>,
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

  async getVolunteerById(id: number) {
  return this.repo.findOneBy({ volunteerId: id });

  }
  async updateVolunteerbyId(id: number, dto: UpdateVolunteerDto) {

    const volunteer = await this.repo.findOneBy({ volunteerId: id });
    if (!volunteer) {
      return null;
    }

    const{assignedCoordinatorId, ...rest} = dto;

    if (assignedCoordinatorId !== undefined) {
      const coordinator = await this.coordinatorRepo.findOneBy({ coordinatorId: assignedCoordinatorId });
      if (!coordinator) {
        throw new NotFoundException('Coordinator not found');
      }
      volunteer.assignedCoordinator = coordinator;
    }


    Object.assign(volunteer, rest);
    return await this.repo.save(volunteer);
  }
}
