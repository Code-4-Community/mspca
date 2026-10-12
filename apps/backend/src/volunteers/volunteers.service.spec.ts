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
    notes: 'likes cats',
    assignedCoordinator: null,
  } as FosterVolunteer;

  let mockRepo: { findOne: jest.Mock; save: jest.Mock; delete: jest.Mock };

  beforeEach(async () => {
    mockRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VolunteersService,
        { provide: getRepositoryToken(FosterVolunteer), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<VolunteersService>(VolunteersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByIdOrFail', () => {
    it('returns the volunteer when one with the id exists', async () => {
      const volunteer = { volunteerId: 7 } as FosterVolunteer;
      mockRepo.findOne.mockResolvedValue(volunteer);

      const result = await service.findByIdOrFail(7);

      expect(result).toBe(volunteer);
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { volunteerId: 7 },
        relations: ['assignedCoordinator'],
      });
    });

    it('throws NotFoundException when no volunteer with the id exists', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findByIdOrFail(7)).rejects.toThrow(
        new NotFoundException('Volunteer with ID 7 not found'),
      );
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { volunteerId: 7 },
        relations: ['assignedCoordinator'],
      });
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

    it('throws NotFoundException when no volunteer with the id exists', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findActiveOrFail(7)).rejects.toThrow(
        new NotFoundException('Volunteer with ID 7 not found'),
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

      expect(result).toEqual(mockVolunteer);
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { volunteerId: 1 },
        relations: ['assignedCoordinator'],
      });
    });

    it('should throw NotFoundException when volunteer does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.getVolunteerById(999)).rejects.toThrow(
        new NotFoundException('Volunteer with ID 999 not found'),
      );
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { volunteerId: 999 },
        relations: ['assignedCoordinator'],
      });
    });
  });

  describe('updateVolunteerById', () => {
    it('should update and return the volunteer with only the given fields changed', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockVolunteer });
      mockRepo.save.mockImplementation((v) => Promise.resolve(v));

      const dto = { notes: 'updated notes' } as UpdateVolunteerDto;
      const result = await service.updateVolunteerById(1, dto);

      expect(result.notes).toBe('updated notes');
      expect(result.firstName).toBe('Jane');
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { volunteerId: 1 },
        relations: ['assignedCoordinator'],
      });
      expect(mockRepo.save).toHaveBeenCalledWith({
        ...mockVolunteer,
        notes: 'updated notes',
      });
    });

    it('should update multiple allowed fields at once', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockVolunteer });
      mockRepo.save.mockImplementation((v) => Promise.resolve(v));

      const dto = {
        address: '123 Main St',
        city: 'Boston',
        zipcode: '02115',
      } as UpdateVolunteerDto;

      const result = await service.updateVolunteerById(1, dto);

      expect(result.address).toBe('123 Main St');
      expect(result.city).toBe('Boston');
      expect(result.zipcode).toBe('02115');
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { volunteerId: 1 },
        relations: ['assignedCoordinator'],
      });
      expect(mockRepo.save).toHaveBeenCalledWith({
        ...mockVolunteer,
        address: '123 Main St',
        city: 'Boston',
        zipcode: '02115',
      });
    });

    it('should throw NotFoundException when volunteer does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateVolunteerById(999, { notes: 'x' }),
      ).rejects.toThrow(
        new NotFoundException('Volunteer with ID 999 not found'),
      );
      expect(mockRepo.save).not.toHaveBeenCalled();
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
        const findSpy = jest.spyOn(service, 'findByIdOrFail');

        const result = await service.updateFosterTypePreferences(1, {
          added: [FosterType.CAT, FosterType.SMALL_ANIMALS],
        });

        expect(findSpy).toHaveBeenCalledWith(1);
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

      it('preserves the order in which types are added', async () => {
        mockRepo.findOne.mockResolvedValue(volunteerWithFosterTypes([]));

        const result = await service.updateFosterTypePreferences(1, {
          added: [
            FosterType.BABY_BOTTLE_ANIMALS,
            FosterType.DOG,
            FosterType.SMALL_ANIMALS,
            FosterType.CAT,
          ],
        });

        expect(result).toEqual([
          FosterType.BABY_BOTTLE_ANIMALS,
          FosterType.DOG,
          FosterType.SMALL_ANIMALS,
          FosterType.CAT,
        ]);
      });

      it('can add every FosterType value', async () => {
        mockRepo.findOne.mockResolvedValue(volunteerWithFosterTypes([]));

        const result = await service.updateFosterTypePreferences(1, {
          added: Object.values(FosterType),
        });

        expect(result).toEqual(Object.values(FosterType));
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

      it('leaves the list unchanged when every added type is already present', async () => {
        mockRepo.findOne.mockResolvedValue(
          volunteerWithFosterTypes([FosterType.DOG, FosterType.CAT]),
        );

        const result = await service.updateFosterTypePreferences(1, {
          added: [FosterType.CAT, FosterType.DOG],
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

      it('preserves the relative order of the remaining types', async () => {
        mockRepo.findOne.mockResolvedValue(
          volunteerWithFosterTypes([
            FosterType.SMALL_ANIMALS,
            FosterType.DOG,
            FosterType.BABY_BOTTLE_ANIMALS,
            FosterType.CAT,
          ]),
        );

        const result = await service.updateFosterTypePreferences(1, {
          removed: [FosterType.DOG],
        });

        expect(result).toEqual([
          FosterType.SMALL_ANIMALS,
          FosterType.BABY_BOTTLE_ANIMALS,
          FosterType.CAT,
        ]);
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

      it('removes present types and ignores absent ones in the same request', async () => {
        mockRepo.findOne.mockResolvedValue(
          volunteerWithFosterTypes([FosterType.DOG, FosterType.CAT]),
        );

        const result = await service.updateFosterTypePreferences(1, {
          removed: [FosterType.CAT, FosterType.SMALL_ANIMALS],
        });

        expect(result).toEqual([FosterType.DOG]);
      });

      it('treats removing from an empty list as a no-op', async () => {
        mockRepo.findOne.mockResolvedValue(volunteerWithFosterTypes([]));

        const result = await service.updateFosterTypePreferences(1, {
          removed: [FosterType.DOG],
        });

        expect(result).toEqual([]);
        expect(mockRepo.save).toHaveBeenCalled();
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

      it('adds a type that is in both lists even when it was not previously present', async () => {
        mockRepo.findOne.mockResolvedValue(
          volunteerWithFosterTypes([FosterType.CAT]),
        );

        const result = await service.updateFosterTypePreferences(1, {
          added: [FosterType.DOG],
          removed: [FosterType.DOG],
        });

        expect(result).toEqual([FosterType.CAT, FosterType.DOG]);
      });

      it.each([
        {},
        { added: [] },
        { removed: [] },
        { added: [], removed: [] },
        { added: null, removed: [FosterType.DOG] },
        { added: [FosterType.CAT], removed: null },
      ])('does not throw for %j', async (dto) => {
        mockRepo.findOne.mockResolvedValue(
          volunteerWithFosterTypes([FosterType.DOG]),
        );

        await expect(
          service.updateFosterTypePreferences(1, dto as never),
        ).resolves.toBeDefined();
      });
    });

    describe('persistence', () => {
      it('saves the volunteer exactly once without changing other fields', async () => {
        mockRepo.findOne.mockResolvedValue(
          volunteerWithFosterTypes([FosterType.DOG]),
        );

        await service.updateFosterTypePreferences(1, {
          added: [FosterType.CAT],
        });

        expect(mockRepo.save).toHaveBeenCalledTimes(1);
        expect(mockRepo.save).toHaveBeenCalledWith({
          ...mockVolunteer,
          fosterTypePreferences: [FosterType.DOG, FosterType.CAT],
        });
      });

      it('does not mutate the dto arrays', async () => {
        mockRepo.findOne.mockResolvedValue(
          volunteerWithFosterTypes([FosterType.DOG]),
        );
        const added = [FosterType.CAT, FosterType.DOG];
        const removed = [FosterType.DOG];

        await service.updateFosterTypePreferences(1, { added, removed });

        expect(added).toEqual([FosterType.CAT, FosterType.DOG]);
        expect(removed).toEqual([FosterType.DOG]);
      });

      it('returns the list from the saved entity', async () => {
        mockRepo.findOne.mockResolvedValue(
          volunteerWithFosterTypes([FosterType.DOG]),
        );
        mockRepo.save.mockResolvedValue({
          ...mockVolunteer,
          fosterTypePreferences: [FosterType.CAT],
        });

        const result = await service.updateFosterTypePreferences(1, {
          added: [FosterType.CAT],
        });

        expect(result).toEqual([FosterType.CAT]);
      });

      it('does not delete the volunteer', async () => {
        mockRepo.findOne.mockResolvedValue(
          volunteerWithFosterTypes([FosterType.DOG]),
        );

        await service.updateFosterTypePreferences(1, {
          removed: [FosterType.DOG],
        });

        expect(mockRepo.delete).not.toHaveBeenCalled();
      });
    });

    describe('errors', () => {
      it('throws NotFoundException if the volunteer does not exist', async () => {
        mockRepo.findOne.mockResolvedValue(null);
        const findSpy = jest.spyOn(service, 'findByIdOrFail');

        await expect(
          service.updateFosterTypePreferences(999, {
            added: [FosterType.DOG],
          }),
        ).rejects.toThrow(
          new NotFoundException('Volunteer with ID 999 not found'),
        );
        expect(findSpy).toHaveBeenCalledWith(999);
        expect(mockRepo.save).not.toHaveBeenCalled();
      });

      it('throws NotFoundException for a nonexistent volunteer when only removing', async () => {
        mockRepo.findOne.mockResolvedValue(null);

        await expect(
          service.updateFosterTypePreferences(999, {
            removed: [FosterType.DOG],
          }),
        ).rejects.toThrow(NotFoundException);
        expect(mockRepo.save).not.toHaveBeenCalled();
      });

      it('propagates errors thrown by the repository on save', async () => {
        mockRepo.findOne.mockResolvedValue(volunteerWithFosterTypes([]));
        mockRepo.save.mockRejectedValue(new Error('db failure'));

        await expect(
          service.updateFosterTypePreferences(1, { added: [FosterType.DOG] }),
        ).rejects.toThrow('db failure');
      });
    });
  });
});
