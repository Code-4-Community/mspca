import { IsEmail, IsNumberString, Length, MaxLength } from 'class-validator';

export class ConfirmVolunteerDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  // Cognito's sign-up verification codes are always 6 digits.
  @IsNumberString({ no_symbols: true })
  @Length(6, 6)
  code!: string;
}
