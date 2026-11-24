import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PetsService } from '../pets/pets.service';
import { VolunteersService } from '../volunteers/volunteers.service';

const SCHEDULE_TIME_ZONE = 'America/New_York';

@Injectable()
export class AgeJobsService {
  constructor(
    private petsService: PetsService,
    private volunteersService: VolunteersService,
  ) {}

  /**
   * Ages every pet by one month. Runs at midnight on the first of each month.
   */
  @Cron('0 0 1 * *', { timeZone: SCHEDULE_TIME_ZONE })
  async incrementPetAges(): Promise<void> {
    await this.petsService.incrementAllAges();
  }

  /**
   * Ages every child by one year. Runs at midnight on January 1.
   */
  @Cron('0 0 1 1 *', { timeZone: SCHEDULE_TIME_ZONE })
  async incrementChildrenAges(): Promise<void> {
    await this.volunteersService.incrementAllChildrenAges();
  }
}
