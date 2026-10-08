import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FosterVolunteer } from './volunteers.entity';
import { VolunteersController } from './volunteers.controller';
import { VolunteersService } from './volunteers.service';
import { CoordinatorsModule } from '../coordinators/coordinators.module';
import { MatchesModule } from '../matches/matches.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FosterVolunteer]),
    CoordinatorsModule,
    forwardRef(() => MatchesModule),
  ],
  controllers: [VolunteersController],
  providers: [VolunteersService],
  exports: [VolunteersService],
})
export class VolunteersModule {}
