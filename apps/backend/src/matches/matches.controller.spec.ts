import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';
import { MatchStatus } from './matches.types';
import { Match } from './matches.entity';
import { CreateMatchDto } from './dtos/create-match.dto';

describe('MatchesController', () => {
  let controller: MatchesController;
  let service: { create: jest.Mock; withdraw: jest.Mock };

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      withdraw: jest.fn(),
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
      service.create.mockResolvedValue({ matchId: 10 } as Match);
      const body = { volunteerId: 1, chameleonAnimalId: 42 };

      const match = await controller.createMatch(body);

      expect(service.create).toHaveBeenCalledWith(body);
      expect(match.matchId).toEqual(10);
    });

    // The handler adds no guards of its own, so whatever the service throws
    // has to come back out untouched.
    it('surfaces a NotFoundException from the service', async () => {
      service.create.mockRejectedValue(
        new NotFoundException('Volunteer not found'),
      );

      await expect(
        controller.createMatch({ volunteerId: 999, chameleonAnimalId: 42 }),
      ).rejects.toThrow(NotFoundException);
    });

    // Invalid bodies never reach the handler - the global ValidationPipe
    // rejects them first, so run the real pipe over the DTO here.
    it.each([
      { volunteerId: 0, chameleonAnimalId: 42 },
      { volunteerId: -1, chameleonAnimalId: 42 },
      { volunteerId: 1.5, chameleonAnimalId: 42 },
      { volunteerId: 1, chameleonAnimalId: 0 },
      { volunteerId: 1, chameleonAnimalId: 'abc' },
      { chameleonAnimalId: 42 },
    ])('rejects the invalid body %j', async (body) => {
      const pipe = new ValidationPipe({ whitelist: true });

      await expect(
        pipe.transform(body, { type: 'body', metatype: CreateMatchDto }),
      ).rejects.toThrow(BadRequestException);
      expect(service.create).not.toHaveBeenCalled();
    });
  });

  describe('withdrawMatch', () => {
    it('withdraws a match with a valid ID', async () => {
      service.withdraw.mockResolvedValue({
        matchId: 10,
        status: MatchStatus.WITHDRAWN,
      } as Match);

      const match = await controller.withdrawMatch(10);

      expect(service.withdraw).toHaveBeenCalledWith(10);
      expect(match.status).toEqual(MatchStatus.WITHDRAWN);
    });

    it('surfaces a NotFoundException from the service', async () => {
      service.withdraw.mockRejectedValue(
        new NotFoundException('Match not found'),
      );

      await expect(controller.withdrawMatch(999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('surfaces a BadRequestException from the service', async () => {
      service.withdraw.mockRejectedValue(
        new BadRequestException('Only pending matches can be withdrawn'),
      );

      await expect(controller.withdrawMatch(10)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
