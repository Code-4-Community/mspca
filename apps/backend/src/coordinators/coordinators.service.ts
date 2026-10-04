import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FosterCoordinator } from './coordinators.entity';

@Injectable()
export class CoordinatorsService {
  constructor(
    @InjectRepository(FosterCoordinator)
    private repo: Repository<FosterCoordinator>,
  ) {}

  /**
   * Fetches a Coordinator by ID.
   *
   * @param id - The Coordinator's ID.
   * @returns The Coordinator.
   * @throws {NotFoundException} If no Coordinator with the ID exists.
   */
  async findByIdOrFail(id: number): Promise<FosterCoordinator> {
    const coordinator = await this.repo.findOne({
      where: { coordinatorId: id },
    });

    if (!coordinator) {
      throw new NotFoundException(`Coordinator with ID ${id} not found`);
    }

    return coordinator;
  }

  async deactivate(id: number): Promise<FosterCoordinator> {
    const coordinator = await this.findByIdOrFail(id);

    coordinator.active = false;

    return this.repo.save(coordinator);
  }

  async activate(id: number): Promise<FosterCoordinator> {
    const coordinator = await this.findByIdOrFail(id);

    coordinator.active = true;

    return this.repo.save(coordinator);
  }
}
