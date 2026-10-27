import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiExcludeEndpoint,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CreateBulkNotificationDto } from './dtos/create-bulk-notification.dto';
import { NotificationsDispatchGuard } from './notifications.dispatch.guard';

@ApiTags('Notifications')
// @ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  // TODO: role/cognito auth: possible considerations of how roles are modelled (cognito groups vs db role)
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary:
      'Email all or every active Volunteer matching the given foster types',
  })
  @ApiResponse({
    status: HttpStatus.ACCEPTED,
    description:
      'The notification was sent, or scheduled when sendAt was given',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'The request body failed validation',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'The AWS Scheduler or SES sender email is not configured',
  })
  async createBulkNotification(
    @Body() body: CreateBulkNotificationDto,
  ): Promise<void> {
    await this.notificationsService.createBulkNotification(body);
  }

  /**
   * Sends a notification whose scheduled time has arrived.
   *
   * Called only by the scheduled-notification Lambda
   * TODO: implement auth: lambdas don't use cognito, so it can't call our own endpoints (which will have cognito auth on them)
   * recipients are resolved at call time & not at schedule time, so Volunteers who went inactive in the meantime are left out
   *
   * Retry after a partial send repeats earlier batches, sends at least once
   */
  @Post('send-scheduled')
  @UseGuards(NotificationsDispatchGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiExcludeEndpoint()
  async dispatchNotification(
    @Body() body: CreateBulkNotificationDto,
  ): Promise<void> {
    return this.notificationsService.sendNow(body);
  }
}
