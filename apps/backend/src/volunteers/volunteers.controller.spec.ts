import { Test, TestingModule } from '@nestjs/testing';
import { VolunteersController } from './volunteers.controller';
import { VolunteersService } from './volunteers.service';
import { FosterVolunteer } from './volunteers.entity';
import { VolunteerStatus } from './volunteers.types';

describe('VolunteersController', () => {
  let controller: VolunteersController;
  let service: { setStatus: jest.Mock };

  beforeEach(async () => {
    service = { setStatus: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VolunteersController],
      providers: [{ provide: VolunteersService, useValue: service }],
    }).compile();

    controller = module.get<VolunteersController>(VolunteersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('deactivate', () => {
    it('should call service.setStatus(id, Inactive) with the parsed id', async () => {
      const volunteer = {
        volunteerId: 1,
        status: VolunteerStatus.INACTIVE,
      } as FosterVolunteer;
      service.setStatus.mockResolvedValue(volunteer);

      const result = await controller.deactivate(1);

      expect(service.setStatus).toHaveBeenCalledWith(
        1,
        VolunteerStatus.INACTIVE,
      );
      expect(result).toEqual(volunteer);
    });
  });

  describe('activate', () => {
    it('should call service.setStatus(id, Active) with the parsed id', async () => {
      const volunteer = {
        volunteerId: 1,
        status: VolunteerStatus.ACTIVE,
      } as FosterVolunteer;
      service.setStatus.mockResolvedValue(volunteer);

      const result = await controller.activate(1);

      expect(service.setStatus).toHaveBeenCalledWith(1, VolunteerStatus.ACTIVE);
      expect(result).toEqual(volunteer);
    });
  });
});
