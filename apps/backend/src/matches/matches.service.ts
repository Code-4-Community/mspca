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
  const match = await this.repo.findOne({ where: { matchId: id } });
  if (!match) {
    throw new Error('Match not found');
  }
  return this.repo.update({ matchId: id }, { status: MatchStatus.COMPLETE });
  }

  async denyMatch(id: number, deniedReason: string) {
    const match = await this.repo.findOne({ where: { matchId: id } });
    if (!match) {
      throw new Error('Match not found');
    }
    return this.repo.update({ matchId: id }, { status: MatchStatus.DENIED, deniedReason });
  }
}
