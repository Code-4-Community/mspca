import {
  Body,
  Controller,
  Get,
  HttpStatus,
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
import { DenyMatchDto } from './dtos/deny-match.dto';
import { ChameleonAnimalIdParamDto } from './dtos/chameleon-animal-id-param.dto';

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
    status: HttpStatus.CREATED,
    description: 'The created match, with a PENDING status.',
    type: Match,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description:
      'The request body is invalid or the volunteer is not active, so a match cannot be made.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'No volunteer or animal exists with the given ID.',
  })
  async createMatch(@Body() body: CreateMatchDto): Promise<Match> {
    return this.matchesService.create(body);
  }

  @Get(':chameleonAnimalId/pending')
  @ApiOperation({
    summary: 'Get pending matches for an animal',
    description:
      'Returns every PENDING match for a Chameleon animal, each with the full volunteer (including notes)',
  })
  @ApiParam({
    name: 'chameleonAnimalId',
    type: String,
    description: 'The Chameleon ID of the animal.',
    example: 'A476750',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      "The animal's pending matches, or an empty array if it has none.",
    type: [Match],
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description:
      'The Chameleon animal ID is blank or longer than 255 characters.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'No animal exists with the given Chameleon ID.',
  })
  async getPendingMatches(
    @Param() params: ChameleonAnimalIdParamDto,
  ): Promise<Match[]> {
    return this.matchesService.findPendingByChameleonAnimalId(
      params.chameleonAnimalId,
    );
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
    status: HttpStatus.OK,
    description: 'The updated match, with a WITHDRAWN status.',
    type: Match,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description:
      'The match ID is not a positive integer, or the match is not PENDING and so cannot be withdrawn.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'No match exists with the given ID.',
  })
  async withdrawMatch(
    @Param('matchId', ParseIntPipe) matchId: number,
  ): Promise<Match> {
    validateId(matchId, 'Match');

    return this.matchesService.withdraw(matchId);
  }

  @Patch(':matchId/approve')
  @ApiOperation({ summary: 'Approve a pending match' })
  @ApiParam({ name: 'matchId', type: Number, description: 'ID of the match' })
  @ApiResponse({
    status: HttpStatus.OK,
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
    status: HttpStatus.OK,
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
