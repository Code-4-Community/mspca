import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { AgeJobsService } from './age-jobs.service';
import { PetsService } from '../pets/pets.service';
import { VolunteersService } from '../volunteers/volunteers.service';

describe('AgeJobsService', () => {
  let service: AgeJobsService;
  let mockPetsService: { incrementAllAges: jest.Mock };
  let mockVolunteersService: { incrementAllChildrenAges: jest.Mock };
  let logSpy: jest.SpyInstance;

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
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('incrementPetAges', () => {
    it('increments pet ages and logs the run', async () => {
      mockPetsService.incrementAllAges.mockResolvedValue(undefined);

      await service.incrementPetAges();

      expect(mockPetsService.incrementAllAges).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith('Age job: pet ages incremented');
      expect(logSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('incrementChildrenAges', () => {
    it("increments children's ages and logs the run", async () => {
      mockVolunteersService.incrementAllChildrenAges.mockResolvedValue(
        undefined,
      );

      await service.incrementChildrenAges();

      expect(
        mockVolunteersService.incrementAllChildrenAges,
      ).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith(
        "Age job: children's ages incremented",
      );
      expect(logSpy).toHaveBeenCalledTimes(1);
    });
  });
});
