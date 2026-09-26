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
   * duplicating it. This upserts rather than save()-ing so that two
   * coordinators recommending the same animal at once can't race into a
   * primary key violation.
   */
  async create({
    volunteerId,
    chameleonAnimalId,
  }: CreateRecommendationDTO): Promise<Recommendation> {
    await this.repo.upsert({ volunteerId, chameleonAnimalId, isActive: true }, [
      'volunteerId',
      'chameleonAnimalId',
    ]);

    return this.repo.findOneByOrFail({ volunteerId, chameleonAnimalId });
  }
}
