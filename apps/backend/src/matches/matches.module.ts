import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Match } from './matches.entity';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';
import { FosterVolunteer } from '../volunteers/volunteers.entity';
import { AWSSESModule } from '../aws/ses/email.module';

@Module({
  imports: [TypeOrmModule.forFeature([Match, FosterVolunteer]), AWSSESModule],
  controllers: [MatchesController],
  providers: [MatchesService],
  exports: [MatchesService],
})
export class MatchesModule {}
