import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { VolunteersModule } from './volunteers.module';
import { FosterVolunteer } from './volunteers.entity';
import { Match } from '../matches/matches.entity';
import { FosterCoordinator } from '../coordinators/coordinators.entity';
import { MatchStatus } from '../matches/matches.types';

describe('VolunteersModule (HTTP)', () => {
  let app: INestApplication;
  let baseUrl: string;
  const volunteerRepo = { existsBy: jest.fn() };
  const matchRepo = { find: jest.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [VolunteersModule],
    })
      .overrideProvider(getRepositoryToken(FosterVolunteer))
      .useValue(volunteerRepo)
      .overrideProvider(getRepositoryToken(Match))
      .useValue(matchRepo)
      .overrideProvider(getRepositoryToken(FosterCoordinator))
      .useValue({})
      .compile();

    app = moduleRef.createNestApplication();
    await app.listen(0);
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  const getMatches = (id: string) =>
    fetch(`${baseUrl}/volunteers/${id}/matches`);

  it('returns 200 with the matches', async () => {
    const match = {
      matchId: 1,
      volunteerId: 7,
      chameleonAnimalId: 42,
      status: MatchStatus.PENDING,
      deniedReason: null,
    };
    volunteerRepo.existsBy.mockResolvedValue(true);
    matchRepo.find.mockResolvedValue([match]);

    const res = await getMatches('7');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([match]);
  });

  it('returns 200 with [] when the volunteer has no matches', async () => {
    volunteerRepo.existsBy.mockResolvedValue(true);
    matchRepo.find.mockResolvedValue([]);

    const res = await getMatches('7');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('returns 404 for an unknown volunteer', async () => {
    volunteerRepo.existsBy.mockResolvedValue(false);

    expect((await getMatches('999')).status).toBe(404);
  });

  it('returns 400 for a non-numeric id', async () => {
    expect((await getMatches('abc')).status).toBe(400);
  });
});
