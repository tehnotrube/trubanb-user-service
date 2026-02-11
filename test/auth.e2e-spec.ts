import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { AuthModule } from '../src/auth/auth.module';
import { UsersModule } from '../src/users/users.module';
import { NotificationPreferencesModule } from '../src/notification-preferences/notification-preferences.module';
import { User, UserRole } from '../src/users/entities/user.entity';
import { RefreshToken } from '../src/auth/entities/refresh-token.entity';
import { NotificationPreference } from '../src/notification-preferences/entities/notification-preference.entity';

// Mock bcrypt at module level
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashedPassword'),
  compare: jest.fn().mockResolvedValue(true),
}));

import * as bcrypt from 'bcrypt';

describe('Auth Endpoints (e2e)', () => {
  let app: INestApplication<App>;
  let usersRepository: jest.Mocked<Repository<User>>;
  let refreshTokensRepository: jest.Mocked<Repository<RefreshToken>>;
  let notificationPreferencesRepository: jest.Mocked<
    Repository<NotificationPreference>
  >;
  let _jwtService: JwtService;

  const createMockUser = (): User => ({
    id: 'user-uuid-123',
    username: 'testuser',
    email: 'test@example.com',
    password: '$2b$10$hashedpassword',
    firstName: 'Test',
    lastName: 'User',
    address: '123 Test St',
    role: UserRole.GUEST,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    refreshTokens: [],
  });

  const createMockRefreshToken = (user: User): RefreshToken => ({
    id: 'token-uuid-123',
    token: 'valid-refresh-token',
    userId: user.id,
    user: user,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    isRevoked: false,
    createdAt: new Date(),
  });

  beforeEach(async () => {
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

    const mockNotificationPreferencesRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AuthModule, UsersModule, NotificationPreferencesModule],
    })
      .overrideProvider(getRepositoryToken(User))
      .useValue(mockUsersRepository)
      .overrideProvider(getRepositoryToken(RefreshToken))
      .useValue(mockRefreshTokensRepository)
      .overrideProvider(getRepositoryToken(NotificationPreference))
      .useValue(mockNotificationPreferencesRepository)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    usersRepository = moduleFixture.get(getRepositoryToken(User));
    refreshTokensRepository = moduleFixture.get(
      getRepositoryToken(RefreshToken),
    );
    notificationPreferencesRepository = moduleFixture.get(
      getRepositoryToken(NotificationPreference),
    );
    _jwtService = moduleFixture.get(JwtService);

    // Reset bcrypt mocks
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  describe('POST /api/users/auth/register', () => {
    const registerDto = {
      username: 'newuser',
      email: 'new@example.com',
      password: 'Password123!',
      firstName: 'New',
      lastName: 'User',
      address: '456 New St',
    };

    it('should register a new user successfully', async () => {
      const mockUser = createMockUser();
      const mockRefreshToken = createMockRefreshToken(mockUser);

      usersRepository.findOne.mockResolvedValue(null);
      usersRepository.create.mockReturnValue({ ...mockUser, ...registerDto });
      usersRepository.save.mockResolvedValue({ ...mockUser, ...registerDto });
      notificationPreferencesRepository.save.mockResolvedValue([]);
      refreshTokensRepository.save.mockResolvedValue(mockRefreshToken);

      const response = await request(app.getHttpServer())
        .post('/api/users/auth/register')
        .send(registerDto)
        .expect(201);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.user).not.toHaveProperty('password');
    });

    it('should return 409 when username already exists', async () => {
      const mockUser = createMockUser();
      usersRepository.findOne.mockResolvedValueOnce(mockUser);

      const response = await request(app.getHttpServer())
        .post('/api/users/auth/register')
        .send(registerDto)
        .expect(409);

      expect(response.body.message).toBe('Username already taken');
    });

    it('should return 409 when email already exists', async () => {
      const mockUser = createMockUser();
      usersRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockUser);

      const response = await request(app.getHttpServer())
        .post('/api/users/auth/register')
        .send(registerDto)
        .expect(409);

      expect(response.body.message).toBe('Email already registered');
    });

    it('should return 400 for invalid email format', async () => {
      const invalidDto = { ...registerDto, email: 'invalid-email' };

      const response = await request(app.getHttpServer())
        .post('/api/users/auth/register')
        .send(invalidDto)
        .expect(400);

      expect(response.body.message).toContain('email must be an email');
    });

    it('should return 400 for weak password', async () => {
      const weakPasswordDto = { ...registerDto, password: 'weak' };

      const response = await request(app.getHttpServer())
        .post('/api/users/auth/register')
        .send(weakPasswordDto)
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('should return 400 for missing required fields', async () => {
      const incompleteDto = { username: 'testuser' };

      await request(app.getHttpServer())
        .post('/api/users/auth/register')
        .send(incompleteDto)
        .expect(400);
    });

    it('should allow registration with HOST role', async () => {
      const mockUser = createMockUser();
      const mockRefreshToken = createMockRefreshToken(mockUser);
      const hostDto = { ...registerDto, role: 'host' };

      usersRepository.findOne.mockResolvedValue(null);
      usersRepository.create.mockReturnValue({
        ...mockUser,
        ...hostDto,
        role: UserRole.HOST,
      });
      usersRepository.save.mockResolvedValue({
        ...mockUser,
        ...hostDto,
        role: UserRole.HOST,
      });
      notificationPreferencesRepository.save.mockResolvedValue([]);
      refreshTokensRepository.save.mockResolvedValue(mockRefreshToken);

      const response = await request(app.getHttpServer())
        .post('/api/users/auth/register')
        .send(hostDto)
        .expect(201);

      expect(response.body.user.role).toBe(UserRole.HOST);
    });
  });

  describe('POST /api/users/auth/login', () => {
    const loginDto = {
      emailOrUsername: 'test@example.com',
      password: 'Password123!',
    };

    it('should login with email successfully', async () => {
      const mockUser = createMockUser();
      const mockRefreshToken = createMockRefreshToken(mockUser);

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockUser),
      };
      usersRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder as any,
      );
      refreshTokensRepository.save.mockResolvedValue(mockRefreshToken);

      const response = await request(app.getHttpServer())
        .post('/api/users/auth/login')
        .send(loginDto)
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
    });

    it('should login with username successfully', async () => {
      const mockUser = createMockUser();
      const mockRefreshToken = createMockRefreshToken(mockUser);

      const usernameLoginDto = {
        emailOrUsername: 'testuser',
        password: 'Password123!',
      };
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockUser),
      };
      usersRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder as any,
      );
      refreshTokensRepository.save.mockResolvedValue(mockRefreshToken);

      const response = await request(app.getHttpServer())
        .post('/api/users/auth/login')
        .send(usernameLoginDto)
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
    });

    it('should return 401 for invalid credentials', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      usersRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder as any,
      );

      const response = await request(app.getHttpServer())
        .post('/api/users/auth/login')
        .send(loginDto)
        .expect(401);

      expect(response.body.message).toBe('Invalid credentials');
    });

    it('should return 401 for incorrect password', async () => {
      const mockUser = createMockUser();
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockUser),
      };
      usersRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder as any,
      );

      const response = await request(app.getHttpServer())
        .post('/api/users/auth/login')
        .send(loginDto)
        .expect(401);

      expect(response.body.message).toBe('Invalid credentials');
    });

    it('should return 401 for deactivated account', async () => {
      const mockUser = createMockUser();
      const inactiveUser = { ...mockUser, isActive: false };

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(inactiveUser),
      };
      usersRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder as any,
      );

      const response = await request(app.getHttpServer())
        .post('/api/users/auth/login')
        .send(loginDto)
        .expect(401);

      expect(response.body.message).toBe('Account is deactivated');
    });
  });

  describe('POST /api/users/auth/refresh', () => {
    it('should refresh tokens successfully', async () => {
      const mockUser = createMockUser();
      const mockRefreshToken = createMockRefreshToken(mockUser);

      refreshTokensRepository.findOne.mockResolvedValue(mockRefreshToken);
      refreshTokensRepository.save.mockResolvedValue({
        ...mockRefreshToken,
        isRevoked: true,
      });

      const response = await request(app.getHttpServer())
        .post('/api/users/auth/refresh')
        .send({ refreshToken: 'valid-refresh-token' })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
    });

    it('should return 401 for invalid refresh token', async () => {
      refreshTokensRepository.findOne.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .post('/api/users/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body.message).toBe('Invalid refresh token');
    });

    it('should return 401 for expired refresh token', async () => {
      const mockUser = createMockUser();
      const expiredToken = {
        ...createMockRefreshToken(mockUser),
        expiresAt: new Date(Date.now() - 1000),
      };
      refreshTokensRepository.findOne.mockResolvedValue(expiredToken);

      const response = await request(app.getHttpServer())
        .post('/api/users/auth/refresh')
        .send({ refreshToken: 'expired-token' })
        .expect(401);

      expect(response.body.message).toBe('Invalid refresh token');
    });
  });

  describe('POST /api/users/auth/logout', () => {
    it('should logout successfully', async () => {
      refreshTokensRepository.update.mockResolvedValue({ affected: 1 } as any);

      await request(app.getHttpServer())
        .post('/api/users/auth/logout')
        .send({ refreshToken: 'valid-refresh-token' })
        .expect(204);
    });

    it('should return 401 for invalid refresh token on logout', async () => {
      refreshTokensRepository.update.mockResolvedValue({ affected: 0 } as any);

      const response = await request(app.getHttpServer())
        .post('/api/users/auth/logout')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body.message).toBe('Invalid refresh token');
    });
  });
});
