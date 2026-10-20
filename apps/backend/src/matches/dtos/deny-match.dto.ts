import { IsNonEmptyString } from '../../utils/decorators/is-non-empty-string.decorator';

export class DenyMatchDto {
  @IsNonEmptyString()
  deniedReason!: string;
}
