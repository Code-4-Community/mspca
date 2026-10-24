import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FosterCoordinator } from './coordinators.entity';
import { Homebase } from '../types';

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

  /**
   * Fetches the active Coordinators at a homebase.
   *
   * @param homebase - The homebase to look up.
   * @returns The active Coordinators, ordered by ID, or an empty array if none.
   */
  findActiveByHomebase(homebase: Homebase): Promise<FosterCoordinator[]> {
    return this.repo.find({
      where: { homebase, active: true },
      order: { coordinatorId: 'ASC' },
    });
  }

  /**
   * Deactivates a Coordinator.
   *
   * @param id - The Coordinator's ID.
   * @returns The updated Coordinator.
   * @throws {NotFoundException} If no Coordinator with the ID exists.
   * @throws {BadRequestException} If the Coordinator is already inactive.
   */
  async deactivate(id: number): Promise<FosterCoordinator> {
    const coordinator = await this.findByIdOrFail(id);

    if (!coordinator.active) {
      throw new BadRequestException(
        `Coordinator with ID ${id} is already inactive`,
      );
    }

    coordinator.active = false;

    return this.repo.save(coordinator);
  }

  /**
   * Activates a Coordinator.
   *
   * @param id - The Coordinator's ID.
   * @returns The updated Coordinator.
   * @throws {NotFoundException} If no Coordinator with the ID exists.
   * @throws {BadRequestException} If the Coordinator is already active.
   */
  async activate(id: number): Promise<FosterCoordinator> {
    const coordinator = await this.findByIdOrFail(id);

    if (coordinator.active) {
      throw new BadRequestException(
        `Coordinator with ID ${id} is already active`,
      );
    }

    coordinator.active = true;

    return this.repo.save(coordinator);
  }
}
