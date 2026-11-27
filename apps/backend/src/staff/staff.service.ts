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
import { FosterStaff } from './staff.entity';
import { CreateStaffDto } from './dtos/create-staff.dto';
import { ConfirmStaffDto } from './dtos/confirm-staff.dto';
import { CognitoService } from '../aws/cognito/cognito.service';
import { CognitoRole } from '../aws/cognito/cognito.types';
import { CoordinatorsService } from '../coordinators/coordinators.service';
import { EmailsService } from '../aws/ses/email.service';
import { coordinatorGainedStaffEmail } from '../coordinators/emails/coordinatorGainedStaff';

@Injectable()
export class StaffService {
  private readonly logger = new Logger(StaffService.name);

  constructor(
    @InjectRepository(FosterStaff)
    private repo: Repository<FosterStaff>,
    private cognitoService: CognitoService,
    private coordinatorsService: CoordinatorsService,
    private emailsService: EmailsService,
  ) {}

  /**
   * Registers a staff member with Cognito and saves their profile.
   * Staff are active immediately and do not require approval.
   * Coordinator assignments are left empty for now.
   *
   * @param dto - The staff member's registration information.
   * @returns The newly created staff member.
   * @throws {ConflictException} If a staff member with the email already exists in the database.
   * @throws {BadRequestException} If Cognito rejects the registration request.
   * @throws {InternalServerErrorException} If saving the staff member to the database fails (the Cognito user is deleted).
   */
  async create(dto: CreateStaffDto): Promise<FosterStaff> {
    const { password, ...profile } = dto;
    const { email } = profile;

    const existing = await this.repo.findOneBy({ email });

    if (existing) {
      throw new ConflictException(
        'A staff member with this email already exists',
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
        active: true,
        mostRecentWaiverSigned: true,
        cognitoSub,
        assignedCoordinators: [],
      });
    } catch (error) {
      this.logger.error(`Failed to save staff member ${email}`, error);

      try {
        await this.cognitoService.deleteUser(email);
      } catch {
        this.logger.error(
          `Created Cognito user ${cognitoSub} for ${email}, but failed to save the staff member or delete the Cognito user`,
        );
      }

      throw new InternalServerErrorException('Failed to save the staff member');
    }
  }

  /**
   * Confirms a staff member's email and assigns the Staff Cognito role.
   *
   * @param dto - The staff member's email and verification code.
   * @returns A promise that resolves when confirmation is complete.
   * @throws {NotFoundException} If no staff member exists with the given email in the database.
   * @throws {BadRequestException} If Cognito rejects the verification code or confirmation request.
   * @throws {InternalServerErrorException} If Cognito fails to complete the confirmation.
   */
  async confirm(dto: ConfirmStaffDto): Promise<void> {
    const { email } = dto;

    const staff = await this.repo.findOneBy({ email });

    if (!staff) {
      throw new NotFoundException('No staff member with this email exists');
    }

    await this.cognitoService.confirmUser(email, dto.code, CognitoRole.Staff);
  }

  /**
   * Fetches a staff member by their ID, including their assigned coordinators.
   *
   * @param id - The ID of the staff member to retrieve.
   * @returns The staff member with their assigned coordinators.
   * @throws {NotFoundException} If no staff member exists with the given ID.
   */
  async findByIdOrFail(id: number): Promise<FosterStaff> {
    const staff = await this.repo.findOne({
      where: { staffId: id },
      relations: ['assignedCoordinators'],
    });

    if (!staff) {
      throw new NotFoundException(`Staff member with ID ${id} not found`);
    }

    return staff;
  }

  /**
   * Fetches a staff member by their ID and verifies they are active.
   *
   * @param id - The ID of the staff member to retrieve.
   * @returns The staff member.
   * @throws {NotFoundException} If no staff member exists with the given ID.
   * @throws {BadRequestException} If the staff member is not active.
   */
  async findActiveOrFail(id: number): Promise<FosterStaff> {
    const staff = await this.findByIdOrFail(id);

    if (!staff.active) {
      throw new BadRequestException(`Staff member with ID ${id} is not active`);
    }

    return staff;
  }

  /**
   * Fetches a staff member by their Cognito sub, including their assigned
   * coordinators. Used to look up the signed-in user from their token.
   *
   * @param cognitoSub - The `sub` claim from the user's Cognito access token.
   * @returns The staff member.
   * @throws {NotFoundException} If no staff member has this Cognito sub.
   */
  async findByCognitoSubOrFail(cognitoSub: string): Promise<FosterStaff> {
    if (!cognitoSub) {
      throw new NotFoundException('Staff member not found');
    }

    const staff = await this.repo.findOne({
      where: { cognitoSub },
      relations: ['assignedCoordinators'],
    });

    if (!staff) {
      throw new NotFoundException('Staff member not found');
    }

    return staff;
  }

  /**
   * Deactivates an active staff member.
   *
   * @param id - The ID of the staff member to deactivate.
   * @returns The updated staff member.
   * @throws {NotFoundException} If the staff member does not exist.
   * @throws {BadRequestException} If the staff member is already inactive.
   */
  async deactivate(id: number): Promise<FosterStaff> {
    const staff = await this.findByIdOrFail(id);

    if (!staff.active) {
      throw new BadRequestException(
        `Staff member with ID ${id} is already inactive`,
      );
    }

    staff.active = false;

    return this.repo.save(staff);
  }

  /**
   * Reactivates an inactive staff member.
   *
   * @param id - The ID of the staff member to activate.
   * @returns The updated staff member.
   * @throws {NotFoundException} If the staff member does not exist.
   * @throws {BadRequestException} If the staff member is already active.
   */
  async activate(id: number): Promise<FosterStaff> {
    const staff = await this.findByIdOrFail(id);

    if (staff.active) {
      throw new BadRequestException(
        `Staff member with ID ${id} is already active`,
      );
    }

    staff.active = true;

    return this.repo.save(staff);
  }

  /**
   * Assigns foster coordinators to a staff member and emails the newly
   * assigned coordinators.
   *
   * Coordinators are added to the existing list, not replaced. Homebase does
   * not matter. The email is best-effort: a failed send is logged rather than
   * failing the request, since the assignment is already saved.
   *
   * @param id - The ID of the staff member.
   * @param coordinatorIds - The IDs of the coordinators to assign.
   * @returns The staff member with their updated assigned coordinators.
   * @throws {NotFoundException} If the staff member or any coordinator does not exist.
   * @throws {BadRequestException} If the staff member is inactive, or any coordinator is inactive or is already assigned to the staff member.
   */
  async assignCoordinators(
    id: number,
    coordinatorIds: number[],
  ): Promise<FosterStaff> {
    const [staff, coordinators] = await Promise.all([
      this.findActiveOrFail(id),
      this.coordinatorsService.findActiveByIdsOrFail(coordinatorIds),
    ]);

    const assignedIds = new Set(
      staff.assignedCoordinators.map((c) => c.coordinatorId),
    );
    const alreadyAssigned = coordinatorIds.filter((coordinatorId) =>
      assignedIds.has(coordinatorId),
    );

    if (alreadyAssigned.length > 0) {
      throw new BadRequestException(
        `Coordinators with IDs already assigned to staff member ${id}: ${alreadyAssigned.join(
          ', ',
        )}`,
      );
    }

    staff.assignedCoordinators.push(...coordinators);
    const saved = await this.repo.save(staff);

    const email = coordinatorGainedStaffEmail(saved);

    try {
      await this.emailsService.sendEmail({
        toEmail: process.env.AWS_SES_SENDER_EMAIL ?? '',
        ccEmails: coordinators.map((c) => c.email),
        ...email,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send "${
          email.subject
        }" email for staff member: { staffId: ${id}, coordinatorIds: [${coordinatorIds.join(
          ', ',
        )}] }`,
        error,
      );
    }

    return saved;
  }
}
