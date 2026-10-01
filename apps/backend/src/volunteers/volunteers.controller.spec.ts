import { Test, TestingModule } from '@nestjs/testing';
import { VolunteersController } from './volunteers.controller';
import { VolunteersService } from './volunteers.service';
import { FosterVolunteer } from './volunteers.entity';

describe('VolunteersController', () => {
  let controller: VolunteersController;

  const mockVolunteers = [
    { volunteerId: 1, firstName: 'Jane', lastName: 'Doe' },
    { volunteerId: 2, firstName: 'John', lastName: 'Smith' },
  ] as FosterVolunteer[];

  const mockVolunteersService = {
    getAllVolunteers: jest.fn(),
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

  describe('getAllVolunteers', () => {
    it('should return all volunteers', async () => {
      mockVolunteersService.getAllVolunteers.mockResolvedValue(mockVolunteers);

      const result = await controller.getAllVolunteers();

      expect(result).toEqual(mockVolunteers);
      expect(mockVolunteersService.getAllVolunteers).toHaveBeenCalled();
    });

    it('should return an empty array when there are no volunteers', async () => {
      mockVolunteersService.getAllVolunteers.mockResolvedValue([]);

      const result = await controller.getAllVolunteers();

      expect(result).toEqual([]);
    });
  });
});
