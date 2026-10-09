import {
  BadRequestException,
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
import { UpdateAnimalUpdatesDto } from './dtos/update-animal-updates.dto';

@Injectable()
export class VolunteersService {
  private readonly logger = new Logger(VolunteersService.name);

  constructor(
    @InjectRepository(FosterVolunteer)
    private repo: Repository<FosterVolunteer>,
    private cognitoService: CognitoService,
  ) {}

  /**
   * Fetches a Volunteer by ID, with their assigned Foster Coordinator.
   *
   * Returns the Volunteer so callers can reuse it instead of fetching again.
   *
   * @param id - The Volunteer's ID.
   * @returns The Volunteer.
   * @throws {NotFoundException} If no Volunteer with the ID exists.
   */
  async findByIdOrFail(id: number): Promise<FosterVolunteer> {
    const volunteer = await this.repo.findOne({
      where: { volunteerId: id },
      relations: ['assignedCoordinator'],
    });

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
   * If the save fails, the Cognito user is deleted so the email can be reused.
   * New Volunteers are pending until a coordinator approves them.
   *
   * @param dto - The Volunteer's profile fields.
   * @returns The saved Volunteer.
   * @throws {ConflictException} If a Volunteer or Cognito user with the email already exists.
   * @throws {InternalServerErrorException} If the Cognito user could not be created.
   */
  async create(dto: CreateVolunteerDto): Promise<FosterVolunteer> {
    const email = dto.email.toLowerCase();

    const existing = await this.repo.findOneBy({ email });
    if (existing) {
      throw new ConflictException('A volunteer with this email already exists');
    }

    const cognitoSub = await this.cognitoService.createUser({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email,
      role: CognitoRole.FosterVolunteer,
    });

    try {
      return await this.repo.save({
        ...dto,
        email,
        status: VolunteerStatus.PENDING,
        mostRecentWaiverSigned: true,
        cognitoSub,
      });
    } catch (error) {
      await this.cognitoService
        .deleteUser(email)
        .catch(() =>
          this.logger.error(
            `Created Cognito user ${cognitoSub} for ${email} but failed to save the Volunteer or delete the Cognito user`,
          ),
        );
      throw error;
    }
  }

  /**
   * Deactivates a currently Active Volunteer.
   *
   * @param id - The Volunteer's ID.
   * @returns The updated Volunteer.
   * @throws {NotFoundException} If no Volunteer with the ID exists.
   * @throws {BadRequestException} If the Volunteer is not currently Active.
   */
  async deactivate(id: number): Promise<FosterVolunteer> {
    const volunteer = await this.findByIdOrFail(id);

    if (volunteer.status !== VolunteerStatus.ACTIVE) {
      throw new BadRequestException(`Volunteer with ID ${id} is not active`);
    }

    volunteer.status = VolunteerStatus.INACTIVE;

    return this.repo.save(volunteer);
  }

  /**
   * Reactivates a currently Inactive Volunteer.
   *
   * Does not apply to Pending Volunteers; those are moved to Active through
   * the approval flow instead.
   *
   * @param id - The Volunteer's ID.
   * @returns The updated Volunteer.
   * @throws {NotFoundException} If no Volunteer with the ID exists.
   * @throws {BadRequestException} If the Volunteer is not currently Inactive.
   */
  async reactivate(id: number): Promise<FosterVolunteer> {
    const volunteer = await this.findByIdOrFail(id);

    if (volunteer.status !== VolunteerStatus.INACTIVE) {
      throw new BadRequestException(`Volunteer with ID ${id} is not inactive`);
    }

    volunteer.status = VolunteerStatus.ACTIVE;

    return this.repo.save(volunteer);
  }

  /**
   * Opts a Volunteer in or out of hearing what happens to an animal after it
   * returns to MSPCA.
   *
   * @param id - The Volunteer's ID.
   * @param dto - Contains the new animalUpdates value.
   * @returns The updated Volunteer.
   * @throws {NotFoundException} If no Volunteer with the ID exists.
   */
  async updateAnimalUpdates(
    id: number,
    dto: UpdateAnimalUpdatesDto,
  ): Promise<FosterVolunteer> {
    const volunteer = await this.findByIdOrFail(id);

    volunteer.animalUpdates = dto.animalUpdates;

    return this.repo.save(volunteer);
  }

  /**
   * Fetches a Volunteer by ID, requiring that they are active.
   *
   * Returns the Volunteer so callers can reuse it instead of fetching again.
   *
   * @param id - The Volunteer's ID.
   * @returns The active Volunteer.
   * @throws {NotFoundException} If no Volunteer with the ID exists.
   * @throws {BadRequestException} If the Volunteer is not active.
   */
  async findActiveOrFail(id: number): Promise<FosterVolunteer> {
    const volunteer = await this.findByIdOrFail(id);

    if (volunteer.status !== VolunteerStatus.ACTIVE) {
      throw new BadRequestException(`Volunteer with ID ${id} is not active`);
    }

    return volunteer;
  }
}
