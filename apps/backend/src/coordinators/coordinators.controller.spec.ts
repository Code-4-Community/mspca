import { Test, TestingModule } from '@nestjs/testing';
import { CoordinatorsController } from './coordinators.controller';
import { CoordinatorsService } from './coordinators.service';
import { FosterCoordinator } from './coordinators.entity';

describe('CoordinatorsController', () => {
  let controller: CoordinatorsController;
  let service: { setActive: jest.Mock };

  beforeEach(async () => {
    service = { setActive: jest.fn() };

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
    it('should call service.setActive(id, false) with the parsed id', async () => {
      const coordinator = {
        coordinatorId: 1,
        active: false,
      } as FosterCoordinator;
      service.setActive.mockResolvedValue(coordinator);

      const result = await controller.deactivate(1);

      expect(service.setActive).toHaveBeenCalledWith(1, false);
      expect(result).toEqual(coordinator);
    });
  });

  describe('activate', () => {
    it('should call service.setActive(id, true) with the parsed id', async () => {
      const coordinator = {
        coordinatorId: 1,
        active: true,
      } as FosterCoordinator;
      service.setActive.mockResolvedValue(coordinator);

      const result = await controller.activate(1);

      expect(service.setActive).toHaveBeenCalledWith(1, true);
      expect(result).toEqual(coordinator);
    });
  });
});
