import { Test, TestingModule } from '@nestjs/testing';
import { AgeJobsService } from './age-jobs.service';
import { PetsService } from '../pets/pets.service';
import { VolunteersService } from '../volunteers/volunteers.service';

describe('AgeJobsService', () => {
  let service: AgeJobsService;
  let mockPetsService: { incrementAllAges: jest.Mock };
  let mockVolunteersService: { incrementAllChildrenAges: jest.Mock };

  beforeEach(async () => {
    mockPetsService = { incrementAllAges: jest.fn() };
    mockVolunteersService = { incrementAllChildrenAges: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgeJobsService,
        { provide: PetsService, useValue: mockPetsService },
        { provide: VolunteersService, useValue: mockVolunteersService },
      ],
    }).compile();

    service = module.get(AgeJobsService);
  });

  describe('incrementPetAges', () => {
    it('calls PetsService.incrementAllAges once', async () => {
      await service.incrementPetAges();

      expect(mockPetsService.incrementAllAges).toHaveBeenCalledTimes(1);
    });
  });

  describe('incrementChildrenAges', () => {
    it('calls VolunteersService.incrementAllChildrenAges once', async () => {
      await service.incrementChildrenAges();

      expect(
        mockVolunteersService.incrementAllChildrenAges,
      ).toHaveBeenCalledTimes(1);
    });
  });
});
