import { Module } from '@nestjs/common';
import { PetsModule } from '../pets/pets.module';
import { VolunteersModule } from '../volunteers/volunteers.module';
import { AgeJobsService } from './age-jobs.service';

@Module({
  imports: [PetsModule, VolunteersModule],
  providers: [AgeJobsService],
})
export class JobsModule {}
