import {
  ArrayUnique,
  IsArray,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { AtLeastOneValue } from './validators/at-least-one-value.validator';

@AtLeastOneValue<UpdateAnimalPreferencesDto>(['added', 'removed'])
export class UpdateAnimalPreferencesDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(255, { each: true })
  added?: string[];

  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(255, { each: true })
  removed?: string[];
}
