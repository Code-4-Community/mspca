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
   */
  @Cron('0 0 1 * *', { timeZone: SCHEDULE_TIME_ZONE })
  async incrementPetAges(): Promise<void> {
    try {
      const count = await this.petsService.incrementAllAges();
      this.logger.log(`Incremented age of ${count} pets`);
    } catch (err) {
      this.logger.error(
        'Failed to increment pet ages',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  /**
   * Ages every child by one year. Runs at midnight on January 1.
   */
  @Cron('0 0 1 1 *', { timeZone: SCHEDULE_TIME_ZONE })
  async incrementChildrenAges(): Promise<void> {
    try {
      const count = await this.volunteersService.incrementAllChildrenAges();
      this.logger.log(`Incremented children's ages for ${count} volunteers`);
    } catch (err) {
      this.logger.error(
        "Failed to increment children's ages",
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
