import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsInstance,
  IsOptional,
  Length,
  Matches,
  MaxLength,
  ValidateNested,
  registerDecorator,
} from 'class-validator';
import { IsNonEmptyString } from '../../utils/dtos/utils.dto';

/**
 * Bounds the byte length of `EmailAttachmentDto.content`. Pair with
 * @IsInstance(Buffer) on the same field - this validator assumes the
 * value is already a Buffer.
 */
function MaxBufferSize(maxBytes: number) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'maxBufferSize',
      target: object.constructor,
      propertyName,
      validator: {
        validate: (value: Buffer) => value.length <= maxBytes,
        defaultMessage: () =>
          `${propertyName} must be at most ${maxBytes} bytes`,
      },
    });
  };
}

/**
 * Single attachment passed to SES. `content` is the raw file bytes;
 * nodemailer handles base64-encoding it into the MIME message.
 */
export class EmailAttachmentDto {
  @IsNonEmptyString()
  @MaxLength(255)
  // Reject `/` and `\` to prevent path-traversal-style filenames
  // (e.g. `../../etc/passwd`) from being used as the attachment name.
  @Matches(/^[^/\\]+$/, {
    message: 'filename must not contain path separators',
  })
  filename!: string;

  // Runtime guard: confirms `content` is a Node.js Buffer instance
  @IsInstance(Buffer)
  // Cap each attachment at 10 MB.
  @MaxBufferSize(10 * 1024 * 1024)
  content!: Buffer;
}

/**
 * Input shape for EmailsService.sendEmails. All validation lives here
 */
export class SendEmailDTO {
  @IsEmail()
  @Length(1, 255)
  toEmail!: string;

  @IsArray()
  @IsOptional()
  @ArrayUnique()
  @IsEmail({}, { each: true })
  @Length(1, 255, { each: true })
  ccEmails?: string[];

  @IsArray()
  @IsOptional()
  @ArrayUnique()
  @IsEmail({}, { each: true })
  @Length(1, 255, { each: true })
  bccEmails?: string[];

  @IsNonEmptyString()
  @Length(1, 255)
  // Reject carriage return (\r) and line feed (\n) to prevent MIME header injection
  @Matches(/^[^\r\n]+$/, {
    message: 'subject must not contain newlines',
  })
  subject!: string;

  @IsNonEmptyString()
  // Roughly 5-10 KB of string memory, far below SES's 40 MB raw-message cap
  @MaxLength(5000)
  bodyHtml!: string;

  @IsArray()
  @IsOptional()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => EmailAttachmentDto)
  attachments?: EmailAttachmentDto[];
}
