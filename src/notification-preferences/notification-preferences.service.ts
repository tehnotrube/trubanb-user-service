import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationPreference } from './entities/notification-preference.entity';
import {
  NotificationType,
  HOST_NOTIFICATION_TYPES,
  GUEST_NOTIFICATION_TYPES,
} from './enums/notification-type.enum';
import { UpdatePreferenceDto } from './dto/update-preference.dto';
import { BulkUpdatePreferencesDto } from './dto/bulk-update-preferences.dto';
import { UserRole } from '../users';

@Injectable()
export class NotificationPreferencesService {
  constructor(
    @InjectRepository(NotificationPreference)
    private preferencesRepository: Repository<NotificationPreference>,
  ) {}

  async getPreferencesForUser(userId: string): Promise<NotificationPreference[]> {
    return this.preferencesRepository.find({
      where: { userId },
      order: { notificationType: 'ASC' },
    });
  }

  async updatePreference(
    userId: string,
    notificationType: NotificationType,
    dto: UpdatePreferenceDto,
  ): Promise<NotificationPreference> {
    const preference = await this.preferencesRepository.findOne({
      where: { userId, notificationType },
    });

    if (!preference) {
      throw new NotFoundException(
        `Notification preference for type ${notificationType} not found`,
      );
    }

    preference.enabled = dto.enabled;
    return this.preferencesRepository.save(preference);
  }

  async bulkUpdatePreferences(
    userId: string,
    dto: BulkUpdatePreferencesDto,
  ): Promise<NotificationPreference[]> {
    const results: NotificationPreference[] = [];

    for (const item of dto.preferences) {
      const preference = await this.preferencesRepository.findOne({
        where: { userId, notificationType: item.type },
      });

      if (preference) {
        preference.enabled = item.enabled;
        results.push(await this.preferencesRepository.save(preference));
      }
    }

    return results;
  }

  async createDefaultPreferences(
    userId: string,
    userRole: UserRole,
  ): Promise<NotificationPreference[]> {
    const typesToCreate =
      userRole === UserRole.HOST
        ? HOST_NOTIFICATION_TYPES
        : GUEST_NOTIFICATION_TYPES;

    const preferences = typesToCreate.map((type) => {
      const preference = new NotificationPreference();
      preference.userId = userId;
      preference.notificationType = type;
      preference.enabled = true;
      return preference;
    });

    return this.preferencesRepository.save(preferences);
  }

  async isNotificationEnabled(
    userId: string,
    notificationType: NotificationType,
  ): Promise<boolean> {
    const preference = await this.preferencesRepository.findOne({
      where: { userId, notificationType },
    });

    // Default to enabled if preference doesn't exist
    return preference ? preference.enabled : true;
  }

  async getPreferencesByUserId(
    userId: string,
  ): Promise<Record<NotificationType, boolean>> {
    const preferences = await this.preferencesRepository.find({
      where: { userId },
    });

    const result: Partial<Record<NotificationType, boolean>> = {};
    for (const pref of preferences) {
      result[pref.notificationType] = pref.enabled;
    }

    return result as Record<NotificationType, boolean>;
  }
}
