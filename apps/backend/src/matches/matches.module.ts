import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Match } from './matches.entity';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';
import { VolunteersModule } from '../volunteers/volunteers.module';
import { AWSSESModule } from '../aws/ses/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Match]),
    forwardRef(() => VolunteersModule),
    AWSSESModule,
  ],
  controllers: [MatchesController],
  providers: [MatchesService],
  exports: [MatchesService],
})
export class MatchesModule {}
