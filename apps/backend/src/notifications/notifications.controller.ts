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
import { Public } from '../aws/cognito/cognito.decorator';

@ApiTags('Notifications')
// @ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

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
    description: 'Scheduling failed, or every email batch failed to send',
  })
  async createBulkNotification(
    @Body() body: CreateBulkNotificationDto,
  ): Promise<void> {
    await this.notificationsService.createBulkNotification(body);
  }

  /**
   * Sends a notification whose scheduled time has arrived.
   *
   * Called only by the scheduled-notification Lambda. The Lambda has no Cognito
   * token, so the route skips Cognito (@Public) and NotificationsDispatchGuard
   * checks its shared secret instead.
   *
   * recipients are resolved at call time & not at schedule time, so Volunteers who went inactive in the meantime can be left out
   *
   * Retry after a partial send repeats earlier batches, sends at least once
   */
  @Post('send-scheduled')
  @Public()
  @UseGuards(NotificationsDispatchGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  // Hidden from Swagger: only the dispatch Lambda calls this. The decorators below
  // document its responses in code.
  @ApiExcludeEndpoint()
  @ApiOperation({
    summary: 'Send a scheduled notification (called by the dispatch Lambda)',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'The notification was sent to at least one recipient',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'The request body failed validation',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'The dispatch secret header is missing or invalid',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Every batch failed to send',
  })
  async dispatchNotification(
    @Body() body: CreateBulkNotificationDto,
  ): Promise<void> {
    return this.notificationsService.sendNow(body);
  }
}
