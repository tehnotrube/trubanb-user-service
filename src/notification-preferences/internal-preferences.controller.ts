import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { NotificationPreferencesService } from './notification-preferences.service';

@Controller('api/users/internal')
export class InternalPreferencesController {
  constructor(
    private readonly preferencesService: NotificationPreferencesService,
  ) {}

  @Get(':userId/preferences')
  async getPreferencesForUser(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.preferencesService.getPreferencesByUserId(userId);
  }
}
