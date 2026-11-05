import { Test, TestingModule } from '@nestjs/testing';
import { OwnersController } from './owners.controller';
import { OwnersService } from './owners.service';
import { Owner } from './owners.entity';
import { CreateOwnerDto } from './dtos/create-owner.dto';

describe('OwnersController', () => {
  let controller: OwnersController;
  let service: { create: jest.Mock };

  const dto = {
    firstName: 'Jane',
    lastName: 'Doe',
    phone: '+16175551234',
    secondaryPhone: null,
    email: 'jane.doe@mspca.org',
  } as CreateOwnerDto;

  beforeEach(async () => {
    service = { create: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OwnersController],
      providers: [{ provide: OwnersService, useValue: service }],
    }).compile();

    controller = module.get<OwnersController>(OwnersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('delegates creation to the service', async () => {
      const created = {
        ownerId: 1,
        ...dto,
        active: true,
        cognitoSub: 'cognito-sub-123',
      } as Owner;

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
});
