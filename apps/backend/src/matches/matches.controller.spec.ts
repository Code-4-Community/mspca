import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';
import { MatchStatus } from './matches.types';
import { Match } from './matches.entity';

describe('MatchesController', () => {
  let controller: MatchesController;
  let service: { create: jest.Mock; withdraw: jest.Mock };

  beforeEach(async () => {
    service = {
      create: jest.fn().mockResolvedValue({ matchId: 10 } as Match),
      withdraw: jest.fn().mockResolvedValue({
        matchId: 10,
        status: MatchStatus.WITHDRAWN,
      } as Match),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MatchesController],
      providers: [
        {
          provide: MatchesService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<MatchesController>(MatchesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createMatch', () => {
    it('passes the body through to the service', async () => {
      const body = { volunteerId: 1, chameleonAnimalId: 42 };

      const match = await controller.createMatch(body);

      expect(service.create).toHaveBeenCalledWith(body);
      expect(match.matchId).toEqual(10);
    });
  });

  describe('withdrawMatch', () => {
    it('withdraws a match with a valid ID', async () => {
      const match = await controller.withdrawMatch(10);

      expect(service.withdraw).toHaveBeenCalledWith(10);
      expect(match.status).toEqual(MatchStatus.WITHDRAWN);
    });

    // Non-numeric IDs are rejected by ParseIntPipe before the handler runs,
    // so only the values the pipe lets through are checked here.
    it.each([0, -1])('rejects the invalid ID %i', async (matchId) => {
      await expect(controller.withdrawMatch(matchId)).rejects.toThrow(
        BadRequestException,
      );
      expect(service.withdraw).not.toHaveBeenCalled();
    });
  });
});
