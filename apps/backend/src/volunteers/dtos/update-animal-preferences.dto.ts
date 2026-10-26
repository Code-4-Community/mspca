import {
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsPositive,
} from 'class-validator';

export class UpdateAnimalPreferencesDto {
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @IsPositive({ each: true })
  added?: number[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @IsPositive({ each: true })
  removed?: number[];
}
