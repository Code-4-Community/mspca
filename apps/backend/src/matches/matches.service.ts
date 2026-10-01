import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Match } from './matches.entity';
import { MatchStatus } from './matches.types';

@Injectable()
export class MatchesService {
  constructor(
    @InjectRepository(Match)
    private repo: Repository<Match>,
  ) {}

  /**
   * Approves a pending match.
   * Sets the match status to Active, meaning the foster placement is now happening.
   * Only matches that are currently Pending can be approved.
   * @param id - ID of the match to approve
   * @returns The updated match with status Active
   * @throws NotFoundException if no match exists with the given ID
   * @throws BadRequestException if the match is not Pending
   */
  async approveMatch(id: number): Promise<Match> {
    const match = await this.repo.findOneBy({ matchId: id });
    if (!match) {
      throw new NotFoundException(`Match with id ${id} not found`);
    }
    if (match.status !== MatchStatus.PENDING) {
      throw new BadRequestException(`Match with id ${id} is not pending`);
    }

    match.status = MatchStatus.ACTIVE;
    return this.repo.save(match);
  }

  /**
   * Denies a pending match with a reason.
   * Sets the match status to Denied and stores the reason on the match.
   * Only matches that are currently Pending can be denied.
   * @param id - ID of the match to deny
   * @param deniedReason - Why the match was denied
   * @returns The updated match with status Denied and the reason saved
   * @throws NotFoundException if no match exists with the given ID
   * @throws BadRequestException if the match is not Pending
   */
  async denyMatch(id: number, deniedReason: string): Promise<Match> {
    const match = await this.repo.findOneBy({ matchId: id });
    if (!match) {
      throw new NotFoundException(`Match with id ${id} not found`);
    }
    if (match.status !== MatchStatus.PENDING) {
      throw new BadRequestException(`Match with id ${id} is not pending`);
    }

    match.status = MatchStatus.DENIED;
    match.deniedReason = deniedReason;
    return this.repo.save(match);
  }
}
