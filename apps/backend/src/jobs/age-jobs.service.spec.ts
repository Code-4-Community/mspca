import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { SCHEDULE_CRON_OPTIONS } from '@nestjs/schedule/dist/schedule.constants';
import { AgeJobsService } from './age-jobs.service';
import { PetsService } from '../pets/pets.service';
import { VolunteersService } from '../volunteers/volunteers.service';

describe('AgeJobsService', () => {
  let service: AgeJobsService;
  let mockPetsService: { incrementAllAges: jest.Mock };
  let mockVolunteersService: { incrementAllChildrenAges: jest.Mock };
  let errorSpy: jest.SpyInstance;

  beforeEach(async () => {
    mockPetsService = { incrementAllAges: jest.fn().mockResolvedValue(0) };
    mockVolunteersService = {
      incrementAllChildrenAges: jest.fn().mockResolvedValue(0),
    };
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgeJobsService,
        { provide: PetsService, useValue: mockPetsService },
        { provide: VolunteersService, useValue: mockVolunteersService },
      ],
    }).compile();

    service = module.get(AgeJobsService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('incrementPetAges', () => {
    it('calls PetsService.incrementAllAges once', async () => {
      await service.incrementPetAges();

      expect(mockPetsService.incrementAllAges).toHaveBeenCalledTimes(1);
    });

    it('logs and swallows a failure', async () => {
      mockPetsService.incrementAllAges.mockRejectedValue(new Error('db down'));

      await expect(service.incrementPetAges()).resolves.toBeUndefined();
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('incrementChildrenAges', () => {
    it('calls VolunteersService.incrementAllChildrenAges once', async () => {
      await service.incrementChildrenAges();

      expect(
        mockVolunteersService.incrementAllChildrenAges,
      ).toHaveBeenCalledTimes(1);
    });

    it('logs and swallows a failure', async () => {
      mockVolunteersService.incrementAllChildrenAges.mockRejectedValue(
        new Error('db down'),
      );

      await expect(service.incrementChildrenAges()).resolves.toBeUndefined();
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('schedules', () => {
    const cronOptions = (method: keyof AgeJobsService) =>
      Reflect.getMetadata(
        SCHEDULE_CRON_OPTIONS,
        AgeJobsService.prototype[method],
      );

    it('runs incrementPetAges at midnight on the first of each month, Eastern', () => {
      expect(cronOptions('incrementPetAges')).toMatchObject({
        cronTime: '0 0 1 * *',
        timeZone: 'America/New_York',
      });
    });

    it('runs incrementChildrenAges at midnight on January 1, Eastern', () => {
      expect(cronOptions('incrementChildrenAges')).toMatchObject({
        cronTime: '0 0 1 1 *',
        timeZone: 'America/New_York',
      });
    });
  });
});
