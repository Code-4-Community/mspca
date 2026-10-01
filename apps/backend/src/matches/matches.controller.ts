import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MatchesService } from './matches.service';
import { Match } from './matches.entity';
import { CreateMatchDto } from './dtos/create-match.dto';
import { validateId } from '../utils/validation.utils';

@ApiTags('Matches')
@Controller('matches')
export class MatchesController {
  constructor(private matchesService: MatchesService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a match',
    description:
      "Creates a PENDING match between a volunteer and a Chameleon animal and emails the volunteer's assigned foster coordinator.",
  })
  @ApiResponse({
    status: 201,
    description: 'The created match, with a PENDING status.',
    type: Match,
  })
  async createMatch(@Body() body: CreateMatchDto): Promise<Match> {
    return this.matchesService.create(body);
  }

  @Patch(':matchId/withdraw')
  @ApiOperation({
    summary: 'Withdraw a match',
    description:
      'Sets a PENDING match to WITHDRAWN. The record is kept so volunteers can still see their withdrawn applications.',
  })
  @ApiParam({
    name: 'matchId',
    type: Number,
    description: 'The ID of the match to withdraw.',
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: 'The updated match, with a WITHDRAWN status.',
    type: Match,
  })
  async withdrawMatch(
    @Param('matchId', ParseIntPipe) matchId: number,
  ): Promise<Match> {
    validateId(matchId, 'Match');

    return this.matchesService.withdraw(matchId);
  }
}
