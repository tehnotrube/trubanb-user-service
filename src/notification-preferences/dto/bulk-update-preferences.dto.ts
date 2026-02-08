import { IsArray, ValidateNested, IsEnum, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { NotificationType } from '../enums/notification-type.enum';

class PreferenceItem {
  @IsEnum(NotificationType)
  type: NotificationType;

  @IsBoolean()
  enabled: boolean;
}

export class BulkUpdatePreferencesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PreferenceItem)
  preferences: PreferenceItem[];
}
