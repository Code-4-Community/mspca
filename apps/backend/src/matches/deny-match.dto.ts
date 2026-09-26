import { IsNotEmpty, IsString } from 'class-validator';

export class DenyMatchDto {
  @IsNotEmpty()
  @IsString()
  deniedReason!: string;
}