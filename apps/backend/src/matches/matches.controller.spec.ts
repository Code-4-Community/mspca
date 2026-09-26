import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { validate } from 'class-validator';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';
import { DenyMatchDto } from './deny-match.dto';
import { MatchStatus } from './matches.types';

describe('MatchesController', () => {
  let controller: MatchesController;

  const mockMatch = {
    matchId: 1,
    status: MatchStatus.COMPLETE,
    deniedReason: null,
  };

  const mockMatchesService = {
    approveMatch: jest.fn(),
    denyMatch: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MatchesController],
      providers: [{ provide: MatchesService, useValue: mockMatchesService }],
    }).compile();

    controller = module.get<MatchesController>(MatchesController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('approveMatch', () => {
    it('should approve and return the match when found', async () => {
      mockMatchesService.approveMatch.mockResolvedValue(mockMatch);

      const result = await controller.approveMatch('1');

      expect(result).toEqual(mockMatch);
      expect(mockMatchesService.approveMatch).toHaveBeenCalledWith(1);
    });

    it('should throw NotFoundException when match does not exist', async () => {
      mockMatchesService.approveMatch.mockResolvedValue(null);

      await expect(controller.approveMatch('999')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when id is invalid', async () => {
      await expect(controller.approveMatch('0')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('denyMatch', () => {
    it('should deny and return the match when found', async () => {
      const deniedMatch = {
        ...mockMatch,
        status: MatchStatus.DENIED,
        deniedReason: 'Not enough space',
      };
      mockMatchesService.denyMatch.mockResolvedValue(deniedMatch);

      const dto: DenyMatchDto = { deniedReason: 'Not enough space' };
      const result = await controller.denyMatch('1', dto);

      expect(result).toEqual(deniedMatch);
      expect(mockMatchesService.denyMatch).toHaveBeenCalledWith(
        1,
        'Not enough space',
      );
    });

    it('should throw NotFoundException when match does not exist', async () => {
      mockMatchesService.denyMatch.mockResolvedValue(null);

      const dto: DenyMatchDto = { deniedReason: 'Some reason' };
      await expect(controller.denyMatch('999', dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when id is invalid', async () => {
      const dto: DenyMatchDto = { deniedReason: 'Some reason' };
      await expect(controller.denyMatch('0', dto)).rejects.toThrow(
        BadRequestException,
      );
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
