import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FosterCoordinator } from './coordinators.entity';
import { CoordinatorsController } from './coordinators.controller';
import { CoordinatorsService } from './coordinators.service';

@Module({
  imports: [TypeOrmModule.forFeature([FosterCoordinator])],
  controllers: [CoordinatorsController],
  providers: [CoordinatorsService],
  exports: [CoordinatorsService],
})
export class CoordinatorsModule {}
