import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ConfirmVolunteerDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @IsNotEmpty()
  code!: string;
}
