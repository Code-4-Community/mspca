import { Test, TestingModule } from '@nestjs/testing';
import { CoordinatorsController } from './coordinators.controller';
import { CoordinatorsService } from './coordinators.service';

describe('CoordinatorsController', () => {
  let controller: CoordinatorsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CoordinatorsController],
      providers: [
        {
          provide: CoordinatorsService,
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<CoordinatorsController>(CoordinatorsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
