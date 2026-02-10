import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationType } from './enums/notification-type.enum';

interface GetPreferencesRequest {
  userId: string;
}

@Controller()
export class PreferencesGrpcController {
  constructor(
    private readonly preferencesService: NotificationPreferencesService,
  ) {}

  @GrpcMethod('UserService', 'GetNotificationPreferences')
  async getNotificationPreferences(data: GetPreferencesRequest) {
    const preferences = await this.preferencesService.getPreferencesByUserId(
      data.userId,
    );

    return {
      reservationRequestCreated:
        preferences[NotificationType.RESERVATION_REQUEST_CREATED] ?? true,
      reservationRequestResponded:
        preferences[NotificationType.RESERVATION_REQUEST_RESPONDED] ?? true,
      reservationCancelled:
        preferences[NotificationType.RESERVATION_CANCELLED] ?? true,
      hostRated: preferences[NotificationType.HOST_RATED] ?? true,
      accommodationRated:
        preferences[NotificationType.ACCOMMODATION_RATED] ?? true,
    };
  }
}
