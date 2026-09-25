import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Recommendation } from './recommendations.entity';
import { CreateRecommendationDTO } from './createRecommendation.dto';

@Injectable()
export class RecommendationsService {
  constructor(
    @InjectRepository(Recommendation)
    private repo: Repository<Recommendation>,
  ) {}

  /**
   * Creates a recommendation for the given volunteer and Chameleon animal.
   * (volunteer_id, chameleon_animal_id) is the primary key, so recommending
   * the same animal again reactivates the existing row rather than
   * duplicating it.
   */
  create({
    volunteerId,
    chameleonAnimalId,
  }: CreateRecommendationDTO): Promise<Recommendation> {
    return this.repo.save(
      this.repo.create({ volunteerId, chameleonAnimalId, isActive: true }),
    );
  }
}
