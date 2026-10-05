import { Test, TestingModule } from '@nestjs/testing';
import { CoordinatorsController } from './coordinators.controller';
import { CoordinatorsService } from './coordinators.service';
import { FosterCoordinator } from './coordinators.entity';
import { Homebase } from '../types';
import { CreateCoordinatorDto } from './dtos/create-coordinator.dto';

describe('CoordinatorsController', () => {
  let controller: CoordinatorsController;
  let service: jest.Mocked<CoordinatorsService>;

  const dto: CreateCoordinatorDto = {
    firstName: 'Jane',
    lastName: 'Doe',
    phone: '555-555-5555',
    secondaryPhone: null,
    email: 'jane.doe@mspca.org',
    homebase: Homebase.BOSTON,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CoordinatorsController],
      providers: [
        {
          provide: CoordinatorsService,
          useValue: { create: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get(CoordinatorsController);
    service = module.get(CoordinatorsService);
  });

  it('delegates creation to the service and returns the created coordinator', async () => {
    const created = {
      coordinatorId: 1,
      ...dto,
      active: true,
      cognitoSub: 'cognito-sub-123',
      assignedVolunteers: [],
    } as FosterCoordinator;
    service.create.mockResolvedValue(created);

    const result = await controller.create(dto);

    expect(service.create).toHaveBeenCalledWith(dto);
    expect(result).toBe(created);
  });
});
