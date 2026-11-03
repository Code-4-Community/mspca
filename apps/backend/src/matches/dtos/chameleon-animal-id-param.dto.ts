import { PickType } from '@nestjs/swagger';
import { CreateMatchDto } from './create-match.dto';

export class ChameleonAnimalIdParamDto extends PickType(CreateMatchDto, [
  'chameleonAnimalId',
] as const) {}
