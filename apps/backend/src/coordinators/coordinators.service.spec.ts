import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CoordinatorsService } from './coordinators.service';
import { FosterCoordinator } from './coordinators.entity';
import { CognitoService } from '../aws/cognito/cognito.service';
import { CognitoRole } from '../aws/cognito/cognito.types';
import { Homebase } from '../types';
import { CreateCoordinatorDto } from './dtos/create-coordinator.dto';

describe('CoordinatorsService', () => {
  let service: CoordinatorsService;
  let repo: jest.Mocked<Repository<FosterCoordinator>>;
  let cognitoService: jest.Mocked<CognitoService>;

  const dto: CreateCoordinatorDto = {
    firstName: 'Jane',
    lastName: 'Doe',
    phone: '555-555-5555',
    secondaryPhone: null,
    email: 'jane.doe@mspca.org',
    homebase: Homebase.BOSTON,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoordinatorsService,
        {
          provide: getRepositoryToken(FosterCoordinator),
          useValue: {
            findOneBy: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: CognitoService,
          useValue: {
            createUser: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(CoordinatorsService);
    repo = module.get(getRepositoryToken(FosterCoordinator));
    cognitoService = module.get(CognitoService);
  });

  it('creates the Cognito user, then saves a coordinator with the returned sub', async () => {
    repo.findOneBy.mockResolvedValue(null);
    cognitoService.createUser.mockResolvedValue('cognito-sub-123');
    const created = {
      coordinatorId: 1,
      ...dto,
      active: true,
      assignedVolunteers: [],
      cognitoSub: 'cognito-sub-123',
    };
    repo.create.mockReturnValue(created as FosterCoordinator);
    repo.save.mockResolvedValue(created as FosterCoordinator);

    const result = await service.create(dto);

    expect(cognitoService.createUser).toHaveBeenCalledWith({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      role: CognitoRole.FosterCoordinator,
    });
    expect(repo.create).toHaveBeenCalledWith({
      ...dto,
      active: true,
      assignedVolunteers: [],
      cognitoSub: 'cognito-sub-123',
    });
    expect(repo.save).toHaveBeenCalled();
    expect(result.cognitoSub).toBe('cognito-sub-123');
  });

  it('throws and does not save if a coordinator with the email already exists in Postgres', async () => {
    repo.findOneBy.mockResolvedValue({
      email: dto.email,
    } as FosterCoordinator);

    await expect(service.create(dto)).rejects.toThrow(ConflictException);
    expect(cognitoService.createUser).not.toHaveBeenCalled();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('does not create a Postgres row if the Cognito call fails', async () => {
    repo.findOneBy.mockResolvedValue(null);
    cognitoService.createUser.mockRejectedValue(
      new ConflictException('A user with this email already exists'),
    );

    await expect(service.create(dto)).rejects.toThrow(ConflictException);
    expect(repo.create).not.toHaveBeenCalled();
    expect(repo.save).not.toHaveBeenCalled();
  });
});
