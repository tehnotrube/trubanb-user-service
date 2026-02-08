// NOTE: Do NOT export NotificationPreferencesModule here to avoid circular dependencies
// NotificationPreferencesModule should be imported directly
export * from './notification-preferences.service';
export * from './entities/notification-preference.entity';
export * from './enums/notification-type.enum';
export * from './dto/update-preference.dto';
export * from './dto/bulk-update-preferences.dto';
export * from './dto/preference-response.dto';
