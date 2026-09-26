import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MatchesService } from './matches.service';
import { Match } from './matches.entity';
import { MatchStatus } from './matches.types';

describe('MatchesService', () => {
  let service: MatchesService;

  const mockMatch = {
    matchId: 1,
    status: MatchStatus.PENDING,
    deniedReason: null,
  };

  const mockRepo = {
    findOneBy: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchesService,
        { provide: getRepositoryToken(Match), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<MatchesService>(MatchesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('approveMatch', () => {
    it('should approve a match and return it with updated status', async () => {
      mockRepo.findOneBy.mockResolvedValue({ ...mockMatch });
      mockRepo.save.mockImplementation((m) => Promise.resolve(m));

      const result = await service.approveMatch(1);

      if (!result) {
        throw new Error('Expected a match, got null');
      }

      expect(result.status).toBe(MatchStatus.COMPLETE);
      expect(mockRepo.findOneBy).toHaveBeenCalledWith({ matchId: 1 });
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('should return null when match does not exist', async () => {
      mockRepo.findOneBy.mockResolvedValue(null);

      const result = await service.approveMatch(999);

      expect(result).toBeNull();
      expect(mockRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('denyMatch', () => {
    it('should deny a match and save the reason', async () => {
      mockRepo.findOneBy.mockResolvedValue({ ...mockMatch });
      mockRepo.save.mockImplementation((m) => Promise.resolve(m));

      const result = await service.denyMatch(1, 'Not enough space in home');

      if (!result) {
        throw new Error('Expected a match, got null');
      }

      expect(result.status).toBe(MatchStatus.DENIED);
      expect(result.deniedReason).toBe('Not enough space in home');
      expect(mockRepo.findOneBy).toHaveBeenCalledWith({ matchId: 1 });
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('should return null when match does not exist', async () => {
      mockRepo.findOneBy.mockResolvedValue(null);

      const result = await service.denyMatch(999, 'Some reason');

      expect(result).toBeNull();
      expect(mockRepo.save).not.toHaveBeenCalled();
    });
  });
});
