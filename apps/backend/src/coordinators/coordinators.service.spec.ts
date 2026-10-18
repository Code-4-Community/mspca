import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CoordinatorsService } from './coordinators.service';
import { FosterCoordinator } from './coordinators.entity';
import { FosterVolunteer } from '../volunteers/volunteers.entity';
import { CognitoService } from '../aws/cognito/cognito.service';
import { CognitoRole } from '../aws/cognito/cognito.types';
import { Homebase } from '../types';
import { CreateCoordinatorDto } from './dtos/create-coordinator.dto';

describe('CoordinatorsService', () => {
  let service: CoordinatorsService;
  let repo: jest.Mocked<Repository<FosterCoordinator>>;
  let volunteerRepo: jest.Mocked<Repository<FosterVolunteer>>;
  let cognitoService: jest.Mocked<CognitoService>;

  const dto: CreateCoordinatorDto = {
    firstName: 'Jane',
    lastName: 'Doe',
    phone: '+16175551234',
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
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(FosterVolunteer),
          useValue: {
            update: jest.fn(),
            find: jest.fn(),
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

    service = module.get(CoordinatorsService);
    repo = module.get(getRepositoryToken(FosterCoordinator));
    volunteerRepo = module.get(getRepositoryToken(FosterVolunteer));
    cognitoService = module.get(CognitoService);

    repo.findOneBy.mockResolvedValue(null);
    cognitoService.createUser.mockResolvedValue('cognito-sub-123');
    cognitoService.deleteUser.mockResolvedValue(undefined);
    volunteerRepo.find.mockResolvedValue([]);
  });

  describe('create', () => {
    const created = {
      coordinatorId: 1,
      ...dto,
      active: true,
      assignedVolunteers: [],
      cognitoSub: 'cognito-sub-123',
    } as FosterCoordinator;

    beforeEach(() => {
      repo.create.mockReturnValue({ ...created });
      repo.save.mockResolvedValue({ ...created });
    });

    it('creates the Cognito user and saves the coordinator', async () => {
      const result = await service.create(dto);

      expect(repo.findOneBy).toHaveBeenCalledWith({
        email: dto.email,
      });

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

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          email: dto.email,
          cognitoSub: 'cognito-sub-123',
        }),
      );

      expect(result.cognitoSub).toBe('cognito-sub-123');
      expect(result.active).toBe(true);
    });

    it('normalizes the email before checking and saving', async () => {
      const uppercaseDto = {
        ...dto,
        email: '  JANE.DOE@MSPCA.ORG  ',
      };

      await service.create(uppercaseDto);

      expect(repo.findOneBy).toHaveBeenCalledWith({
        email: 'jane.doe@mspca.org',
      });

      expect(cognitoService.createUser).toHaveBeenCalledWith({
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: 'jane.doe@mspca.org',
        role: CognitoRole.FosterCoordinator,
      });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'jane.doe@mspca.org',
        }),
      );
    });

    it('throws BadRequestException for a non-MSPCA email', async () => {
      const invalidDto = {
        ...dto,
        email: 'jane.doe@gmail.com',
      };

      await expect(service.create(invalidDto)).rejects.toThrow(
        BadRequestException,
      );

      expect(repo.findOneBy).not.toHaveBeenCalled();
      expect(cognitoService.createUser).not.toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('throws ConflictException if the coordinator already exists', async () => {
      repo.findOneBy.mockResolvedValue({
        email: dto.email,
      } as FosterCoordinator);

      await expect(service.create(dto)).rejects.toThrow(ConflictException);

      expect(cognitoService.createUser).not.toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('does not save if Cognito user creation fails', async () => {
      cognitoService.createUser.mockRejectedValue(
        new ConflictException('A user with this email already exists'),
      );

      await expect(service.create(dto)).rejects.toThrow(ConflictException);

      expect(repo.create).not.toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
      expect(volunteerRepo.update).not.toHaveBeenCalled();
    });

    it('deletes the Cognito user if saving the coordinator fails', async () => {
      repo.save.mockRejectedValue(new Error('Database error'));

      await expect(service.create(dto)).rejects.toThrow(
        InternalServerErrorException,
      );

      expect(cognitoService.deleteUser).toHaveBeenCalledWith(dto.email);

      expect(volunteerRepo.update).not.toHaveBeenCalled();
    });

    it('throws InternalServerErrorException if database save and Cognito cleanup fail', async () => {
      repo.save.mockRejectedValue(new Error('Database error'));
      cognitoService.deleteUser.mockRejectedValue(
        new Error('Cognito cleanup failed'),
      );

      await expect(service.create(dto)).rejects.toThrow(
        InternalServerErrorException,
      );

      expect(cognitoService.deleteUser).toHaveBeenCalledWith(dto.email);
    });

    it('assigns unassigned volunteers from the same homebase', async () => {
      const volunteers = [
        {
          volunteerId: 1,
          homebase: Homebase.BOSTON,
        },
        {
          volunteerId: 2,
          homebase: Homebase.BOSTON,
        },
      ] as FosterVolunteer[];

      volunteerRepo.find.mockResolvedValue(volunteers);

      const result = await service.create(dto);

      expect(volunteerRepo.update).toHaveBeenCalledWith(
        {
          homebase: dto.homebase,
          assignedCoordinator: expect.anything(),
        },
        {
          assignedCoordinator: expect.objectContaining({
            coordinatorId: 1,
          }),
        },
      );

      expect(volunteerRepo.find).toHaveBeenCalledWith({
        where: {
          assignedCoordinator: {
            coordinatorId: 1,
          },
        },
      });

      expect(result.assignedVolunteers).toEqual(volunteers);
    });

    it('does not overwrite existing volunteer assignments', async () => {
      await service.create(dto);

      expect(volunteerRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({
          homebase: Homebase.BOSTON,
          assignedCoordinator: expect.anything(),
        }),
        expect.objectContaining({
          assignedCoordinator: expect.objectContaining({
            coordinatorId: 1,
          }),
        }),
      );
    });

    it('propagates an error if volunteer assignment fails', async () => {
      volunteerRepo.update.mockRejectedValue(
        new Error('Failed to assign volunteers'),
      );

      await expect(service.create(dto)).rejects.toThrow(
        'Failed to assign volunteers',
      );

      expect(repo.save).toHaveBeenCalled();
      expect(cognitoService.deleteUser).not.toHaveBeenCalled();
    });
  });

  describe('findByIdOrFail', () => {
    it('returns the coordinator when one with the id exists', async () => {
      const coordinator = {
        coordinatorId: 7,
      } as FosterCoordinator;

      repo.findOne.mockResolvedValue(coordinator);

      const result = await service.findByIdOrFail(7);

      expect(result).toBe(coordinator);
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { coordinatorId: 7 },
      });
    });

    it('throws NotFoundException when no coordinator exists', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findByIdOrFail(7)).rejects.toThrow(
        new NotFoundException('Coordinator with ID 7 not found'),
      );

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { coordinatorId: 7 },
      });
    });
  });

  describe('deactivate', () => {
    it('sets active to false, saves, and does not delete the coordinator', async () => {
      const coordinator = {
        coordinatorId: 1,
        active: true,
      } as FosterCoordinator;

      repo.findOne.mockResolvedValue(coordinator);
      repo.save.mockResolvedValue({
        ...coordinator,
        active: false,
      });

      const result = await service.deactivate(1);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { coordinatorId: 1 },
      });

      expect(repo.save).toHaveBeenCalledWith({
        ...coordinator,
        active: false,
      });

      expect(result.active).toBe(false);
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException if coordinator does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.deactivate(999)).rejects.toThrow(
        new NotFoundException('Coordinator with ID 999 not found'),
      );

      expect(repo.save).not.toHaveBeenCalled();
    });

    it('throws BadRequestException if coordinator is already inactive', async () => {
      const coordinator = {
        coordinatorId: 1,
        active: false,
      } as FosterCoordinator;

      repo.findOne.mockResolvedValue(coordinator);

      await expect(service.deactivate(1)).rejects.toThrow(
        new BadRequestException('Coordinator with ID 1 is already inactive'),
      );

      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('activate', () => {
    it('sets active to true and saves the coordinator', async () => {
      const coordinator = {
        coordinatorId: 1,
        active: false,
      } as FosterCoordinator;

      repo.findOne.mockResolvedValue(coordinator);
      repo.save.mockResolvedValue({
        ...coordinator,
        active: true,
      });

      const result = await service.activate(1);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { coordinatorId: 1 },
      });

      expect(repo.save).toHaveBeenCalledWith({
        ...coordinator,
        active: true,
      });

      expect(result.active).toBe(true);
    });

    it('throws NotFoundException if coordinator does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.activate(999)).rejects.toThrow(
        new NotFoundException('Coordinator with ID 999 not found'),
      );

      expect(repo.save).not.toHaveBeenCalled();
    });

    it('throws BadRequestException if coordinator is already active', async () => {
      const coordinator = {
        coordinatorId: 1,
        active: true,
      } as FosterCoordinator;

      repo.findOne.mockResolvedValue(coordinator);

      await expect(service.activate(1)).rejects.toThrow(
        new BadRequestException('Coordinator with ID 1 is already active'),
      );

      expect(repo.save).not.toHaveBeenCalled();
    });
  });
});
