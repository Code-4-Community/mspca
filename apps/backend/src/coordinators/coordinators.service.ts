import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FosterCoordinator } from './coordinators.entity';
import { CreateCoordinatorDto } from './dtos/create-coordinator.dto';
import { ConfirmCoordinatorDto } from './dtos/confirm-coordinator.dto';
import { CognitoService } from '../aws/cognito/cognito.service';
import { CognitoRole } from '../aws/cognito/cognito.types';

@Injectable()
export class CoordinatorsService {
  private readonly logger = new Logger(CoordinatorsService.name);

  constructor(
    @InjectRepository(FosterCoordinator)
    private repo: Repository<FosterCoordinator>,
    private cognitoService: CognitoService,
  ) {}

  /**
   * Registers a coordinator with Cognito and saves their profile.
   * Coordinators are active immediately and do not require approval.
   */
  async create(dto: CreateCoordinatorDto): Promise<FosterCoordinator> {
    const { password, ...profile } = dto;
    const email = profile.email.trim().toLowerCase();

    const existing = await this.repo.findOneBy({ email });

    if (existing) {
      throw new ConflictException(
        'A coordinator with this email already exists',
      );
    }

    const cognitoSub = await this.cognitoService.signUpUser({
      firstName: profile.firstName,
      lastName: profile.lastName,
      email,
      password,
    });

    try {
      return await this.repo.save({
        ...profile,
        email,
        active: true,
        cognitoSub,
      });
    } catch (error) {
      this.logger.error(
        `Failed to save coordinator ${email}`,
        error instanceof Error ? error.stack : String(error),
      );

      try {
        await this.cognitoService.deleteUser(email);
      } catch {
        this.logger.error(
          `Created Cognito user ${cognitoSub} for ${email}, but failed to save the coordinator or delete the Cognito user`,
        );
      }

      throw new InternalServerErrorException('Failed to save the coordinator');
    }
  }

  /**
   * Confirms the coordinator's email and assigns the
   * FosterCoordinator Cognito role.
   */
  async confirm(dto: ConfirmCoordinatorDto): Promise<void> {
    const email = dto.email.trim().toLowerCase();

    const coordinator = await this.repo.findOneBy({ email });

    if (!coordinator) {
      throw new NotFoundException('No coordinator with this email exists');
    }

    await this.cognitoService.confirmUser(
      email,
      dto.code,
      CognitoRole.FosterCoordinator,
    );
  }

  /**
   * Retrieves a coordinator by ID.
   */
  async findByIdOrFail(id: number): Promise<FosterCoordinator> {
    const coordinator = await this.repo.findOne({
      where: { coordinatorId: id },
      relations: ['assignedVolunteers'],
    });

    if (!coordinator) {
      throw new NotFoundException(`Coordinator with ID ${id} not found`);
    }

    return coordinator;
  }

  /**
   * Deactivates an active coordinator.
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
   * Reactivates an inactive coordinator.
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
