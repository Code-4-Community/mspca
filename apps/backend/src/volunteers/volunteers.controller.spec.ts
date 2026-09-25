import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { VolunteersController } from './volunteers.controller';
import { VolunteersService } from './volunteers.service';

describe('VolunteersController', () => {
  let controller: VolunteersController;

  const mockVolunteer = {
    volunteerId: 1,
    firstName: 'Jane',
    lastName: 'Doe',
    notes: 'likes cats',
  };

  const mockVolunteersService = {
    getVolunteerById: jest.fn(),
    updateVolunteerbyId: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VolunteersController],
      providers: [
        { provide: VolunteersService, useValue: mockVolunteersService },
      ],
    }).compile();

    controller = module.get<VolunteersController>(VolunteersController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getVolunteerById', () => {
    it('should return a volunteer when found', async () => {
      mockVolunteersService.getVolunteerById.mockResolvedValue(mockVolunteer);

      const result = await controller.getVolunteerById('1');

      expect(result).toEqual(mockVolunteer);
      expect(mockVolunteersService.getVolunteerById).toHaveBeenCalledWith(1);
    });

    it('should throw NotFoundException when volunteer does not exist', async () => {
      mockVolunteersService.getVolunteerById.mockResolvedValue(null);

      await expect(controller.getVolunteerById('999')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when id is invalid', async () => {
      await expect(controller.getVolunteerById('0')).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateVolunteerbyId', () => {
    it('should update and return the volunteer when found', async () => {
      const dto = { notes: 'updated notes' };
      const updatedVolunteer = { ...mockVolunteer, ...dto };
      mockVolunteersService.updateVolunteerbyId.mockResolvedValue(updatedVolunteer);

      const result = await controller.updateVolunteerbyId('1', dto);

      expect(result).toEqual(updatedVolunteer);
      expect(mockVolunteersService.updateVolunteerbyId).toHaveBeenCalledWith(1, dto);
    });

    it('should throw NotFoundException when volunteer does not exist', async () => {
      mockVolunteersService.updateVolunteerbyId.mockResolvedValue(null);

      await expect(
        controller.updateVolunteerbyId('999', { notes: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when id is invalid', async () => {
      await expect(
        controller.updateVolunteerbyId('0', { notes: 'x' }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});