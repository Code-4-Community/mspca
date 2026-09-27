import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CoordinatorsController } from './coordinators.controller';
import { CoordinatorsService } from './coordinators.service';

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
      providers: [
        {
          provide: CoordinatorsService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<CoordinatorsController>(CoordinatorsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('deactivate', () => {
    it('should call service.deactivate with the parsed id', async () => {
      const coordinator = { coordinatorId: 1, active: false };
      service.deactivate.mockResolvedValue(coordinator);

      const result = await controller.deactivate(1);

      expect(service.deactivate).toHaveBeenCalledWith(1);
      expect(result).toEqual(coordinator);
    });

    it('should throw BadRequestException for an invalid id', async () => {
      await expect(controller.deactivate(0)).rejects.toThrow(
        BadRequestException,
      );
      expect(service.deactivate).not.toHaveBeenCalled();
    });
  });

  describe('activate', () => {
    it('should call service.activate with the parsed id', async () => {
      const coordinator = { coordinatorId: 1, active: true };
      service.activate.mockResolvedValue(coordinator);

      const result = await controller.activate(1);

      expect(service.activate).toHaveBeenCalledWith(1);
      expect(result).toEqual(coordinator);
    });

    it('should throw BadRequestException for an invalid id', async () => {
      await expect(controller.activate(0)).rejects.toThrow(BadRequestException);
      expect(service.activate).not.toHaveBeenCalled();
    });
  });
});
