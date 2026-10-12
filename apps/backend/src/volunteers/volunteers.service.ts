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
import { FosterVolunteer } from './volunteers.entity';
import { VolunteerStatus } from './volunteers.types';
import { CreateVolunteerDto } from './dto/create-volunteer.dto';
import { ConfirmVolunteerDto } from './dto/confirm-volunteer.dto';
import { UpdateVolunteerDto } from './dto/update-volunteer.dto';
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
   * Signs up a Volunteer account.
   *
   * The Cognito user is registered first; the Postgres row is only saved once
   * that succeeds, so a Cognito failure never leaves a Volunteer without a login.
   * If the save fails, the Cognito user is deleted so the email can be reused.
   * Cognito emails the Volunteer a verification code, which they pass to
   * {@link confirm}. New Volunteers are pending until a coordinator approves them.
   *
   * @param dto - The Volunteer's profile fields and chosen password.
   * @returns The saved Volunteer.
   * @throws {ConflictException} If a Volunteer or Cognito user with the email already exists.
   * @throws {BadRequestException} If Cognito rejects the password.
   * @throws {InternalServerErrorException} If the Cognito user could not be registered.
   * @throws {InternalServerErrorException} If the Volunteer could not be saved (the Cognito user is deleted).
   */
  async create(dto: CreateVolunteerDto): Promise<FosterVolunteer> {
    // The password only goes to Cognito; keep it out of the saved and returned Volunteer.
    const { password, ...profile } = dto;
    const email = profile.email.toLowerCase();

    const existing = await this.repo.findOneBy({ email });
    if (existing) {
      throw new ConflictException('A volunteer with this email already exists');
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
        status: VolunteerStatus.PENDING,
        mostRecentWaiverSigned: true,
        cognitoSub,
      });
    } catch (error) {
      this.logger.error(`Failed to save Volunteer ${email}`, error);
      await this.cognitoService
        .deleteUser(email)
        .catch(() =>
          this.logger.error(
            `Created Cognito user ${cognitoSub} for ${email} but failed to save the Volunteer or delete the Cognito user`,
          ),
        );
      throw new InternalServerErrorException('Failed to save the Volunteer');
    }
  }

  /**
   * Confirms a signed-up Volunteer's email and gives them the FosterVolunteer role.
   *
   * Only emails with a Volunteer row can be confirmed. The app client is public,
   * so this stops someone who signed up directly with Cognito (skipping
   * {@link create}) from getting the role without a Volunteer profile.
   *
   * @param dto - The Volunteer's email and the verification code Cognito emailed them.
   * @throws {NotFoundException} If no Volunteer or Cognito user with the email exists.
   * @throws {BadRequestException} If the code is wrong or has expired.
   * @throws {ConflictException} If the Cognito user can't be confirmed, e.g. they already are.
   * @throws {InternalServerErrorException} If confirmation or adding the role fails.
   */
  async confirm(dto: ConfirmVolunteerDto): Promise<void> {
    const email = dto.email.toLowerCase();

    const volunteer = await this.repo.findOneBy({ email });
    if (!volunteer) {
      throw new NotFoundException('No volunteer with this email exists');
    }

    await this.cognitoService.confirmUser(
      email,
      dto.code,
      CognitoRole.FosterVolunteer,
    );
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

  /**
   * Gets a single foster volunteer by ID.
   * Includes the volunteer's assigned coordinator.
   * @param id - ID of the volunteer to get
   * @returns The volunteer with the given ID
   * @throws NotFoundException if no volunteer exists with the given ID
   */
  async getVolunteerById(id: number): Promise<FosterVolunteer> {
    return this.findByIdOrFail(id);
  }

  /**
   * Updates a foster volunteer by ID.
   * Only the fields included in the DTO are changed; all other fields keep their current values.
   * @param id - ID of the volunteer to update
   * @param dto - The fields to update
   * @returns The updated volunteer
   * @throws NotFoundException if no volunteer exists with the given ID
   */
  async updateVolunteerById(
    id: number,
    dto: UpdateVolunteerDto,
  ): Promise<FosterVolunteer> {
    const volunteer = await this.findByIdOrFail(id);
    Object.assign(volunteer, dto);
    return this.repo.save(volunteer);
  }
}
