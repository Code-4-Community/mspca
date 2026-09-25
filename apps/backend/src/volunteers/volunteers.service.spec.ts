import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { VolunteersService } from './volunteers.service';
import { FosterVolunteer } from './volunteers.entity';

describe('VolunteersService', () => {
  let service: VolunteersService;
  let repo: { existsBy: jest.Mock };

  beforeEach(async () => {
    repo = { existsBy: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VolunteersService,
        {
          provide: getRepositoryToken(FosterVolunteer),
          useValue: repo,
        },
      ],
    }).compile();

    service = module.get<VolunteersService>(VolunteersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('existsById', () => {
    it('returns true when a volunteer with the id exists', async () => {
      repo.existsBy.mockResolvedValue(true);

      const result = await service.existsById(7);

      expect(result).toBe(true);
      expect(repo.existsBy).toHaveBeenCalledWith({ volunteerId: 7 });
    });

    it('returns false when no volunteer with the id exists', async () => {
      repo.existsBy.mockResolvedValue(false);

      const result = await service.existsById(7);

      expect(result).toBe(false);
    });
  });
});
