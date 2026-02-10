import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationPreferencesModule } from '../src/notification-preferences/notification-preferences.module';
import { AuthModule } from '../src/auth/auth.module';
import { NotificationPreference } from '../src/notification-preferences/entities/notification-preference.entity';
import { NotificationType } from '../src/notification-preferences/enums/notification-type.enum';
import { User } from '../src/users/entities/user.entity';
import { RefreshToken } from '../src/auth/entities/refresh-token.entity';

describe('Notification Preferences Endpoints (e2e)', () => {
  let app: INestApplication<App>;
  let preferencesRepository: jest.Mocked<Repository<NotificationPreference>>;

  const mockUserId = 'user-uuid-123';

  const authHeaders = {
    'x-user-id': mockUserId,
    'x-user-email': 'test@example.com',
    'x-user-role': 'host',
  };

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
    {
      ...mockPreference,
      id: 'pref-uuid-012',
      notificationType: NotificationType.ACCOMMODATION_RATED,
    },
  ];

  beforeEach(async () => {
    const mockPreferencesRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
    };

    const mockUsersRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const mockRefreshTokensRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [NotificationPreferencesModule, AuthModule],
    })
      .overrideProvider(getRepositoryToken(NotificationPreference))
      .useValue(mockPreferencesRepository)
      .overrideProvider(getRepositoryToken(User))
      .useValue(mockUsersRepository)
      .overrideProvider(getRepositoryToken(RefreshToken))
      .useValue(mockRefreshTokensRepository)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    preferencesRepository = moduleFixture.get(
      getRepositoryToken(NotificationPreference),
    );
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  describe('GET /api/users/notification-preferences', () => {
    it('should return all preferences for authenticated user', async () => {
      preferencesRepository.find.mockResolvedValue(mockPreferences);

      const response = await request(app.getHttpServer())
        .get('/api/users/notification-preferences')
        .set(authHeaders)
        .expect(200);

      expect(response.body).toHaveLength(mockPreferences.length);
      expect(response.body[0]).toHaveProperty('notificationType');
      expect(response.body[0]).toHaveProperty('enabled');
    });

    it('should return 401 when not authenticated', async () => {
      await request(app.getHttpServer())
        .get('/api/users/notification-preferences')
        .expect(401);
    });

    it('should return empty array when user has no preferences', async () => {
      preferencesRepository.find.mockResolvedValue([]);

      const response = await request(app.getHttpServer())
        .get('/api/users/notification-preferences')
        .set(authHeaders)
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should call repository with correct user id', async () => {
      preferencesRepository.find.mockResolvedValue(mockPreferences);

      await request(app.getHttpServer())
        .get('/api/users/notification-preferences')
        .set(authHeaders)
        .expect(200);

      expect(preferencesRepository.find).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        order: { notificationType: 'ASC' },
      });
    });
  });

  describe('PUT /api/users/notification-preferences/:type', () => {
    const updateDto = { enabled: false };

    it('should update a single preference', async () => {
      preferencesRepository.findOne.mockResolvedValue(mockPreference);
      preferencesRepository.save.mockResolvedValue({
        ...mockPreference,
        enabled: false,
      });

      const response = await request(app.getHttpServer())
        .put(
          `/api/users/notification-preferences/${NotificationType.RESERVATION_REQUEST_CREATED}`,
        )
        .set(authHeaders)
        .send(updateDto)
        .expect(200);

      expect(response.body.enabled).toBe(false);
      expect(response.body.notificationType).toBe(
        NotificationType.RESERVATION_REQUEST_CREATED,
      );
    });

    it('should return 401 when not authenticated', async () => {
      await request(app.getHttpServer())
        .put(
          `/api/users/notification-preferences/${NotificationType.RESERVATION_REQUEST_CREATED}`,
        )
        .send(updateDto)
        .expect(401);
    });

    it('should return 404 when preference not found', async () => {
      preferencesRepository.findOne.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .put(
          `/api/users/notification-preferences/${NotificationType.RESERVATION_REQUEST_CREATED}`,
        )
        .set(authHeaders)
        .send(updateDto)
        .expect(404);

      expect(response.body.message).toContain('not found');
    });

    it('should enable a preference', async () => {
      const disabledPreference = { ...mockPreference, enabled: false };
      preferencesRepository.findOne.mockResolvedValue(disabledPreference);
      preferencesRepository.save.mockResolvedValue({
        ...disabledPreference,
        enabled: true,
      });

      const response = await request(app.getHttpServer())
        .put(
          `/api/users/notification-preferences/${NotificationType.RESERVATION_REQUEST_CREATED}`,
        )
        .set(authHeaders)
        .send({ enabled: true })
        .expect(200);

      expect(response.body.enabled).toBe(true);
    });

    it('should return 400 for invalid notification type', async () => {
      await request(app.getHttpServer())
        .put('/api/users/notification-preferences/INVALID_TYPE')
        .set(authHeaders)
        .send(updateDto)
        .expect(400);
    });

    it('should return 400 when enabled field is missing', async () => {
      await request(app.getHttpServer())
        .put(
          `/api/users/notification-preferences/${NotificationType.RESERVATION_REQUEST_CREATED}`,
        )
        .set(authHeaders)
        .send({})
        .expect(400);
    });

    it('should return 400 when enabled is not boolean', async () => {
      await request(app.getHttpServer())
        .put(
          `/api/users/notification-preferences/${NotificationType.RESERVATION_REQUEST_CREATED}`,
        )
        .set(authHeaders)
        .send({ enabled: 'true' })
        .expect(400);
    });
  });

  describe('PUT /api/users/notification-preferences', () => {
    const bulkUpdateDto = {
      preferences: [
        { type: NotificationType.RESERVATION_REQUEST_CREATED, enabled: false },
        { type: NotificationType.RESERVATION_CANCELLED, enabled: true },
      ],
    };

    it('should bulk update multiple preferences', async () => {
      preferencesRepository.findOne
        .mockResolvedValueOnce(mockPreferences[0])
        .mockResolvedValueOnce(mockPreferences[1]);
      preferencesRepository.save
        .mockResolvedValueOnce({ ...mockPreferences[0], enabled: false })
        .mockResolvedValueOnce({ ...mockPreferences[1], enabled: true });

      const response = await request(app.getHttpServer())
        .put('/api/users/notification-preferences')
        .set(authHeaders)
        .send(bulkUpdateDto)
        .expect(200);

      expect(response.body).toHaveLength(2);
    });

    it('should return 401 when not authenticated', async () => {
      await request(app.getHttpServer())
        .put('/api/users/notification-preferences')
        .send(bulkUpdateDto)
        .expect(401);
    });

    it('should skip preferences that do not exist', async () => {
      preferencesRepository.findOne
        .mockResolvedValueOnce(mockPreferences[0])
        .mockResolvedValueOnce(null);
      preferencesRepository.save.mockResolvedValueOnce({
        ...mockPreferences[0],
        enabled: false,
      });

      const response = await request(app.getHttpServer())
        .put('/api/users/notification-preferences')
        .set(authHeaders)
        .send(bulkUpdateDto)
        .expect(200);

      expect(response.body).toHaveLength(1);
    });

    it('should return empty array when no preferences match', async () => {
      preferencesRepository.findOne.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .put('/api/users/notification-preferences')
        .set(authHeaders)
        .send(bulkUpdateDto)
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should handle empty preferences array', async () => {
      const emptyDto = { preferences: [] };

      const response = await request(app.getHttpServer())
        .put('/api/users/notification-preferences')
        .set(authHeaders)
        .send(emptyDto)
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should return 400 for invalid notification type in bulk update', async () => {
      const invalidDto = {
        preferences: [{ type: 'INVALID_TYPE', enabled: false }],
      };

      await request(app.getHttpServer())
        .put('/api/users/notification-preferences')
        .set(authHeaders)
        .send(invalidDto)
        .expect(400);
    });

    it('should update all HOST notification types', async () => {
      const hostBulkDto = {
        preferences: [
          {
            type: NotificationType.RESERVATION_REQUEST_CREATED,
            enabled: false,
          },
          { type: NotificationType.RESERVATION_CANCELLED, enabled: false },
          { type: NotificationType.HOST_RATED, enabled: false },
          { type: NotificationType.ACCOMMODATION_RATED, enabled: false },
        ],
      };

      preferencesRepository.findOne
        .mockResolvedValueOnce(mockPreferences[0])
        .mockResolvedValueOnce(mockPreferences[1])
        .mockResolvedValueOnce(mockPreferences[2])
        .mockResolvedValueOnce(mockPreferences[3]);
      preferencesRepository.save
        .mockResolvedValueOnce({ ...mockPreferences[0], enabled: false })
        .mockResolvedValueOnce({ ...mockPreferences[1], enabled: false })
        .mockResolvedValueOnce({ ...mockPreferences[2], enabled: false })
        .mockResolvedValueOnce({ ...mockPreferences[3], enabled: false });

      const response = await request(app.getHttpServer())
        .put('/api/users/notification-preferences')
        .set(authHeaders)
        .send(hostBulkDto)
        .expect(200);

      expect(response.body).toHaveLength(4);
      response.body.forEach((pref: any) => {
        expect(pref.enabled).toBe(false);
      });
    });
  });
});
