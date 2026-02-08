import { NotificationType } from '../enums/notification-type.enum';

export class PreferenceResponseDto {
  id: string;
  notificationType: NotificationType;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}
