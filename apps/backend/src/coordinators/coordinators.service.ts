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

  async setActive(id: number, active: boolean): Promise<FosterCoordinator> {
    const coordinator = await this.repo.findOne({
      where: { coordinatorId: id },
    });

    if (!coordinator) {
      throw new NotFoundException(`Coordinator with ID ${id} not found`);
    }

    coordinator.active = active;

    return this.repo.save(coordinator);
  }
}
