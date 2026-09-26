import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { VolunteersService } from './volunteers.service';
import { FosterVolunteer } from './volunteers.entity';
import { FosterCoordinator } from '../coordinators/coordinators.entity';

describe('VolunteersService', () => {
  let service: VolunteersService;

  const mockVolunteer = {
    volunteerId: 1,
    firstName: 'Jane',
    lastName: 'Doe',
    notes: 'likes cats',
    assignedCoordinator: null,
  };

  const mockCoordinator = {
    coordinatorId: 5,
    name: 'Coordinator Name',
  };

  const mockRepo = {
    findOneBy: jest.fn(),
    save: jest.fn(),
  };

  const mockCoordinatorRepo = {
    findOneBy: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VolunteersService,
        { provide: getRepositoryToken(FosterVolunteer), useValue: mockRepo },
        {
          provide: getRepositoryToken(FosterCoordinator),
          useValue: mockCoordinatorRepo,
        },
      ],
    }).compile();

    service = module.get<VolunteersService>(VolunteersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getVolunteerById', () => {
    it('should return a volunteer when found', async () => {
      mockRepo.findOneBy.mockResolvedValue(mockVolunteer);

      const result = await service.getVolunteerById(1);

      expect(result).toEqual(mockVolunteer);
      expect(mockRepo.findOneBy).toHaveBeenCalledWith({ volunteerId: 1 });
    });

    it('should return null when volunteer does not exist', async () => {
      mockRepo.findOneBy.mockResolvedValue(null);

      const result = await service.getVolunteerById(999);

      expect(result).toBeNull();
    });
  });

  describe('updateVolunteerbyId', () => {
    it('should update and return the volunteer with only the given fields changed', async () => {
      mockRepo.findOneBy.mockResolvedValue({ ...mockVolunteer });
      mockRepo.save.mockImplementation((v) => Promise.resolve(v));

      const dto = { notes: 'updated notes' };
      const result = await service.updateVolunteerbyId(1, dto);

      if (!result) {
        throw new Error('Expected a volunteer, got null');
      }
      expect(result.notes).toBe('updated notes');
      expect(result.firstName).toBe('Jane');
      expect(mockRepo.save).toHaveBeenCalled();
    });
    it('should update multiple allowed fields at once', async () => {
      mockRepo.findOneBy.mockResolvedValue({ ...mockVolunteer });
      mockRepo.save.mockImplementation((v) => Promise.resolve(v));

      const dto = {
        address: '123 Main St',
        city: 'Boston',
        zipcode: '02115',
      };

      const result = await service.updateVolunteerbyId(1, dto);

      if (!result) {
        throw new Error('Expected a volunteer, got null');
      }

      expect(result.address).toBe('123 Main St');
      expect(result.city).toBe('Boston');
      expect(result.zipcode).toBe('02115');
    });

    it('should return null when volunteer does not exist', async () => {
      mockRepo.findOneBy.mockResolvedValue(null);

      const result = await service.updateVolunteerbyId(999, { notes: 'x' });

      expect(result).toBeNull();
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('should reassign the coordinator when a valid assignedCoordinatorId is given', async () => {
      mockRepo.findOneBy.mockResolvedValue({ ...mockVolunteer });
      mockCoordinatorRepo.findOneBy.mockResolvedValue(mockCoordinator);
      mockRepo.save.mockImplementation((v) => Promise.resolve(v));

      const result = await service.updateVolunteerbyId(1, {
        assignedCoordinatorId: 5,
      });
      if (!result) {
        throw new Error('Expected a volunteer, got null');
      }

      expect(mockCoordinatorRepo.findOneBy).toHaveBeenCalledWith({
        coordinatorId: 5,
      });
      expect(result.assignedCoordinator).toEqual(mockCoordinator);
    });

    it('should throw NotFoundException when assignedCoordinatorId does not match a real coordinator', async () => {
      mockRepo.findOneBy.mockResolvedValue({ ...mockVolunteer });
      mockCoordinatorRepo.findOneBy.mockResolvedValue(null);

      await expect(
        service.updateVolunteerbyId(1, { assignedCoordinatorId: 999 }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
