import { Injectable } from '@nestjs/common';
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

  async approveMatch(id: number) {
    const match = await this.repo.findOneBy({ matchId: id });
    if (!match) {
      return null;
    }

    match.status = MatchStatus.COMPLETE;
    return this.repo.save(match);
  }

  async denyMatch(id: number, deniedReason: string) {
    const match = await this.repo.findOneBy({ matchId: id });
    if (!match) {
      return null;
    }

    match.status = MatchStatus.DENIED;
    match.deniedReason = deniedReason;
    return this.repo.save(match);
  }
  
}
