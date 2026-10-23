import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Reflector } from '@nestjs/core';
import { CoordinatorsController } from './coordinators.controller';
import { CoordinatorsService } from './coordinators.service';
import { FosterCoordinator } from './coordinators.entity';
import { Homebase } from '../types';
import { CreateCoordinatorDto } from './dtos/create-coordinator.dto';
import { ConfirmCoordinatorDto } from './dtos/confirm-coordinator.dto';
import { IS_PUBLIC_KEY } from '../aws/cognito/cognito.decorator';

describe('CoordinatorsController', () => {
  let controller: CoordinatorsController;
  let service: jest.Mocked<CoordinatorsService>;

  const dto: CreateCoordinatorDto = {
    firstName: 'Jane',
    lastName: 'Doe',
    phone: '+16175551234',
    secondaryPhone: null,
    email: 'jane.doe@mspca.org',
    password: 'Str0ng!Password',
    homebase: Homebase.BOSTON,
  };

  const confirmDto: ConfirmCoordinatorDto = {
    email: 'jane.doe@mspca.org',
    code: '123456',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CoordinatorsController],
      providers: [
        {
          provide: CoordinatorsService,
          useValue: {
            create: jest.fn(),
            confirm: jest.fn(),
            deactivate: jest.fn(),
            activate: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(CoordinatorsController);
    service = module.get(CoordinatorsService);
  });

  describe('create', () => {
    it('delegates creation to the service', async () => {
      const profile = {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        secondaryPhone: dto.secondaryPhone,
        email: dto.email,
        homebase: dto.homebase,
      };

      const created = {
        coordinatorId: 1,
        ...profile,
        active: true,
        cognitoSub: 'cognito-sub-123',
        assignedVolunteers: [],
      } as FosterCoordinator;

      service.create.mockResolvedValue(created);

      const result = await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toBe(created);
    });

    it('propagates service errors', async () => {
      const error = new Error('Service failure');
      service.create.mockRejectedValue(error);

      await expect(controller.create(dto)).rejects.toBe(error);
    });

    it('is marked public', () => {
      const reflector = new Reflector();

      expect(reflector.get(IS_PUBLIC_KEY, controller.create)).toBe(true);
    });
  });

  describe('confirm', () => {
    it('delegates confirmation to the service', async () => {
      service.confirm.mockResolvedValue(undefined);

      await controller.confirm(confirmDto);

      expect(service.confirm).toHaveBeenCalledWith(confirmDto);
    });

    it('propagates service errors', async () => {
      const error = new Error('Invalid code');
      service.confirm.mockRejectedValue(error);

      await expect(controller.confirm(confirmDto)).rejects.toBe(error);
    });

    it('is marked public', () => {
      const reflector = new Reflector();

      expect(reflector.get(IS_PUBLIC_KEY, controller.confirm)).toBe(true);
    });
  });

  describe('deactivate', () => {
    it('deactivates the coordinator', async () => {
      const coordinator = {
        coordinatorId: 1,
        active: false,
      } as FosterCoordinator;

      service.deactivate.mockResolvedValue(coordinator);

      const result = await controller.deactivate(1);

      expect(service.deactivate).toHaveBeenCalledWith(1);
      expect(result).toEqual(coordinator);
    });

    it('rejects invalid IDs', async () => {
      await expect(controller.deactivate(0)).rejects.toThrow(
        BadRequestException,
      );

      expect(service.deactivate).not.toHaveBeenCalled();
    });
  });

  describe('activate', () => {
    it('activates the coordinator', async () => {
      const coordinator = {
        coordinatorId: 1,
        active: true,
      } as FosterCoordinator;

      service.activate.mockResolvedValue(coordinator);

      const result = await controller.activate(1);

      expect(service.activate).toHaveBeenCalledWith(1);
      expect(result).toEqual(coordinator);
    });

    it('rejects invalid IDs', async () => {
      await expect(controller.activate(-1)).rejects.toThrow(
        BadRequestException,
      );

      expect(service.activate).not.toHaveBeenCalled();
    });
  });

  describe('DTO validation', () => {
    it('rejects a non-MSPCA email', async () => {
      const instance = plainToInstance(CreateCoordinatorDto, {
        ...dto,
        email: 'jane.doe@gmail.com',
      });

      const errors = await validate(instance);

      expect(errors.some((error) => error.property === 'email')).toBe(true);
    });

    it('normalizes MSPCA email addresses', async () => {
      const instance = plainToInstance(CreateCoordinatorDto, {
        ...dto,
        email: ' JANE.DOE@MSPCA.ORG ',
      });

      expect(instance.email).toBe('jane.doe@mspca.org');
      expect(await validate(instance)).toHaveLength(0);
    });

    it('rejects weak passwords', async () => {
      const instance = plainToInstance(CreateCoordinatorDto, {
        ...dto,
        password: 'password',
      });

      const errors = await validate(instance);

      expect(errors.some((error) => error.property === 'password')).toBe(true);
    });

    it('rejects invalid verification codes', async () => {
      const instance = plainToInstance(ConfirmCoordinatorDto, {
        email: dto.email,
        code: '123',
      });

      const errors = await validate(instance);

      expect(errors.some((error) => error.property === 'code')).toBe(true);
    });
  });
});
