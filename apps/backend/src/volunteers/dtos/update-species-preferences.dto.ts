import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsEnum,
  ValidateIf,
} from 'class-validator';
import { FosterType } from '../volunteers.types';
import { AtLeastOneValue } from './validators/at-least-one-value.validator';

@AtLeastOneValue<UpdateSpeciesPreferencesDto>(['added', 'removed'])
export class UpdateSpeciesPreferencesDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsEnum(FosterType, { each: true })
  added?: FosterType[];

  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsEnum(FosterType, { each: true })
  removed?: FosterType[];
}
