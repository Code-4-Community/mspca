import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { FosterCoordinator } from './coordinators.entity';
import { FosterVolunteer } from '../volunteers/volunteers.entity';
import { CreateCoordinatorDto } from './dtos/create-coordinator.dto';
import { CognitoService } from '../aws/cognito/cognito.service';
import { CognitoRole } from '../aws/cognito/cognito.types';

@Injectable()
export class CoordinatorsService {
  private readonly logger = new Logger(CoordinatorsService.name);

  constructor(
    @InjectRepository(FosterCoordinator)
    private repo: Repository<FosterCoordinator>,
    @InjectRepository(FosterVolunteer)
    private volunteerRepo: Repository<FosterVolunteer>,
    private cognitoService: CognitoService,
  ) {}

  /**
   * Creates a Foster Coordinator and assigns currently unassigned volunteers
   * at their homebase.
   *
   * @param dto - Coordinator profile data.
   * @returns The saved coordinator.
   * @throws {ConflictException} If the coordinator email already exists.
   */
  async create(dto: CreateCoordinatorDto): Promise<FosterCoordinator> {
    const email = dto.email.trim().toLowerCase();

    if (!/^[^\s@]+@mspca\.org$/.test(email)) {
      throw new BadRequestException('Email must end in @mspca.org');
    }

    if (await this.repo.findOneBy({ email })) {
      throw new ConflictException(
        'A coordinator with this email already exists',
      );
    }

    const cognitoSub = await this.cognitoService.createUser({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email,
      role: CognitoRole.FosterCoordinator,
    });

    let coordinator: FosterCoordinator;

    try {
      coordinator = await this.repo.save(
        this.repo.create({
          ...dto,
          email,
          active: true,
          assignedVolunteers: [],
          cognitoSub,
        }),
      );
    } catch (error) {
      this.logger.error(`Failed to save coordinator ${email}`, error);

      try {
        await this.cognitoService.deleteUser(email);
      } catch (cleanupError) {
        this.logger.error(
          `Failed to clean up Cognito user for ${email}`,
          cleanupError,
        );
      }

      throw new InternalServerErrorException('Failed to save the Coordinator');
    }

    await this.volunteerRepo.update(
      { homebase: dto.homebase, assignedCoordinator: IsNull() },
      { assignedCoordinator: coordinator },
    );

    coordinator.assignedVolunteers = await this.volunteerRepo.find({
      where: {
        assignedCoordinator: { coordinatorId: coordinator.coordinatorId },
      },
    });

    return coordinator;
  }

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
