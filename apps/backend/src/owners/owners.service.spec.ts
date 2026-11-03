import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OwnersService } from './owners.service';
import { Owner } from './owners.entity';
import { CognitoService } from '../aws/cognito/cognito.service';

describe('OwnersService', () => {
  let service: OwnersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OwnersService,
        {
          provide: getRepositoryToken(Owner),
          useValue: {},
        },
        { provide: CognitoService, useValue: {} },
      ],
    }).compile();

    service = module.get<OwnersService>(OwnersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
