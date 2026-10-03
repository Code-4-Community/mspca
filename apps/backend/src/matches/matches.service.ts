import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Match } from './matches.entity';

@Injectable()
export class MatchesService {
  constructor(
    @InjectRepository(Match)
    private repo: Repository<Match>,
  ) {}

  /**
   * Fetches all Matches for a Volunteer.
   *
   * Returns Matches of every status, not just active ones.
   * Does not check that the Volunteer exists, so an unknown ID yields an
   * empty array; callers that need a 404 should check the Volunteer first.
   *
   * @param volunteerId - The Volunteer's ID.
   * @returns The Volunteer's Matches, or an empty array if they have none.
   */
  findByVolunteerId(volunteerId: number): Promise<Match[]> {
    return this.repo.find({ where: { volunteerId } });
  }
}
