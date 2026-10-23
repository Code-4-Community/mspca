import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FosterCoordinator } from './coordinators.entity';
import { FosterVolunteer } from '../volunteers/volunteers.entity';
import { CoordinatorsController } from './coordinators.controller';
import { CoordinatorsService } from './coordinators.service';
import { CognitoModule } from '../aws/cognito/cognito.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FosterCoordinator, FosterVolunteer]),
    CognitoModule,
  ],
  controllers: [CoordinatorsController],
  providers: [CoordinatorsService],
  exports: [CoordinatorsService],
})
export class CoordinatorsModule {}
