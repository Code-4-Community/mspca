import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Recommendation } from './recommendations.entity';
import { CreateRecommendationDTO } from './dto/create-recommendation.dto';
import { VolunteersService } from '../volunteers/volunteers.service';
import { AnimalsService } from '../animals/animals.service';

@Injectable()
export class RecommendationsService {
  constructor(
    @InjectRepository(Recommendation)
    private repo: Repository<Recommendation>,
    private volunteersService: VolunteersService,
    private animalsService: AnimalsService,
  ) {}

  /**
   * Recommends a Chameleon Animal to a Volunteer.
   *
   * (volunteerId, chameleonAnimalId) is the primary key, so recommending the
   * same animal again reactivates the existing row instead of duplicating it.
   * This upserts rather than save()-ing so that two concurrent requests for
   * the same pair can't race into a primary key violation.
   *
   * @param dto - The Volunteer and Chameleon Animal IDs to link.
   * @returns The active recommendation as persisted.
   * @throws {NotFoundException} If the Volunteer or Animal does not exist.
   * @throws {BadRequestException} If the Volunteer is not active.
   * @throws {EntityNotFoundError} If the row can't be read back after the upsert.
   */
  async create({
    volunteerId,
    chameleonAnimalId,
  }: CreateRecommendationDTO): Promise<Recommendation> {
    await this.volunteersService.findActiveOrFail(volunteerId);
    await this.animalsService.findByChameleonIdOrFail(chameleonAnimalId);

    await this.repo.upsert({ volunteerId, chameleonAnimalId, isActive: true }, [
      'volunteerId',
      'chameleonAnimalId',
    ]);

    return this.repo.findOneByOrFail({ volunteerId, chameleonAnimalId });
  }
}
