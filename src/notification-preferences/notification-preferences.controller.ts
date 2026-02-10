import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  UseGuards,
  ParseEnumPipe,
} from '@nestjs/common';
import { NotificationPreferencesService } from './notification-preferences.service';
import { UpdatePreferenceDto } from './dto/update-preference.dto';
import { BulkUpdatePreferencesDto } from './dto/bulk-update-preferences.dto';
import { NotificationType } from './enums/notification-type.enum';
import { KongJwtGuard, CurrentUser } from '../auth';
import type { AuthenticatedUser } from '../auth';

@Controller('api/users/notification-preferences')
@UseGuards(KongJwtGuard)
export class NotificationPreferencesController {
  constructor(
    private readonly preferencesService: NotificationPreferencesService,
  ) {}

  @Get()
  async getPreferences(@CurrentUser() user: AuthenticatedUser) {
    return this.preferencesService.getPreferencesForUser(user.id);
  }

  @Put(':type')
  async updatePreference(
    @CurrentUser() user: AuthenticatedUser,
    @Param('type', new ParseEnumPipe(NotificationType)) type: NotificationType,
    @Body() dto: UpdatePreferenceDto,
  ) {
    return this.preferencesService.updatePreference(user.id, type, dto);
  }

  @Put()
  async bulkUpdatePreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BulkUpdatePreferencesDto,
  ) {
    return this.preferencesService.bulkUpdatePreferences(user.id, dto);
  }
}
