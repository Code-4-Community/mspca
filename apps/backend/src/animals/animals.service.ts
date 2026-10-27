import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Animal } from './animals.entity';

@Injectable()
export class AnimalsService {
  constructor(
    @InjectRepository(Animal)
    private repo: Repository<Animal>,
  ) {}

  /**
   * Fetches an Animal by its Chameleon animal ID.
   *
   * @param chameleonAnimalId - The Animal's Chameleon ID.
   * @returns The Animal.
   * @throws {NotFoundException} If no Animal with the Chameleon ID exists.
   */
  async findByChameleonIdOrFail(chameleonAnimalId: string): Promise<Animal> {
    const animal = await this.repo.findOneBy({ chameleonAnimalId });

    if (!animal) {
      throw new NotFoundException(
        `Animal with Chameleon ID ${chameleonAnimalId} not found`,
      );
    }

    return animal;
  }

  /**
   * Ensures every given Chameleon animal ID belongs to an existing Animal.
   *
   * Looks all of the IDs up in a single query and reports every missing ID together,
   * listing each missing ID once even if it was given more than once.
   *
   * @param chameleonAnimalIds - The Chameleon IDs to check.
   * @throws {NotFoundException} If any of the IDs don't match an Animal.
   */
  async checkAllExistOrFail(chameleonAnimalIds: string[]): Promise<void> {
    const uniqueIds = [...new Set(chameleonAnimalIds)];

    if (uniqueIds.length === 0) {
      return;
    }

    const animals = await this.repo.find({
      where: { chameleonAnimalId: In(uniqueIds) },
    });
    const foundIds = new Set(animals.map((animal) => animal.chameleonAnimalId));
    const missing = uniqueIds.filter((id) => !foundIds.has(id));

    if (missing.length > 0) {
      throw new NotFoundException(
        `Animals with Chameleon IDs not found: ${missing.join(', ')}`,
      );
    }
  }
}
