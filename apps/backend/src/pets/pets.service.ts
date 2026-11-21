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
   * @returns The number of pets updated.
   */
  async incrementAllAges(): Promise<number> {
    const pets = await this.repo.find();
    if (pets.length === 0) {
      return 0;
    }

    for (const pet of pets) {
      const totalMonths = pet.ageYear * MONTHS_PER_YEAR + pet.ageMonth + 1;
      pet.ageYear = Math.floor(totalMonths / MONTHS_PER_YEAR);
      pet.ageMonth = totalMonths % MONTHS_PER_YEAR;
    }

    await this.repo.save(pets);
    return pets.length;
  }
}
