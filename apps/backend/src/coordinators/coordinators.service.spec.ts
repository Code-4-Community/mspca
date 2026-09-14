import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CoordinatorsService } from './coordinators.service';
import { FosterCoordinator } from './coordinators.entity';

describe('CoordinatorsService', () => {
  let service: CoordinatorsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoordinatorsService,
        {
          provide: getRepositoryToken(FosterCoordinator),
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<CoordinatorsService>(CoordinatorsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
