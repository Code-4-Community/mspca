import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsEnum,
  IsOptional,
  Matches,
  MaxLength,
  MinDate,
} from 'class-validator';
import { IsNonEmptyString } from '../../utils/decorators/is-non-empty-string.decorator';
import { FosterType } from '../../volunteers/volunteers.types';

/**
 * input shape for POST /notifications.
 */
export class CreateBulkNotificationDto {
  @IsNonEmptyString()
  @MaxLength(255)
  // Reject carriage return (\r) and line feed (\n) to prevent MIME header injection
  @Matches(/^[^\r\n]+$/, {
    message: 'subject must not contain newlines',
  })
  subject!: string;

  @IsNonEmptyString()
  @MaxLength(5000)
  body!: string;

  // Omitted/empty = every active Volunteer regardless of foster type.
  @IsOptional()
  @IsArray()
  @IsEnum(FosterType, { each: true })
  filters?: FosterType[];

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  @MinDate(() => new Date(), { message: 'sendAt must be in the future' })
  sendAt?: Date;
}
