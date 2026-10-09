import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateAnimalUpdatesDto } from './update-animal-updates.dto';

async function errorsFor(body: unknown) {
  return validate(plainToInstance(UpdateAnimalUpdatesDto, body));
}

describe('UpdateAnimalUpdatesDto', () => {
  it('accepts true', async () => {
    expect(await errorsFor({ animalUpdates: true })).toHaveLength(0);
  });

  it('accepts false', async () => {
    expect(await errorsFor({ animalUpdates: false })).toHaveLength(0);
  });

  it('rejects an empty body', async () => {
    expect(await errorsFor({})).not.toHaveLength(0);
  });

  it('rejects a string', async () => {
    expect(await errorsFor({ animalUpdates: 'true' })).not.toHaveLength(0);
  });

  it('rejects a number', async () => {
    expect(await errorsFor({ animalUpdates: 1 })).not.toHaveLength(0);
  });

  it('rejects null', async () => {
    expect(await errorsFor({ animalUpdates: null })).not.toHaveLength(0);
  });
});
