import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Owner } from './owners.entity';
import { CreateOwnerDto } from './dtos/create-owner.dto';
import { CognitoService } from '../aws/cognito/cognito.service';
import { CognitoRole } from '../aws/cognito/cognito.types';

@Injectable()
export class OwnersService {
  private readonly logger = new Logger(OwnersService.name);

  constructor(
    @InjectRepository(Owner)
    private repo: Repository<Owner>,
    private cognitoService: CognitoService,
  ) {}

  /**
   * Creates an owner in Cognito and saves their profile.
   * Cognito emails the owner a temporary password, and they are active immediately.
   *
   * @param dto - The owner's information.
   * @returns The newly created owner.
   * @throws {ConflictException} If an owner with the email already exists in the database or Cognito.
   * @throws {InternalServerErrorException} If the Cognito user could not be created or added to the group, or saving the owner to the database fails (the Cognito user is deleted).
   */
  async create(dto: CreateOwnerDto): Promise<Owner> {
    const { email } = dto;

    const existing = await this.repo.findOneBy({ email });

    if (existing) {
      throw new ConflictException('An owner with this email already exists');
    }

    const cognitoSub = await this.cognitoService.createUser({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email,
      role: CognitoRole.Owner,
    });

    try {
      return await this.repo.save({
        ...dto,
        active: true,
        cognitoSub,
      });
    } catch (error) {
      this.logger.error(`Failed to save owner ${email}`, error);

      try {
        await this.cognitoService.deleteUser(email);
      } catch {
        this.logger.error(
          `Created Cognito user ${cognitoSub} for ${email}, but failed to save the owner or delete the Cognito user`,
        );
      }

      throw new InternalServerErrorException('Failed to save the owner');
    }
  }

  /**
   * Fetches the owner who owns a Cognito account. Used to look up the
   * signed-in user from their token.
   *
   * @param cognitoSub - The `sub` claim from the user's Cognito access token.
   * @returns The owner.
   * @throws {NotFoundException} If no owner has this Cognito sub.
   */
  async findByCognitoSubOrFail(cognitoSub: string): Promise<Owner> {
    // Older rows default to an empty sub, so never match on ''.
    if (!cognitoSub) {
      throw new NotFoundException('Owner not found');
    }

    const owner = await this.repo.findOneBy({ cognitoSub });

    if (!owner) {
      throw new NotFoundException('Owner not found');
    }

    return owner;
  }
}
