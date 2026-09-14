import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FosterCoordinator } from './coordinators.entity';

@Injectable()
export class CoordinatorsService {
  constructor(
    @InjectRepository(FosterCoordinator)
    private repo: Repository<FosterCoordinator>,
  ) {}
}
