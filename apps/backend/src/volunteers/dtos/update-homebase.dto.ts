import { IsEnum } from 'class-validator';
import { Homebase } from '../../types';

export class UpdateHomebaseDto {
  @IsEnum(Homebase)
  homebase!: Homebase;
}
