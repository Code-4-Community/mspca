import {
  Controller,
  Patch,
  Param,
  Body,
  NotFoundException,
} from '@nestjs/common';
import { MatchesService } from './matches.service';
import { validateId } from '../utils/validation.utils';
import { DenyMatchDto } from './deny-match.dto';

@Controller('matches')
export class MatchesController {
  constructor(private matchesService: MatchesService) {}

  @Patch(':matchId/approve')
  async approveMatch(@Param('matchId') matchId: string) {
    const id = Number(matchId);
    validateId(id, 'Match');

    const match = await this.matchesService.approveMatch(id);
    if (!match) {
      throw new NotFoundException('Match not found');
    }
    return match;
  }

  @Patch(':matchId/deny')
  async denyMatch(
    @Param('matchId') matchId: string,
    @Body() dto: DenyMatchDto,
  ) {
    const id = Number(matchId);
    validateId(id, 'Match');

    const match = await this.matchesService.denyMatch(id, dto.deniedReason);
    if (!match) {
      throw new NotFoundException('Match not found');
    }
    return match;
  }
}
