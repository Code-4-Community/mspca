import { IsEmail, IsEnum } from 'class-validator';
import { CognitoRole } from '../cognito.types';
import { IsNonEmptyString } from '../../../utils/dtos/utils.dto';

export class CreateCognitoUserDto {
  @IsNonEmptyString()
  firstName!: string;

  @IsNonEmptyString()
  lastName!: string;

  @IsNonEmptyString()
  @IsEmail()
  email!: string;

  @IsEnum(CognitoRole)
  role!: CognitoRole;
}
