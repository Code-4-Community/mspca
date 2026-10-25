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
  async findByChameleonIdOrFail(chameleonAnimalId: number): Promise<Animal> {
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
   * Looks all of the IDs up in a single query and reports every missing ID together.
   *
   * @param chameleonAnimalIds - The Chameleon IDs to check.
   * @throws {NotFoundException} If any of the IDs don't match an Animal.
   */
  async checkAllExistOrFail(chameleonAnimalIds: number[]): Promise<void> {
    if (chameleonAnimalIds.length === 0) {
      return;
    }

    const animals = await this.repo.find({
      where: { chameleonAnimalId: In(chameleonAnimalIds) },
    });
    const foundIds = new Set(animals.map((animal) => animal.chameleonAnimalId));
    const missing = chameleonAnimalIds.filter((id) => !foundIds.has(id));

    if (missing.length > 0) {
      throw new NotFoundException(
        `Animals with Chameleon IDs not found: ${missing.join(', ')}`,
      );
    }
  }
}
