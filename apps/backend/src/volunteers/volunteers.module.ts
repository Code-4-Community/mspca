import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FosterVolunteer } from './volunteers.entity';
import { VolunteersController } from './volunteers.controller';
import { VolunteersService } from './volunteers.service';
import { FosterCoordinator } from '../coordinators/coordinators.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FosterVolunteer, FosterCoordinator])],
  controllers: [VolunteersController],
  providers: [VolunteersService],
  exports: [VolunteersService],
})
export class VolunteersModule {}
