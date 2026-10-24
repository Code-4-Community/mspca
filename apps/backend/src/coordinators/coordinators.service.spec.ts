import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CoordinatorsService } from './coordinators.service';
import { FosterCoordinator } from './coordinators.entity';
import { Homebase } from '../types';

describe('CoordinatorsService', () => {
  let service: CoordinatorsService;
  let repo: {
    findOne: jest.Mock;
    find: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };

  beforeEach(async () => {
    repo = {
      findOne: jest.fn(),
      find: jest.fn(),
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

  describe('findByIdOrFail', () => {
    it('returns the coordinator when one with the id exists', async () => {
      const coordinator = { coordinatorId: 7 } as FosterCoordinator;
      repo.findOne.mockResolvedValue(coordinator);

      const result = await service.findByIdOrFail(7);

      expect(result).toBe(coordinator);
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { coordinatorId: 7 },
      });
    });

    it('throws NotFoundException when no coordinator with the id exists', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findByIdOrFail(7)).rejects.toThrow(
        new NotFoundException('Coordinator with ID 7 not found'),
      );
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { coordinatorId: 7 },
      });
    });
  });

  describe('findActiveByHomebase', () => {
    it('returns the active coordinators at the homebase ordered by id', async () => {
      const coordinators = [
        { coordinatorId: 2, homebase: Homebase.SALEM, active: true },
        { coordinatorId: 5, homebase: Homebase.SALEM, active: true },
      ] as FosterCoordinator[];
      repo.find.mockResolvedValue(coordinators);

      const result = await service.findActiveByHomebase(Homebase.SALEM);

      expect(result).toBe(coordinators);
      expect(repo.find).toHaveBeenCalledTimes(1);
      expect(repo.find).toHaveBeenCalledWith({
        where: { homebase: Homebase.SALEM, active: true },
        order: { coordinatorId: 'ASC' },
      });
    });

    it('does not return coordinators from other homebases', async () => {
      const coordinators = [
        { coordinatorId: 1, homebase: Homebase.BOSTON, active: true },
        { coordinatorId: 2, homebase: Homebase.SALEM, active: true },
        { coordinatorId: 3, homebase: Homebase.CAPE_COD, active: true },
        { coordinatorId: 4, homebase: Homebase.CAPE_COD, active: false },
      ] as FosterCoordinator[];
      repo.find.mockImplementation(
        async ({ where }: { where: Partial<FosterCoordinator> }) =>
          coordinators.filter(
            (c) => c.homebase === where.homebase && c.active === where.active,
          ),
      );

      const result = await service.findActiveByHomebase(Homebase.SALEM);

      expect(result).toEqual([coordinators[1]]);
      expect(repo.find).toHaveBeenCalledTimes(1);
    });

    it('returns an empty array when the homebase has no active coordinators', async () => {
      repo.find.mockResolvedValue([]);

      const result = await service.findActiveByHomebase(Homebase.CAPE_COD);

      expect(result).toEqual([]);
      expect(repo.find).toHaveBeenCalledTimes(1);
    });
  });

  describe('deactivate', () => {
    it('sets active to false, saves, and does not delete the coordinator', async () => {
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
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException if coordinator does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.deactivate(999)).rejects.toThrow(
        new NotFoundException('Coordinator with ID 999 not found'),
      );
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('throws BadRequestException if the coordinator is already inactive', async () => {
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
      repo.save.mockResolvedValue({ ...coordinator, active: true });

      const result = await service.activate(1);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { coordinatorId: 1 },
      });
      expect(repo.save).toHaveBeenCalledWith({ ...coordinator, active: true });
      expect(result.active).toBe(true);
    });

    it('throws NotFoundException if coordinator does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.activate(999)).rejects.toThrow(
        new NotFoundException('Coordinator with ID 999 not found'),
      );
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('throws BadRequestException if the coordinator is already active', async () => {
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
