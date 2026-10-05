import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FosterCoordinator } from './coordinators.entity';
import { CreateCoordinatorDto } from './dtos/create-coordinator.dto';
import { CognitoService } from '../aws/cognito/cognito.service';
import { CognitoRole } from '../aws/cognito/cognito.types';

@Injectable()
export class CoordinatorsService {
  constructor(
    @InjectRepository(FosterCoordinator)
    private repo: Repository<FosterCoordinator>,
    private cognitoService: CognitoService,
  ) {}

  /**
   * Creates a Foster Coordinator.
   *
   * Registers the user in Cognito (mspca-user-pool) under the FosterCoordinator
   * group first, and only persists the Postgres row if that succeeds — so a
   * failed Cognito call never leaves behind a coordinator with no login.
   *
   * @throws {ConflictException} If a coordinator with this email already exists.
   */
  async create(dto: CreateCoordinatorDto): Promise<FosterCoordinator> {
    const existing = await this.repo.findOneBy({ email: dto.email });
    if (existing) {
      throw new ConflictException(
        'A coordinator with this email already exists',
      );
    }

    // Throws (and does NOT create a Postgres row) if the Cognito call fails,
    // including when the email is already in use in the user pool.
    const cognitoSub = await this.cognitoService.createUser({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      role: CognitoRole.FosterCoordinator,
    });

    const coordinator = this.repo.create({
      ...dto,
      active: true,
      assignedVolunteers: [],
      cognitoSub,
    });

    return this.repo.save(coordinator);
  }
}
