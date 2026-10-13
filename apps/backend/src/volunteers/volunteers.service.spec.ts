import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { VolunteersService } from './volunteers.service';
import { FosterVolunteer } from './volunteers.entity';
import { FosterType, VolunteerStatus } from './volunteers.types';
import { UpdateVolunteerDto } from './dto/update-volunteer.dto';

describe('VolunteersService', () => {
  let service: VolunteersService;

  const mockVolunteer = {
    volunteerId: 1,
    firstName: 'Jane',
    lastName: 'Doe',
    phone: '123-456-7890',
    email: 'jane@example.com',
    address: '123 Main St',
    city: 'Austin',
    zipcode: '78701',
    homebase: 'Region 1',
    residentAnimals: 'Cats',
    fosterType: FosterType.CAT,
    completedCanineTraining: null,
    mostRecentWaiverSigned: true,
    status: VolunteerStatus.ACTIVE,
    fosterTypePreferences: [FosterType.CAT],
    assignedCoordinator: null,
  } as FosterVolunteer;

  let mockRepo: {
    findOne: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };

  beforeEach(async () => {
    mockRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VolunteersService,
        {
          provide: getRepositoryToken(FosterVolunteer),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<VolunteersService>(VolunteersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByIdOrFail', () => {
    it('returns the volunteer when found', async () => {
      mockRepo.findOne.mockResolvedValue(mockVolunteer);

      const result = await service.findByIdOrFail(1);

      expect(result).toBe(mockVolunteer);
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { volunteerId: 1 },
        relations: ['assignedCoordinator'],
      });
    });

    it('throws NotFoundException when the volunteer is not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findByIdOrFail(999)).rejects.toThrow(
        new NotFoundException('Volunteer with ID 999 not found'),
      );
    });
  });

  describe('findActiveOrFail', () => {
    it('returns the volunteer when they are active', async () => {
      const volunteer = {
        volunteerId: 7,
        status: VolunteerStatus.ACTIVE,
      } as FosterVolunteer;
      mockRepo.findOne.mockResolvedValue(volunteer);

      const result = await service.findActiveOrFail(7);

      expect(result).toBe(volunteer);
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { volunteerId: 7 },
        relations: ['assignedCoordinator'],
      });
    });

    it('throws BadRequestException when the volunteer is not active', async () => {
      mockRepo.findOne.mockResolvedValue({
        volunteerId: 7,
        status: VolunteerStatus.INACTIVE,
      } as FosterVolunteer);

      await expect(service.findActiveOrFail(7)).rejects.toThrow(
        new BadRequestException('Volunteer with ID 7 is not active'),
      );
    });
  });

  describe('deactivate', () => {
    it('sets status to Inactive, saves, and does not delete the volunteer', async () => {
      const volunteer = {
        volunteerId: 1,
        status: VolunteerStatus.ACTIVE,
      } as FosterVolunteer;
      mockRepo.findOne.mockResolvedValue(volunteer);
      mockRepo.save.mockResolvedValue({
        ...volunteer,
        status: VolunteerStatus.INACTIVE,
      });

      const result = await service.deactivate(1);

      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { volunteerId: 1 },
        relations: ['assignedCoordinator'],
      });
      expect(mockRepo.save).toHaveBeenCalledWith({
        ...volunteer,
        status: VolunteerStatus.INACTIVE,
      });
      expect(result.status).toBe(VolunteerStatus.INACTIVE);
      expect(mockRepo.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException if volunteer does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.deactivate(999)).rejects.toThrow(
        new NotFoundException('Volunteer with ID 999 not found'),
      );
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('throws BadRequestException if the volunteer is already inactive', async () => {
      const volunteer = {
        volunteerId: 1,
        status: VolunteerStatus.INACTIVE,
      } as FosterVolunteer;
      mockRepo.findOne.mockResolvedValue(volunteer);

      await expect(service.deactivate(1)).rejects.toThrow(
        new BadRequestException('Volunteer with ID 1 is not active'),
      );
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('throws BadRequestException if the volunteer is pending', async () => {
      const volunteer = {
        volunteerId: 1,
        status: VolunteerStatus.PENDING,
      } as FosterVolunteer;
      mockRepo.findOne.mockResolvedValue(volunteer);

      await expect(service.deactivate(1)).rejects.toThrow(
        new BadRequestException('Volunteer with ID 1 is not active'),
      );
      expect(mockRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('reactivate', () => {
    it('sets status to Active and saves the volunteer', async () => {
      const volunteer = {
        volunteerId: 1,
        status: VolunteerStatus.INACTIVE,
      } as FosterVolunteer;
      mockRepo.findOne.mockResolvedValue(volunteer);
      mockRepo.save.mockResolvedValue({
        ...volunteer,
        status: VolunteerStatus.ACTIVE,
      });

      const result = await service.reactivate(1);

      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { volunteerId: 1 },
        relations: ['assignedCoordinator'],
      });
      expect(mockRepo.save).toHaveBeenCalledWith({
        ...volunteer,
        status: VolunteerStatus.ACTIVE,
      });
      expect(result.status).toBe(VolunteerStatus.ACTIVE);
    });

    it('throws NotFoundException if volunteer does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.reactivate(999)).rejects.toThrow(
        new NotFoundException('Volunteer with ID 999 not found'),
      );
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('throws BadRequestException if the volunteer is already active', async () => {
      const volunteer = {
        volunteerId: 1,
        status: VolunteerStatus.ACTIVE,
      } as FosterVolunteer;
      mockRepo.findOne.mockResolvedValue(volunteer);

      await expect(service.reactivate(1)).rejects.toThrow(
        new BadRequestException('Volunteer with ID 1 is not inactive'),
      );
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('throws BadRequestException if the volunteer is pending', async () => {
      const volunteer = {
        volunteerId: 1,
        status: VolunteerStatus.PENDING,
      } as FosterVolunteer;
      mockRepo.findOne.mockResolvedValue(volunteer);

      await expect(service.reactivate(1)).rejects.toThrow(
        new BadRequestException('Volunteer with ID 1 is not inactive'),
      );
      expect(mockRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('getVolunteerById', () => {
    it('should return a volunteer when found', async () => {
      mockRepo.findOne.mockResolvedValue(mockVolunteer);

      const result = await service.getVolunteerById(1);

      expect(result).toBe(mockVolunteer);
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { volunteerId: 1 },
        relations: ['assignedCoordinator'],
      });
    });

    it('should throw NotFoundException when the volunteer is missing', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.getVolunteerById(999)).rejects.toThrow(
        new NotFoundException('Volunteer with ID 999 not found'),
      );
    });
  });

  describe('updateVolunteerById', () => {
    it('updates the volunteer and saves it', async () => {
      const dto = { notes: 'updated notes' } as UpdateVolunteerDto;
      const updatedVolunteer = { ...mockVolunteer, ...dto } as FosterVolunteer;

      mockRepo.findOne.mockResolvedValue(mockVolunteer);
      mockRepo.save.mockResolvedValue(updatedVolunteer);

      const result = await service.updateVolunteerById(1, dto);

      expect(result).toEqual(updatedVolunteer);
      expect(mockRepo.save).toHaveBeenCalledWith({
        ...mockVolunteer,
        ...dto,
      });
    });

    it('throws NotFoundException if the volunteer does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.updateVolunteerById(999, { notes: 'x' })).rejects.toThrow(
        new NotFoundException('Volunteer with ID 999 not found'),
      );
    });

    it('throws BadRequestException for invalid fields', async () => {
      const dto = {} as UpdateVolunteerDto;
      await expect(service.updateVolunteerById(1, dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('updateFosterTypePreferences', () => {
    const volunteerWithFosterTypes = (fosterTypePreferences: FosterType[]) =>
      ({ ...mockVolunteer, fosterTypePreferences } as FosterVolunteer);

    beforeEach(() => {
      mockRepo.save.mockImplementation(async (v) => v);
    });

    describe('adding', () => {
      it('adds the given foster types to the list', async () => {
        mockRepo.findOne.mockResolvedValue(
          volunteerWithFosterTypes([FosterType.DOG]),
        );

        const result = await service.updateFosterTypePreferences(1, {
          added: [FosterType.CAT, FosterType.SMALL_ANIMALS],
        });

        expect(result).toEqual([
          FosterType.DOG,
          FosterType.CAT,
          FosterType.SMALL_ANIMALS,
        ]);
        expect(mockRepo.save).toHaveBeenCalledWith(
          expect.objectContaining({
            fosterTypePreferences: [
              FosterType.DOG,
              FosterType.CAT,
              FosterType.SMALL_ANIMALS,
            ],
          }),
        );
      });

      it('adds to an empty list', async () => {
        mockRepo.findOne.mockResolvedValue(volunteerWithFosterTypes([]));

        const result = await service.updateFosterTypePreferences(1, {
          added: [FosterType.DOG],
        });

        expect(result).toEqual([FosterType.DOG]);
      });

      it('does not create duplicates when adding a type already in the list', async () => {
        mockRepo.findOne.mockResolvedValue(
          volunteerWithFosterTypes([FosterType.DOG]),
        );

        const result = await service.updateFosterTypePreferences(1, {
          added: [FosterType.DOG, FosterType.CAT, FosterType.CAT],
        });

        expect(result).toEqual([FosterType.DOG, FosterType.CAT]);
      });
    });

    describe('removing', () => {
      it('removes the given foster types from the list', async () => {
        mockRepo.findOne.mockResolvedValue(
          volunteerWithFosterTypes([
            FosterType.DOG,
            FosterType.CAT,
            FosterType.SMALL_ANIMALS,
          ]),
        );

        const result = await service.updateFosterTypePreferences(1, {
          removed: [FosterType.CAT, FosterType.SMALL_ANIMALS],
        });

        expect(result).toEqual([FosterType.DOG]);
        expect(mockRepo.save).toHaveBeenCalledWith(
          expect.objectContaining({ fosterTypePreferences: [FosterType.DOG] }),
        );
      });

      it('can remove every type, leaving an empty list', async () => {
        mockRepo.findOne.mockResolvedValue(
          volunteerWithFosterTypes([FosterType.DOG, FosterType.CAT]),
        );

        const result = await service.updateFosterTypePreferences(1, {
          removed: [FosterType.DOG, FosterType.CAT],
        });

        expect(result).toEqual([]);
      });

      it('ignores removing a type that is not in the list', async () => {
        mockRepo.findOne.mockResolvedValue(
          volunteerWithFosterTypes([FosterType.DOG]),
        );

        const result = await service.updateFosterTypePreferences(1, {
          removed: [FosterType.CAT],
        });

        expect(result).toEqual([FosterType.DOG]);
      });
    });

    describe('adding and removing together', () => {
      it('applies removals and additions in the same request', async () => {
        mockRepo.findOne.mockResolvedValue(
          volunteerWithFosterTypes([FosterType.DOG, FosterType.CAT]),
        );

        const result = await service.updateFosterTypePreferences(1, {
          added: [FosterType.BABY_BOTTLE_ANIMALS],
          removed: [FosterType.DOG],
        });

        expect(result).toEqual([
          FosterType.CAT,
          FosterType.BABY_BOTTLE_ANIMALS,
        ]);
      });

      it('keeps a type that appears in both added and removed (removals run first)', async () => {
        mockRepo.findOne.mockResolvedValue(
          volunteerWithFosterTypes([FosterType.DOG]),
        );

        const result = await service.updateFosterTypePreferences(1, {
          added: [FosterType.DOG],
          removed: [FosterType.DOG],
        });

        expect(result).toEqual([FosterType.DOG]);
      });
    });

    describe('errors', () => {
      it('throws NotFoundException if the volunteer does not exist', async () => {
        mockRepo.findOne.mockResolvedValue(null);

        await expect(
          service.updateFosterTypePreferences(999, {
            added: [FosterType.DOG],
          }),
        ).rejects.toThrow(
          new NotFoundException('Volunteer with ID 999 not found'),
        );
        expect(mockRepo.save).not.toHaveBeenCalled();
      });

      it('propagates repository save errors', async () => {
        mockRepo.findOne.mockResolvedValue(volunteerWithFosterTypes([]));
        mockRepo.save.mockRejectedValue(new Error('db failure'));

        await expect(
          service.updateFosterTypePreferences(1, { added: [FosterType.DOG] }),
        ).rejects.toThrow('db failure');
      });
    });
  });
});