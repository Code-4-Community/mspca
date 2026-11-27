import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';
import { FosterStaff } from './staff.entity';
import { Homebase } from '../types';
import { StaffType } from './staff.types';
import { CreateStaffDto } from './dtos/create-staff.dto';
import { ConfirmStaffDto } from './dtos/confirm-staff.dto';
import { AssignCoordinatorsDto } from './dtos/assign-coordinators.dto';

describe('StaffController', () => {
  let controller: StaffController;
  let service: {
    create: jest.Mock;
    confirm: jest.Mock;
    deactivate: jest.Mock;
    activate: jest.Mock;
    assignCoordinators: jest.Mock;
  };

  const dto = {
    firstName: 'Jane',
    lastName: 'Doe',
    phone: '+16175551234',
    secondaryPhone: null,
    email: 'jane.doe@mspca.org',
    password: 'Str0ng!Password',
    address: '123 Main St',
    city: 'Boston',
    zipcode: '02101',
    homebase: Homebase.BOSTON,
    notes: null,
    staffType: StaffType.SHELTER,
  } as CreateStaffDto;

  const confirmDto = {
    email: 'jane.doe@mspca.org',
    code: '123456',
  } as ConfirmStaffDto;

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      confirm: jest.fn(),
      deactivate: jest.fn(),
      activate: jest.fn(),
      assignCoordinators: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StaffController],
      providers: [{ provide: StaffService, useValue: service }],
    }).compile();

    controller = module.get<StaffController>(StaffController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('delegates creation to the service', async () => {
      const profile = {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        secondaryPhone: dto.secondaryPhone,
        email: dto.email,
        address: dto.address,
        city: dto.city,
        zipcode: dto.zipcode,
        homebase: dto.homebase,
        notes: dto.notes,
        staffType: dto.staffType,
      };

      const created = {
        staffId: 1,
        ...profile,
        active: true,
        cognitoSub: 'cognito-sub-123',
        assignedCoordinators: [],
      } as FosterStaff;

      service.create.mockResolvedValue(created);

      const result = await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toBe(created);
    });

    it('propagates service errors', async () => {
      const error = new Error('Service failure');
      service.create.mockRejectedValue(error);

      await expect(controller.create(dto)).rejects.toBe(error);
    });
  });

  describe('confirm', () => {
    it('delegates confirmation to the service', async () => {
      service.confirm.mockResolvedValue(undefined);

      await controller.confirm(confirmDto);

      expect(service.confirm).toHaveBeenCalledWith(confirmDto);
    });

    it('propagates service errors', async () => {
      const error = new Error('Invalid code');
      service.confirm.mockRejectedValue(error);

      await expect(controller.confirm(confirmDto)).rejects.toBe(error);
    });
  });

  describe('deactivate', () => {
    it('should call service.deactivate with the parsed id', async () => {
      const staff = {
        staffId: 1,
        active: false,
      } as FosterStaff;
      service.deactivate.mockResolvedValue(staff);

      const result = await controller.deactivate(1);

      expect(service.deactivate).toHaveBeenCalledWith(1);
      expect(result).toEqual(staff);
    });

    it('propagates NotFoundException thrown by the service', async () => {
      service.deactivate.mockRejectedValue(
        new NotFoundException('Staff member with ID 999 not found'),
      );

      await expect(controller.deactivate(999)).rejects.toThrow(
        new NotFoundException('Staff member with ID 999 not found'),
      );
    });
  });

  describe('activate', () => {
    it('should call service.activate with the parsed id', async () => {
      const staff = {
        staffId: 1,
        active: true,
      } as FosterStaff;
      service.activate.mockResolvedValue(staff);

      const result = await controller.activate(1);

      expect(service.activate).toHaveBeenCalledWith(1);
      expect(result).toEqual(staff);
    });

    it('propagates NotFoundException thrown by the service', async () => {
      service.activate.mockRejectedValue(
        new NotFoundException('Staff member with ID 999 not found'),
      );

      await expect(controller.activate(999)).rejects.toThrow(
        new NotFoundException('Staff member with ID 999 not found'),
      );
    });
  });

  describe('assignCoordinators', () => {
    const assignDto = { coordinatorIds: [2, 3] } as AssignCoordinatorsDto;

    it('returns the staff member with their assigned coordinators', async () => {
      const staff = {
        staffId: 1,
        assignedCoordinators: [{ coordinatorId: 2 }, { coordinatorId: 3 }],
      } as FosterStaff;
      service.assignCoordinators.mockResolvedValue(staff);

      const result = await controller.assignCoordinators(1, assignDto);

      expect(result).toEqual(staff);
      expect(service.assignCoordinators).toHaveBeenCalledTimes(1);
      expect(service.assignCoordinators).toHaveBeenCalledWith(1, [2, 3]);
    });

    it('propagates errors thrown by the service', async () => {
      service.assignCoordinators.mockRejectedValue(
        new NotFoundException('Coordinators with IDs not found: 3'),
      );

      await expect(controller.assignCoordinators(1, assignDto)).rejects.toThrow(
        new NotFoundException('Coordinators with IDs not found: 3'),
      );
    });
  });
});
