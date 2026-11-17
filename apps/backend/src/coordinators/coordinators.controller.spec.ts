import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CoordinatorsController } from './coordinators.controller';
import { CoordinatorsService } from './coordinators.service';
import { FosterCoordinator } from './coordinators.entity';
import { Homebase } from '../types';
import { CreateCoordinatorDto } from './dtos/create-coordinator.dto';
import { ConfirmCoordinatorDto } from './dtos/confirm-coordinator.dto';

describe('CoordinatorsController', () => {
  let controller: CoordinatorsController;
  let service: {
    create: jest.Mock;
    confirm: jest.Mock;
    deactivate: jest.Mock;
    activate: jest.Mock;
  };

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
    service = {
      create: jest.fn(),
      confirm: jest.fn(),
      deactivate: jest.fn(),
      activate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CoordinatorsController],
      providers: [{ provide: CoordinatorsService, useValue: service }],
    }).compile();

    controller = module.get<CoordinatorsController>(CoordinatorsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
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
    it('should call service.deactivate with the parsed id', async () => {
      const coordinator = {
        coordinatorId: 1,
        active: false,
      } as FosterCoordinator;
      service.deactivate.mockResolvedValue(coordinator);

      const result = await controller.deactivate(1);

      expect(service.deactivate).toHaveBeenCalledWith(1);
      expect(result).toEqual(coordinator);
    });

    it('propagates NotFoundException thrown by the service', async () => {
      service.deactivate.mockRejectedValue(
        new NotFoundException('Coordinator with ID 999 not found'),
      );

      await expect(controller.deactivate(999)).rejects.toThrow(
        new NotFoundException('Coordinator with ID 999 not found'),
      );
    });
  });

  describe('activate', () => {
    it('should call service.activate with the parsed id', async () => {
      const coordinator = {
        coordinatorId: 1,
        active: true,
      } as FosterCoordinator;
      service.activate.mockResolvedValue(coordinator);

      const result = await controller.activate(1);

      expect(service.activate).toHaveBeenCalledWith(1);
      expect(result).toEqual(coordinator);
    });

    it('propagates NotFoundException thrown by the service', async () => {
      service.activate.mockRejectedValue(
        new NotFoundException('Coordinator with ID 999 not found'),
      );

      await expect(controller.activate(999)).rejects.toThrow(
        new NotFoundException('Coordinator with ID 999 not found'),
      );
    });
  });
});
