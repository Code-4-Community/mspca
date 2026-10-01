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

  /**
   * Gets all foster volunteers.
   * Returns every volunteer regardless of match status, or an empty array if there are none.
   * @returns A list of all volunteers
   */
  async getAllVolunteers(): Promise<FosterVolunteer[]> {
    return this.repo.find();
  }
}
