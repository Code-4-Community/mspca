import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { MatchesService } from './matches.service';
import { Match } from './matches.entity';
import { CreateMatchDto } from './dtos/create-match.dto';
import { validateId } from '../utils/validation.utils';

@Controller('matches')
export class MatchesController {
  constructor(private matchesService: MatchesService) {}

  @Post()
  async createMatch(@Body() body: CreateMatchDto): Promise<Match> {
    return this.matchesService.create(body);
  }

  @Patch(':matchId/withdraw')
  async withdrawMatch(
    @Param('matchId', ParseIntPipe) matchId: number,
  ): Promise<Match> {
    validateId(matchId, 'Match');

    return this.matchesService.withdraw(matchId);
  }
}
