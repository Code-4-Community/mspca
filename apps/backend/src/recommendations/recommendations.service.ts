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
