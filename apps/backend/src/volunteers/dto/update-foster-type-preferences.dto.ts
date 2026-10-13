import { IsArray, IsEnum, IsOptional } from 'class-validator';
import { FosterType } from '../volunteers.types';

export class UpdateFosterTypePreferencesDto {
  @IsOptional()
  @IsArray()
  @IsEnum(FosterType, { each: true })
  added?: FosterType[];

  @IsOptional()
  @IsArray()
  @IsEnum(FosterType, { each: true })
  removed?: FosterType[];
}
