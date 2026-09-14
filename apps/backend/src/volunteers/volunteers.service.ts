import { Injectable } from '@nestjs/common';
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
}
