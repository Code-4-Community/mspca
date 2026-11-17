import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OwnersService } from './owners.service';
import { Owner } from './owners.entity';
import { CreateOwnerDto } from './dtos/create-owner.dto';
import { CognitoService } from '../aws/cognito/cognito.service';
import { CognitoRole } from '../aws/cognito/cognito.types';

describe('OwnersService', () => {
  let service: OwnersService;
  let repo: jest.Mocked<Repository<Owner>>;
  let cognitoService: jest.Mocked<CognitoService>;
  let loggerSpy: jest.SpyInstance;

  const dto = {
    firstName: 'Jane',
    lastName: 'Doe',
    phone: '+16175551234',
    secondaryPhone: null,
    email: 'jane.doe@mspca.org',
  } as CreateOwnerDto;

  const owner = {
    ownerId: 1,
    ...dto,
    active: true,
    cognitoSub: 'cognito-sub-123',
  } as Owner;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OwnersService,
        {
          provide: getRepositoryToken(Owner),
          useValue: {
            findOneBy: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: CognitoService,
          useValue: {
            createUser: jest.fn(),
            deleteUser: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(OwnersService);
    repo = module.get(getRepositoryToken(Owner));
    cognitoService = module.get(CognitoService);

    loggerSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('creates the Cognito user with the Owner role before saving', async () => {
      repo.findOneBy.mockResolvedValue(null);
      cognitoService.createUser.mockResolvedValue('cognito-sub-123');
      repo.save.mockResolvedValue(owner);

      const result = await service.create(dto);

      expect(repo.findOneBy).toHaveBeenCalledWith({ email: dto.email });

      expect(cognitoService.createUser).toHaveBeenCalledWith({
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        role: CognitoRole.Owner,
      });

      expect(repo.save).toHaveBeenCalledWith({
        ...dto,
        active: true,
        cognitoSub: 'cognito-sub-123',
      });

      expect(result).toBe(owner);
    });

    it('rejects duplicate owners', async () => {
      repo.findOneBy.mockResolvedValue(owner);

      await expect(service.create(dto)).rejects.toThrow(
        new ConflictException('An owner with this email already exists'),
      );

      expect(cognitoService.createUser).not.toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('deletes the Cognito user when saving fails and logs the error', async () => {
      const databaseError = new Error('Database error');

      repo.findOneBy.mockResolvedValue(null);
      cognitoService.createUser.mockResolvedValue('sub-123');
      repo.save.mockRejectedValue(databaseError);
      cognitoService.deleteUser.mockResolvedValue(undefined);

      await expect(service.create(dto)).rejects.toThrow(
        new InternalServerErrorException('Failed to save the owner'),
      );

      expect(cognitoService.deleteUser).toHaveBeenCalledWith(dto.email);

      expect(loggerSpy).toHaveBeenCalledWith(
        `Failed to save owner ${dto.email}`,
        databaseError,
      );
    });

    it('returns a server error and logs when Cognito cleanup fails', async () => {
      const databaseError = new Error('Database error');

      repo.findOneBy.mockResolvedValue(null);
      cognitoService.createUser.mockResolvedValue('sub-123');
      repo.save.mockRejectedValue(databaseError);
      cognitoService.deleteUser.mockRejectedValue(new Error('Cleanup failed'));

      await expect(service.create(dto)).rejects.toThrow(
        new InternalServerErrorException('Failed to save the owner'),
      );

      expect(cognitoService.deleteUser).toHaveBeenCalledWith(dto.email);

      expect(loggerSpy).toHaveBeenCalledWith(
        `Failed to save owner ${dto.email}`,
        databaseError,
      );

      expect(loggerSpy).toHaveBeenCalledWith(
        `Created Cognito user sub-123 for ${dto.email}, but failed to save the owner or delete the Cognito user`,
      );
    });
  });
});
