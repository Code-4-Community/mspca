import { MaxLength } from 'class-validator';
import { IsNonEmptyString } from '../decorators/is-non-empty-string.decorator';

export class ChameleonAnimalIdParamDto {
  @IsNonEmptyString()
  @MaxLength(255)
  chameleonAnimalId!: string;
}
