import { Test, TestingModule } from '@nestjs/testing';
import { NotificationPreferencesController } from './notification-preferences.controller';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationType } from './enums/notification-type.enum';
import { UpdatePreferenceDto } from './dto/update-preference.dto';
import { BulkUpdatePreferencesDto } from './dto/bulk-update-preferences.dto';
import { UserRole } from '../users';
import type { AuthenticatedUser } from '../auth';

describe('NotificationPreferencesController', () => {
  let controller: NotificationPreferencesController;
  let preferencesService: jest.Mocked<NotificationPreferencesService>;

  const mockAuthenticatedUser: AuthenticatedUser = {
    id: 'user-uuid-123',
    email: 'test@example.com',
    role: UserRole.HOST,
  };

  const mockPreference = {
    id: 'pref-uuid-123',
    userId: mockAuthenticatedUser.id,
    notificationType: NotificationType.RESERVATION_REQUEST_CREATED,
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    user: null as any,
  };

  const mockPreferences = [
    mockPreference,
    {
      ...mockPreference,
      id: 'pref-uuid-456',
      notificationType: NotificationType.RESERVATION_CANCELLED,
    },
    {
      ...mockPreference,
      id: 'pref-uuid-789',
      notificationType: NotificationType.HOST_RATED,
    },
  ];

  beforeEach(async () => {
    const mockPreferencesService = {
      getPreferencesForUser: jest.fn(),
      updatePreference: jest.fn(),
      bulkUpdatePreferences: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationPreferencesController],
      providers: [
        {
          provide: NotificationPreferencesService,
          useValue: mockPreferencesService,
        },
      ],
    }).compile();

    controller = module.get<NotificationPreferencesController>(
      NotificationPreferencesController,
    );
    preferencesService = module.get(NotificationPreferencesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getPreferences', () => {
    it('should return all preferences for authenticated user', async () => {
      preferencesService.getPreferencesForUser.mockResolvedValue(
        mockPreferences,
      );

      const result = await controller.getPreferences(mockAuthenticatedUser);

      expect(result).toEqual(mockPreferences);
      expect(preferencesService.getPreferencesForUser).toHaveBeenCalledWith(
        mockAuthenticatedUser.id,
      );
    });

    it('should return empty array if no preferences exist', async () => {
      preferencesService.getPreferencesForUser.mockResolvedValue([]);

      const result = await controller.getPreferences(mockAuthenticatedUser);

      expect(result).toEqual([]);
    });
  });

  describe('updatePreference', () => {
    const updateDto: UpdatePreferenceDto = { enabled: false };

    it('should update a single preference', async () => {
      const updatedPreference = { ...mockPreference, enabled: false };
      preferencesService.updatePreference.mockResolvedValue(updatedPreference);

      const result = await controller.updatePreference(
        mockAuthenticatedUser,
        NotificationType.RESERVATION_REQUEST_CREATED,
        updateDto,
      );

      expect(result).toEqual(updatedPreference);
      expect(preferencesService.updatePreference).toHaveBeenCalledWith(
        mockAuthenticatedUser.id,
        NotificationType.RESERVATION_REQUEST_CREATED,
        updateDto,
      );
    });

    it('should enable a preference', async () => {
      const enableDto: UpdatePreferenceDto = { enabled: true };
      const enabledPreference = { ...mockPreference, enabled: true };
      preferencesService.updatePreference.mockResolvedValue(enabledPreference);

      const result = await controller.updatePreference(
        mockAuthenticatedUser,
        NotificationType.RESERVATION_REQUEST_CREATED,
        enableDto,
      );

      expect(result.enabled).toBe(true);
    });

    it('should disable a preference', async () => {
      const disableDto: UpdatePreferenceDto = { enabled: false };
      const disabledPreference = { ...mockPreference, enabled: false };
      preferencesService.updatePreference.mockResolvedValue(disabledPreference);

      const result = await controller.updatePreference(
        mockAuthenticatedUser,
        NotificationType.RESERVATION_REQUEST_CREATED,
        disableDto,
      );

      expect(result.enabled).toBe(false);
    });
  });

  describe('bulkUpdatePreferences', () => {
    const bulkUpdateDto: BulkUpdatePreferencesDto = {
      preferences: [
        { type: NotificationType.RESERVATION_REQUEST_CREATED, enabled: false },
        { type: NotificationType.RESERVATION_CANCELLED, enabled: true },
        { type: NotificationType.HOST_RATED, enabled: false },
      ],
    };

    it('should bulk update multiple preferences', async () => {
      const updatedPreferences = [
        { ...mockPreferences[0], enabled: false },
        { ...mockPreferences[1], enabled: true },
        { ...mockPreferences[2], enabled: false },
      ];
      preferencesService.bulkUpdatePreferences.mockResolvedValue(
        updatedPreferences,
      );

      const result = await controller.bulkUpdatePreferences(
        mockAuthenticatedUser,
        bulkUpdateDto,
      );

      expect(result).toEqual(updatedPreferences);
      expect(preferencesService.bulkUpdatePreferences).toHaveBeenCalledWith(
        mockAuthenticatedUser.id,
        bulkUpdateDto,
      );
    });

    it('should handle partial bulk update', async () => {
      const partialDto: BulkUpdatePreferencesDto = {
        preferences: [
          {
            type: NotificationType.RESERVATION_REQUEST_CREATED,
            enabled: false,
          },
        ],
      };
      const updatedPreferences = [{ ...mockPreferences[0], enabled: false }];
      preferencesService.bulkUpdatePreferences.mockResolvedValue(
        updatedPreferences,
      );

      const result = await controller.bulkUpdatePreferences(
        mockAuthenticatedUser,
        partialDto,
      );

      expect(result).toHaveLength(1);
    });

    it('should return empty array if no preferences match', async () => {
      preferencesService.bulkUpdatePreferences.mockResolvedValue([]);

      const result = await controller.bulkUpdatePreferences(
        mockAuthenticatedUser,
        bulkUpdateDto,
      );

      expect(result).toEqual([]);
    });
  });
});
