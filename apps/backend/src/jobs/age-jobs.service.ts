import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PetsService } from '../pets/pets.service';
import { VolunteersService } from '../volunteers/volunteers.service';

const SCHEDULE_TIME_ZONE = 'America/New_York';

@Injectable()
export class AgeJobsService {
  private readonly logger = new Logger(AgeJobsService.name);

  constructor(
    private petsService: PetsService,
    private volunteersService: VolunteersService,
  ) {}

  /**
   * Ages every pet by one month. Runs at midnight on the first of each month.
   *
   * @returns A promise that resolves when every pet's age has been incremented.
   */
  @Cron('0 0 1 * *', { timeZone: SCHEDULE_TIME_ZONE })
  async incrementPetAges(): Promise<void> {
    await this.petsService.incrementAllAges();
    this.logger.log('Age job: pet ages incremented');
  }

  /**
   * Ages every child by one year. Runs at midnight on January 1.
   *
   * @returns A promise that resolves when every child's age has been incremented.
   */
  @Cron('0 0 1 1 *', { timeZone: SCHEDULE_TIME_ZONE })
  async incrementChildrenAges(): Promise<void> {
    await this.volunteersService.incrementAllChildrenAges();
    this.logger.log("Age job: children's ages incremented");
  }
}
