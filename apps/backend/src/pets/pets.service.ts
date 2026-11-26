import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Pet } from './pets.entity';

const MONTHS_PER_YEAR = 12;

@Injectable()
export class PetsService {
  constructor(@InjectRepository(Pet) private repo: Repository<Pet>) {}

  /**
   * Ages every pet by one month, rolling into the next year after month 11.
   *
   * @returns A promise that resolves when every pet's age has been incremented.
   */
  async incrementAllAges(): Promise<void> {
    const pets = await this.repo.find();
    if (pets.length === 0) {
      return;
    }

    for (const pet of pets) {
      pet.ageMonth += 1;
      if (pet.ageMonth === MONTHS_PER_YEAR) {
        pet.ageMonth = 0;
        pet.ageYear += 1;
      }
    }

    await this.repo.save(pets);
  }
}
