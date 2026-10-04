import { IsEmail, IsEnum, IsString } from 'class-validator';
import { CognitoRole } from '../cognito.types';

export class CreateCognitoUserDto {
  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsEmail()
  email!: string;

  @IsEnum(CognitoRole)
  role!: CognitoRole;
}
