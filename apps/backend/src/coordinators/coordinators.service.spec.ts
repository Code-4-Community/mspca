import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { CoordinatorsService } from './coordinators.service';
import { FosterCoordinator } from './coordinators.entity';

describe('CoordinatorsService', () => {
  let service: CoordinatorsService;
  let repo: { findOne: jest.Mock; save: jest.Mock; delete: jest.Mock };

  beforeEach(async () => {
    repo = {
      findOne: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoordinatorsService,
        {
          provide: getRepositoryToken(FosterCoordinator),
          useValue: repo,
        },
      ],
    }).compile();

    service = module.get<CoordinatorsService>(CoordinatorsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('deactivate', () => {
    it('should set active to false and save the coordinator', async () => {
      const coordinator = {
        coordinatorId: 1,
        active: true,
      } as FosterCoordinator;
      repo.findOne.mockResolvedValue(coordinator);
      repo.save.mockResolvedValue({ ...coordinator, active: false });

      const result = await service.deactivate(1);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { coordinatorId: 1 },
      });
      expect(repo.save).toHaveBeenCalledWith({
        ...coordinator,
        active: false,
      });
      expect(result.active).toBe(false);
    });

    it('should throw NotFoundException if coordinator does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.deactivate(999)).rejects.toThrow(
        new NotFoundException('Coordinator with ID 999 not found'),
      );
      expect(repo.save).not.toHaveBeenCalled();
    });
    it('should not delete the coordinator record', async () => {
      const coordinator = {
        coordinatorId: 1,
        active: true,
      } as FosterCoordinator;
      repo.findOne.mockResolvedValue(coordinator);
      repo.save.mockResolvedValue({ ...coordinator, active: false });

      await service.deactivate(1);

      expect(repo.delete).not.toHaveBeenCalled();
    });
  });

  describe('activate', () => {
    it('should set active to true and save the coordinator', async () => {
      const coordinator = {
        coordinatorId: 1,
        active: false,
      } as FosterCoordinator;
      repo.findOne.mockResolvedValue(coordinator);
      repo.save.mockResolvedValue({ ...coordinator, active: true });

      const result = await service.activate(1);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { coordinatorId: 1 },
      });
      expect(repo.save).toHaveBeenCalledWith({ ...coordinator, active: true });
      expect(result.active).toBe(true);
    });

    it('should throw NotFoundException if coordinator does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.activate(999)).rejects.toThrow(
        new NotFoundException('Coordinator with ID 999 not found'),
      );
      expect(repo.save).not.toHaveBeenCalled();
    });
  });
});
