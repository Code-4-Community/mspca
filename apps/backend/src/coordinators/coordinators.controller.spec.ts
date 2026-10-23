import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CoordinatorsController } from './coordinators.controller';
import { CoordinatorsService } from './coordinators.service';
import { FosterCoordinator } from './coordinators.entity';
import { Homebase } from '../types';
import { CreateCoordinatorDto } from './dtos/create-coordinator.dto';
import { ConfirmCoordinatorDto } from './dtos/confirm-coordinator.dto';

describe('CoordinatorsController', () => {
  let controller: CoordinatorsController;
  let service: jest.Mocked<CoordinatorsService>;

  const dto = {
    firstName: 'Jane',
    lastName: 'Doe',
    phone: '+16175551234',
    secondaryPhone: null,
    email: 'jane.doe@mspca.org',
    password: 'Str0ng!Password',
    homebase: Homebase.BOSTON,
  } as CreateCoordinatorDto;

  const confirmDto = {
    email: 'jane.doe@mspca.org',
    code: '123456',
  } as ConfirmCoordinatorDto;

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
});
