import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { validate } from 'class-validator';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';
import { MatchStatus } from './matches.types';
import { Match } from './matches.entity';
import { CreateMatchDto } from './dtos/create-match.dto';
import { DenyMatchDto } from './dtos/deny-match.dto';
import { AnimalsService } from '../animals/animals.service';

describe('MatchesController', () => {
  let controller: MatchesController;
  let service: {
    create: jest.Mock;
    withdraw: jest.Mock;
    approveMatch: jest.Mock;
    denyMatch: jest.Mock;
  };
  let animalsService: { findByChameleonIdOrFail: jest.Mock };

  const mockMatch = {
    matchId: 1,
    status: MatchStatus.PENDING,
    deniedReason: null,
  } as Match;

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      withdraw: jest.fn(),
      approveMatch: jest.fn(),
      denyMatch: jest.fn(),
    };
    animalsService = { findByChameleonIdOrFail: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MatchesController],
      providers: [
        { provide: MatchesService, useValue: service },
        { provide: AnimalsService, useValue: animalsService },
      ],
    }).compile();

    controller = module.get<MatchesController>(MatchesController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createMatch', () => {
    it('passes the body through to the service', async () => {
      animalsService.findByChameleonIdOrFail.mockResolvedValue({});
      service.create.mockResolvedValue({ matchId: 10 } as Match);
      const body = { volunteerId: 1, chameleonAnimalId: 42 };

      const match = await controller.createMatch(body);

      expect(animalsService.findByChameleonIdOrFail).toHaveBeenCalledWith(42);
      expect(service.create).toHaveBeenCalledWith(body);
      expect(match.matchId).toEqual(10);
    });

    it('does not create a match when the animal does not exist', async () => {
      const error = new NotFoundException(
        'Animal with Chameleon ID 42 not found',
      );
      animalsService.findByChameleonIdOrFail.mockRejectedValue(error);

      await expect(
        controller.createMatch({ volunteerId: 1, chameleonAnimalId: 42 }),
      ).rejects.toThrow(error);
      expect(animalsService.findByChameleonIdOrFail).toHaveBeenCalledWith(42);
      expect(service.create).not.toHaveBeenCalled();
    });

    // Apart from the animal check, whatever the service throws has to come
    // back out untouched.
    it('surfaces a NotFoundException from the service', async () => {
      animalsService.findByChameleonIdOrFail.mockResolvedValue({});
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

  describe('approveMatch', () => {
    it('should approve and return the match when found', async () => {
      const approvedMatch = {
        ...mockMatch,
        status: MatchStatus.ACTIVE,
      } as Match;
      service.approveMatch.mockResolvedValue(approvedMatch);

      const result = await controller.approveMatch(1);

      expect(result).toEqual(approvedMatch);
      expect(service.approveMatch).toHaveBeenCalledWith(1);
    });

    it('should throw NotFoundException when match does not exist', async () => {
      service.approveMatch.mockRejectedValue(
        new NotFoundException('Match with id 999 not found'),
      );

      await expect(controller.approveMatch(999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when id is invalid', async () => {
      await expect(controller.approveMatch(0)).rejects.toThrow(
        BadRequestException,
      );
      expect(service.approveMatch).not.toHaveBeenCalled();
    });
  });

  describe('denyMatch', () => {
    it('should deny and return the match when found', async () => {
      const deniedMatch = {
        ...mockMatch,
        status: MatchStatus.DENIED,
        deniedReason: 'Not enough space',
      } as Match;
      service.denyMatch.mockResolvedValue(deniedMatch);

      const dto: DenyMatchDto = { deniedReason: 'Not enough space' };
      const result = await controller.denyMatch(1, dto);

      expect(result).toEqual(deniedMatch);
      expect(service.denyMatch).toHaveBeenCalledWith(1, 'Not enough space');
    });

    it('should throw NotFoundException when match does not exist', async () => {
      service.denyMatch.mockRejectedValue(
        new NotFoundException('Match with id 999 not found'),
      );

      const dto: DenyMatchDto = { deniedReason: 'Some reason' };

      await expect(controller.denyMatch(999, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when id is invalid', async () => {
      const dto: DenyMatchDto = { deniedReason: 'Some reason' };

      await expect(controller.denyMatch(0, dto)).rejects.toThrow(
        BadRequestException,
      );

      expect(service.denyMatch).not.toHaveBeenCalled();
    });
  });

  describe('DenyMatchDto validation', () => {
    it('should fail validation when deniedReason is empty', async () => {
      const dto = new DenyMatchDto();
      dto.deniedReason = '';

      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('deniedReason');
    });

    it('should fail validation when deniedReason is missing', async () => {
      const dto = new DenyMatchDto();

      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
    });

    it('should pass validation when deniedReason is a non-empty string', async () => {
      const dto = new DenyMatchDto();
      dto.deniedReason = 'Not enough space';

      const errors = await validate(dto);

      expect(errors.length).toBe(0);
    });
  });
});
