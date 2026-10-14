import { IsNonEmptyString } from '../../utils/dtos/utils.dto';

export class DenyMatchDto {
  @IsNonEmptyString()
  deniedReason!: string;
}
