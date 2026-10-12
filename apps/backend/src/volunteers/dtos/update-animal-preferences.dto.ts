import { IsArray, IsInt, IsOptional, IsPositive } from 'class-validator';

export class UpdateAnimalPreferencesDto {
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @IsPositive({ each: true })
  added?: number[];

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @IsPositive({ each: true })
  removed?: number[];
}
