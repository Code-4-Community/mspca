import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FosterVolunteer } from './volunteers.entity';
import { VolunteersController } from './volunteers.controller';
import { VolunteersService } from './volunteers.service';
import { CoordinatorsModule } from '../coordinators/coordinators.module';
import { MatchesModule } from '../matches/matches.module';
import { AWSSESModule } from '../aws/ses/email.module';
import { AnimalsModule } from '../animals/animals.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FosterVolunteer]),
    CoordinatorsModule,
    forwardRef(() => MatchesModule),
    AWSSESModule,
    AnimalsModule,
  ],
  controllers: [VolunteersController],
  providers: [VolunteersService],
  exports: [VolunteersService],
})
export class VolunteersModule {}
