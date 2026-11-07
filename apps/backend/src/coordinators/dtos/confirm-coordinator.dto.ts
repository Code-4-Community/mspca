import { Transform } from 'class-transformer';
import { IsEmail, Matches, MaxLength } from 'class-validator';

export class ConfirmCoordinatorDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(255)
  @Matches(/^[^\s@]+@mspca\.org$/, {
    message: 'Email must end in @mspca.org',
  })
  email!: string;

  @Matches(/^\d{6}$/, {
    message: 'Verification code must be 6 digits',
  })
  code!: string;
}
