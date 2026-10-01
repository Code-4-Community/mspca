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

  describe('setActive', () => {
    describe('deactivating', () => {
      it('sets active to false, saves, and does not delete the coordinator', async () => {
        const coordinator = {
          coordinatorId: 1,
          active: true,
        } as FosterCoordinator;
        repo.findOne.mockResolvedValue(coordinator);
        repo.save.mockResolvedValue({ ...coordinator, active: false });

        const result = await service.setActive(1, false);

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

        await expect(service.setActive(999, false)).rejects.toThrow(
          new NotFoundException('Coordinator with ID 999 not found'),
        );
        expect(repo.save).not.toHaveBeenCalled();
      });
    });

    describe('activating', () => {
      it('sets active to true and saves the coordinator', async () => {
        const coordinator = {
          coordinatorId: 1,
          active: false,
        } as FosterCoordinator;
        repo.findOne.mockResolvedValue(coordinator);
        repo.save.mockResolvedValue({ ...coordinator, active: true });

        const result = await service.setActive(1, true);

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

        await expect(service.setActive(999, true)).rejects.toThrow(
          new NotFoundException('Coordinator with ID 999 not found'),
        );
        expect(repo.save).not.toHaveBeenCalled();
      });
    });
  });
});
