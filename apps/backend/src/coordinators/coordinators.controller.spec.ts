import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CoordinatorsController } from './coordinators.controller';
import { CoordinatorsService } from './coordinators.service';
import { FosterCoordinator } from './coordinators.entity';
import { Homebase } from '../types';
import { CreateCoordinatorDto } from './dtos/create-coordinator.dto';

describe('CoordinatorsController', () => {
  let controller: CoordinatorsController;
  let service: jest.Mocked<CoordinatorsService>;

  const dto = {
    firstName: 'Jane',
    lastName: 'Doe',
    phone: '+16175551234',
    secondaryPhone: null,
    email: 'jane.doe@mspca.org',
    homebase: Homebase.BOSTON,
  } as CreateCoordinatorDto;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CoordinatorsController],
      providers: [
        {
          provide: CoordinatorsService,
          useValue: {
            create: jest.fn(),
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
    it('delegates creation to the service and returns the created coordinator', async () => {
      const created = {
        coordinatorId: 1,
        ...dto,
        active: true,
        cognitoSub: 'cognito-sub-123',
        assignedVolunteers: [],
      } as FosterCoordinator;

      service.create.mockResolvedValue(created);

      const result = await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toBe(created);
    });

    it('propagates ConflictException when coordinator already exists', async () => {
      service.create.mockRejectedValue(
        new ConflictException('A coordinator with this email already exists'),
      );

      await expect(controller.create(dto)).rejects.toThrow(ConflictException);

      expect(service.create).toHaveBeenCalledWith(dto);
    });

    it('propagates BadRequestException for invalid coordinator data', async () => {
      service.create.mockRejectedValue(
        new BadRequestException('Email must end in @mspca.org'),
      );

      await expect(controller.create(dto)).rejects.toThrow(BadRequestException);

      expect(service.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('deactivate', () => {
    it('calls service.deactivate with the parsed id', async () => {
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

    it('propagates BadRequestException when coordinator is already inactive', async () => {
      service.deactivate.mockRejectedValue(
        new BadRequestException('Coordinator with ID 1 is already inactive'),
      );

      await expect(controller.deactivate(1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException for an invalid coordinator id', async () => {
      await expect(controller.deactivate(0)).rejects.toThrow(
        BadRequestException,
      );

      expect(service.deactivate).not.toHaveBeenCalled();
    });
  });

  describe('activate', () => {
    it('calls service.activate with the parsed id', async () => {
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

    it('propagates BadRequestException when coordinator is already active', async () => {
      service.activate.mockRejectedValue(
        new BadRequestException('Coordinator with ID 1 is already active'),
      );

      await expect(controller.activate(1)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for an invalid coordinator id', async () => {
      await expect(controller.activate(-1)).rejects.toThrow(
        BadRequestException,
      );

      expect(service.activate).not.toHaveBeenCalled();
    });
  });
});
