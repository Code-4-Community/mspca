import { Controller, Patch, Param, Body, ParseIntPipe } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { MatchesService } from './matches.service';
import { validateId } from '../utils/validation.utils';
import { DenyMatchDto } from './dto/deny-match.dto';
import { Match } from './matches.entity';

@Controller('matches')
export class MatchesController {
  constructor(private matchesService: MatchesService) {}

  @Patch(':matchId/approve')
  @ApiOperation({ summary: 'Approve a pending match' })
  @ApiParam({ name: 'matchId', type: Number, description: 'ID of the match' })
  @ApiResponse({
    status: 200,
    description: 'The match was approved and is now Active',
    type: Match,
  })
  async approveMatch(
    @Param('matchId', ParseIntPipe) matchId: number,
  ): Promise<Match> {
    validateId(matchId, 'Match');
    return this.matchesService.approveMatch(matchId);
  }

  @Patch(':matchId/deny')
  @ApiOperation({ summary: 'Deny a pending match with a reason' })
  @ApiParam({ name: 'matchId', type: Number, description: 'ID of the match' })
  @ApiResponse({
    status: 200,
    description: 'The match was denied and the reason was saved',
    type: Match,
  })
  async denyMatch(
    @Param('matchId', ParseIntPipe) matchId: number,
    @Body() dto: DenyMatchDto,
  ): Promise<Match> {
    validateId(matchId, 'Match');
    return this.matchesService.denyMatch(matchId, dto.deniedReason);
  }
}
