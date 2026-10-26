import { ArrayUnique, IsArray, IsEnum, IsOptional } from 'class-validator';
import { FosterType } from '../volunteers.types';
import { AtLeastOneFosterTypePreference } from './validators/at-least-one-foster-type-preference.validator';

export class UpdateFosterTypePreferencesDto {
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(FosterType, { each: true })
  added?: FosterType[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(FosterType, { each: true })
  removed?: FosterType[];

  @AtLeastOneFosterTypePreference()
  private readonly atLeastOnePreference?: boolean;
}
