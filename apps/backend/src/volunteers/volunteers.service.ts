import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FosterVolunteer } from './volunteers.entity';
import { VolunteerStatus } from './volunteers.types';
import { CreateVolunteerDto } from './dtos/create-volunteer.dto';
import { CognitoService } from '../aws/cognito/cognito.service';
import { CognitoRole } from '../aws/cognito/cognito.types';

@Injectable()
export class VolunteersService {
  private readonly logger = new Logger(VolunteersService.name);

  constructor(
    @InjectRepository(FosterVolunteer)
    private repo: Repository<FosterVolunteer>,
    private cognitoService: CognitoService,
  ) {}

  /**
   * Fetches a Volunteer by ID.
   *
   * Returns the Volunteer so callers can reuse it instead of fetching again.
   *
   * @param id - The Volunteer's ID.
   * @returns The Volunteer.
   * @throws {NotFoundException} If no Volunteer with the ID exists.
   */
  async findByIdOrFail(id: number): Promise<FosterVolunteer> {
    const volunteer = await this.repo.findOneBy({ volunteerId: id });

    if (!volunteer) {
      throw new NotFoundException(`Volunteer with ID ${id} not found`);
    }

    return volunteer;
  }

  /**
   * Creates a Volunteer account.
   *
   * The Cognito user is created first; the Postgres row is only saved once that
   * succeeds, so a Cognito failure never leaves a Volunteer without a login.
   * New Volunteers are pending until a coordinator approves them.
   *
   * @param dto - The Volunteer's profile fields.
   * @returns The saved Volunteer.
   * @throws {ConflictException} If a Volunteer or Cognito user with the email already exists.
   * @throws {InternalServerErrorException} If the Cognito user could not be created.
   */
  async create(dto: CreateVolunteerDto): Promise<FosterVolunteer> {
    const existing = await this.repo.findOneBy({ email: dto.email });
    if (existing) {
      throw new ConflictException('A volunteer with this email already exists');
    }

    const cognitoSub = await this.cognitoService.createUser({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      role: CognitoRole.FosterVolunteer,
    });

    try {
      return await this.repo.save({
        ...dto,
        status: VolunteerStatus.PENDING,
        mostRecentWaiverSigned: true,
        cognitoSub,
      });
    } catch (error) {
      // The Cognito user now exists without a matching Volunteer row and must
      // be cleaned up manually.
      this.logger.error(
        `Created Cognito user ${cognitoSub} for ${dto.email} but failed to save the Volunteer`,
      );
      throw error;
    }
  }

  async deactivate(id: number): Promise<FosterVolunteer> {
    const volunteer = await this.repo.findOne({ where: { volunteerId: id } });

    if (!volunteer) {
      throw new NotFoundException(`Volunteer with ID ${id} not found`);
    }

    volunteer.status = VolunteerStatus.INACTIVE;

    return this.repo.save(volunteer);
  }

  async activate(id: number): Promise<FosterVolunteer> {
    const volunteer = await this.repo.findOne({ where: { volunteerId: id } });

    if (!volunteer) {
      throw new NotFoundException(`Volunteer with ID ${id} not found`);
    }

    volunteer.status = VolunteerStatus.ACTIVE;

    return this.repo.save(volunteer);
  }
}
