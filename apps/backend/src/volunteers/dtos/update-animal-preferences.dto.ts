import {
  ArrayUnique,
  IsArray,
  IsInt,
  ValidateIf,
  IsPositive,
} from 'class-validator';

export class UpdateAnimalPreferencesDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @IsPositive({ each: true })
  added?: number[];

  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @IsPositive({ each: true })
  removed?: number[];
}
