import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CoordinatorsController } from './coordinators.controller';
import { CoordinatorsService } from './coordinators.service';
import { FosterCoordinator } from './coordinators.entity';

describe('CoordinatorsController', () => {
  let controller: CoordinatorsController;
  let service: { deactivate: jest.Mock; activate: jest.Mock };

  beforeEach(async () => {
    service = {
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
