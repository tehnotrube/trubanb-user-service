import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationPreference } from './entities/notification-preference.entity';
import {
  NotificationType,
  HOST_NOTIFICATION_TYPES,
  GUEST_NOTIFICATION_TYPES,
} from './enums/notification-type.enum';
import { UserRole } from '../users';
import { UpdatePreferenceDto } from './dto/update-preference.dto';
import { BulkUpdatePreferencesDto } from './dto/bulk-update-preferences.dto';

describe('NotificationPreferencesService', () => {
  let service: NotificationPreferencesService;
  let preferencesRepository: jest.Mocked<Repository<NotificationPreference>>;

  const mockUserId = 'user-uuid-123';

  const mockPreference: NotificationPreference = {
    id: 'pref-uuid-123',
    userId: mockUserId,
    notificationType: NotificationType.RESERVATION_REQUEST_CREATED,
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    user: null as any,
  };

  const mockPreferences: NotificationPreference[] = [
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
    const mockPreferencesRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationPreferencesService,
        {
          provide: getRepositoryToken(NotificationPreference),
          useValue: mockPreferencesRepository,
        },
      ],
    }).compile();

    service = module.get<NotificationPreferencesService>(
      NotificationPreferencesService,
    );
    preferencesRepository = module.get(
      getRepositoryToken(NotificationPreference),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getPreferencesForUser', () => {
    it('should return all preferences for a user sorted by type', async () => {
      preferencesRepository.find.mockResolvedValue(mockPreferences);

      const result = await service.getPreferencesForUser(mockUserId);

      expect(result).toEqual(mockPreferences);
      expect(preferencesRepository.find).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        order: { notificationType: 'ASC' },
      });
    });

    it('should return empty array if user has no preferences', async () => {
      preferencesRepository.find.mockResolvedValue([]);

      const result = await service.getPreferencesForUser(mockUserId);

      expect(result).toEqual([]);
    });
  });

  describe('updatePreference', () => {
    const updateDto: UpdatePreferenceDto = { enabled: false };

    it('should successfully update a preference', async () => {
      preferencesRepository.findOne.mockResolvedValue(mockPreference);
      preferencesRepository.save.mockResolvedValue({
        ...mockPreference,
        enabled: false,
      });

      const result = await service.updatePreference(
        mockUserId,
        NotificationType.RESERVATION_REQUEST_CREATED,
        updateDto,
      );

      expect(result.enabled).toBe(false);
      expect(preferencesRepository.findOne).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          notificationType: NotificationType.RESERVATION_REQUEST_CREATED,
        },
      });
      expect(preferencesRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if preference not found', async () => {
      preferencesRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updatePreference(
          mockUserId,
          NotificationType.RESERVATION_REQUEST_CREATED,
          updateDto,
        ),
      ).rejects.toThrow(
        new NotFoundException(
          `Notification preference for type ${NotificationType.RESERVATION_REQUEST_CREATED} not found`,
        ),
      );
    });

    it('should enable a previously disabled preference', async () => {
      const disabledPreference = { ...mockPreference, enabled: false };
      preferencesRepository.findOne.mockResolvedValue(disabledPreference);
      preferencesRepository.save.mockResolvedValue({
        ...disabledPreference,
        enabled: true,
      });

      const result = await service.updatePreference(
        mockUserId,
        NotificationType.RESERVATION_REQUEST_CREATED,
        { enabled: true },
      );

      expect(result.enabled).toBe(true);
    });
  });

  describe('bulkUpdatePreferences', () => {
    const bulkUpdateDto: BulkUpdatePreferencesDto = {
      preferences: [
        { type: NotificationType.RESERVATION_REQUEST_CREATED, enabled: false },
        { type: NotificationType.RESERVATION_CANCELLED, enabled: true },
      ],
    };

    it('should successfully bulk update preferences', async () => {
      preferencesRepository.findOne
        .mockResolvedValueOnce(mockPreferences[0])
        .mockResolvedValueOnce(mockPreferences[1]);
      preferencesRepository.save
        .mockResolvedValueOnce({ ...mockPreferences[0], enabled: false })
        .mockResolvedValueOnce({ ...mockPreferences[1], enabled: true });

      const result = await service.bulkUpdatePreferences(
        mockUserId,
        bulkUpdateDto,
      );

      expect(result).toHaveLength(2);
      expect(preferencesRepository.findOne).toHaveBeenCalledTimes(2);
      expect(preferencesRepository.save).toHaveBeenCalledTimes(2);
    });

    it('should skip preferences that do not exist', async () => {
      preferencesRepository.findOne
        .mockResolvedValueOnce(mockPreferences[0])
        .mockResolvedValueOnce(null);
      preferencesRepository.save.mockResolvedValueOnce({
        ...mockPreferences[0],
        enabled: false,
      });

      const result = await service.bulkUpdatePreferences(
        mockUserId,
        bulkUpdateDto,
      );

      expect(result).toHaveLength(1);
      expect(preferencesRepository.save).toHaveBeenCalledTimes(1);
    });

    it('should return empty array if no preferences exist', async () => {
      preferencesRepository.findOne.mockResolvedValue(null);

      const result = await service.bulkUpdatePreferences(
        mockUserId,
        bulkUpdateDto,
      );

      expect(result).toHaveLength(0);
      expect(preferencesRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('createDefaultPreferences', () => {
    it('should create default preferences for HOST role', async () => {
      const hostPreferences = HOST_NOTIFICATION_TYPES.map((type, index) => ({
        ...mockPreference,
        id: `pref-${index}`,
        notificationType: type,
      }));
      preferencesRepository.save.mockResolvedValue(hostPreferences);

      const result = await service.createDefaultPreferences(
        mockUserId,
        UserRole.HOST,
      );

      expect(preferencesRepository.save).toHaveBeenCalledWith(
        expect.arrayContaining(
          HOST_NOTIFICATION_TYPES.map((type) =>
            expect.objectContaining({
              userId: mockUserId,
              notificationType: type,
              enabled: true,
            }),
          ),
        ),
      );
      expect(result).toHaveLength(HOST_NOTIFICATION_TYPES.length);
    });

    it('should create default preferences for GUEST role', async () => {
      const guestPreferences = GUEST_NOTIFICATION_TYPES.map((type, index) => ({
        ...mockPreference,
        id: `pref-${index}`,
        notificationType: type,
      }));
      preferencesRepository.save.mockResolvedValue(guestPreferences);

      const result = await service.createDefaultPreferences(
        mockUserId,
        UserRole.GUEST,
      );

      expect(preferencesRepository.save).toHaveBeenCalledWith(
        expect.arrayContaining(
          GUEST_NOTIFICATION_TYPES.map((type) =>
            expect.objectContaining({
              userId: mockUserId,
              notificationType: type,
              enabled: true,
            }),
          ),
        ),
      );
      expect(result).toHaveLength(GUEST_NOTIFICATION_TYPES.length);
    });

    it('should create preferences with enabled=true by default', async () => {
      preferencesRepository.save.mockImplementation((prefs) =>
        Promise.resolve(prefs),
      );

      await service.createDefaultPreferences(mockUserId, UserRole.HOST);

      const saveCall = preferencesRepository.save.mock.calls[0][0];
      expect(saveCall).toBeInstanceOf(Array);
      (saveCall as NotificationPreference[]).forEach(
        (pref: NotificationPreference) => {
          expect(pref.enabled).toBe(true);
        },
      );
    });
  });

  describe('isNotificationEnabled', () => {
    it('should return true if preference is enabled', async () => {
      preferencesRepository.findOne.mockResolvedValue({
        ...mockPreference,
        enabled: true,
      });

      const result = await service.isNotificationEnabled(
        mockUserId,
        NotificationType.RESERVATION_REQUEST_CREATED,
      );

      expect(result).toBe(true);
    });

    it('should return false if preference is disabled', async () => {
      preferencesRepository.findOne.mockResolvedValue({
        ...mockPreference,
        enabled: false,
      });

      const result = await service.isNotificationEnabled(
        mockUserId,
        NotificationType.RESERVATION_REQUEST_CREATED,
      );

      expect(result).toBe(false);
    });

    it('should return true by default if preference does not exist', async () => {
      preferencesRepository.findOne.mockResolvedValue(null);

      const result = await service.isNotificationEnabled(
        mockUserId,
        NotificationType.RESERVATION_REQUEST_CREATED,
      );

      expect(result).toBe(true);
    });
  });

  describe('getPreferencesByUserId', () => {
    it('should return preferences as key-value map', async () => {
      preferencesRepository.find.mockResolvedValue([
        {
          ...mockPreference,
          notificationType: NotificationType.RESERVATION_REQUEST_CREATED,
          enabled: true,
        },
        {
          ...mockPreference,
          notificationType: NotificationType.RESERVATION_CANCELLED,
          enabled: false,
        },
      ]);

      const result = await service.getPreferencesByUserId(mockUserId);

      expect(result).toEqual({
        [NotificationType.RESERVATION_REQUEST_CREATED]: true,
        [NotificationType.RESERVATION_CANCELLED]: false,
      });
    });

    it('should return empty object if no preferences exist', async () => {
      preferencesRepository.find.mockResolvedValue([]);

      const result = await service.getPreferencesByUserId(mockUserId);

      expect(result).toEqual({});
    });
  });
});
