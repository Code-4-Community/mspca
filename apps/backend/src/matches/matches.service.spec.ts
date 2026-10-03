import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MatchesService } from './matches.service';
import { Match } from './matches.entity';
import { MatchStatus } from './matches.types';

describe('MatchesService', () => {
  let service: MatchesService;
  let repo: { find: jest.Mock };

  const matches = [
    {
      matchId: 1,
      volunteerId: 7,
      chameleonAnimalId: 42,
      status: MatchStatus.PENDING,
      deniedReason: null,
    },
    {
      matchId: 2,
      volunteerId: 7,
      chameleonAnimalId: 43,
      status: MatchStatus.DENIED,
      deniedReason: 'Resident dog is not cat-friendly',
    },
  ] as Match[];

  beforeEach(async () => {
    repo = { find: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchesService,
        {
          provide: getRepositoryToken(Match),
          useValue: repo,
        },
      ],
    }).compile();

    service = module.get<MatchesService>(MatchesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByVolunteerId', () => {
    it('returns the matches for the volunteer', async () => {
      repo.find.mockResolvedValue(matches);

      const result = await service.findByVolunteerId(7);

      expect(result).toBe(matches);
      expect(repo.find).toHaveBeenCalledWith({ where: { volunteerId: 7 } });
    });

    it('returns an empty array when the volunteer has no matches', async () => {
      repo.find.mockResolvedValue([]);

      await expect(service.findByVolunteerId(7)).resolves.toEqual([]);
      expect(repo.find).toHaveBeenCalledWith({ where: { volunteerId: 7 } });
    });
  });
});
