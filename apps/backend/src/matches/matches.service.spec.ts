import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
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
  } as Match;

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
    it('should approve a pending match and set its status to Active', async () => {
      mockRepo.findOneBy.mockResolvedValue({ ...mockMatch });
      mockRepo.save.mockImplementation((m) => Promise.resolve(m));

      const result = await service.approveMatch(1);

      expect(result.status).toBe(MatchStatus.ACTIVE);
      expect(mockRepo.findOneBy).toHaveBeenCalledWith({ matchId: 1 });
      expect(mockRepo.save).toHaveBeenCalledWith({
        ...mockMatch,
        status: MatchStatus.ACTIVE,
      });
    });

    it('should throw NotFoundException when match does not exist', async () => {
      mockRepo.findOneBy.mockResolvedValue(null);

      await expect(service.approveMatch(999)).rejects.toThrow(
        new NotFoundException('Match with id 999 not found'),
      );
      expect(mockRepo.findOneBy).toHaveBeenCalledWith({ matchId: 999 });
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when match is not pending', async () => {
      mockRepo.findOneBy.mockResolvedValue({
        ...mockMatch,
        status: MatchStatus.ACTIVE,
      });

      await expect(service.approveMatch(1)).rejects.toThrow(
        new BadRequestException('Match with id 1 is not pending'),
      );
      expect(mockRepo.findOneBy).toHaveBeenCalledWith({ matchId: 1 });
      expect(mockRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('denyMatch', () => {
    it('should deny a pending match and save the reason', async () => {
      mockRepo.findOneBy.mockResolvedValue({ ...mockMatch });
      mockRepo.save.mockImplementation((m) => Promise.resolve(m));

      const result = await service.denyMatch(1, 'Not enough space in home');

      expect(result.status).toBe(MatchStatus.DENIED);
      expect(result.deniedReason).toBe('Not enough space in home');
      expect(mockRepo.findOneBy).toHaveBeenCalledWith({ matchId: 1 });
      expect(mockRepo.save).toHaveBeenCalledWith({
        ...mockMatch,
        status: MatchStatus.DENIED,
        deniedReason: 'Not enough space in home',
      });
    });

    it('should throw NotFoundException when match does not exist', async () => {
      mockRepo.findOneBy.mockResolvedValue(null);

      await expect(service.denyMatch(999, 'Some reason')).rejects.toThrow(
        new NotFoundException('Match with id 999 not found'),
      );
      expect(mockRepo.findOneBy).toHaveBeenCalledWith({ matchId: 999 });
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when match is not pending', async () => {
      mockRepo.findOneBy.mockResolvedValue({
        ...mockMatch,
        status: MatchStatus.DENIED,
      });

      await expect(service.denyMatch(1, 'Some reason')).rejects.toThrow(
        new BadRequestException('Match with id 1 is not pending'),
      );
      expect(mockRepo.findOneBy).toHaveBeenCalledWith({ matchId: 1 });
      expect(mockRepo.save).not.toHaveBeenCalled();
    });
  });
});
