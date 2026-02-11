import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersModule } from '../src/users/users.module';
import { AuthModule } from '../src/auth/auth.module';
import { User, UserRole } from '../src/users/entities/user.entity';
import { RefreshToken } from '../src/auth/entities/refresh-token.entity';
import { NotificationPreference } from '../src/notification-preferences/entities/notification-preference.entity';

// Mock bcrypt at module level
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('newHashedPassword'),
  compare: jest.fn().mockResolvedValue(true),
}));

import * as bcrypt from 'bcrypt';

describe('Users Endpoints (e2e)', () => {
  let app: INestApplication<App>;
  let usersRepository: jest.Mocked<Repository<User>>;

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

  const authHeaders = {
    'x-user-id': 'user-uuid-123',
    'x-user-email': 'test@example.com',
    'x-user-role': 'guest',
  };

  beforeEach(async () => {
    const mockUsersRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
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
      imports: [UsersModule, AuthModule],
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

    // Reset bcrypt mocks
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (bcrypt.hash as jest.Mock).mockResolvedValue('newHashedPassword');
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  describe('GET /api/users/profile', () => {
    it('should return user profile when authenticated', async () => {
      const mockUser = createMockUser();
      usersRepository.findOne.mockResolvedValue(mockUser);

      const response = await request(app.getHttpServer())
        .get('/api/users/profile')
        .set(authHeaders)
        .expect(200);

      expect(response.body).toHaveProperty('id', mockUser.id);
      expect(response.body).toHaveProperty('email', mockUser.email);
      expect(response.body).toHaveProperty('username', mockUser.username);
      expect(response.body).not.toHaveProperty('password');
    });

    it('should return 401 when not authenticated', async () => {
      await request(app.getHttpServer()).get('/api/users/profile').expect(401);
    });

    it('should return 404 when user not found', async () => {
      usersRepository.findOne.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .get('/api/users/profile')
        .set(authHeaders)
        .expect(404);

      expect(response.body.message).toBe('User not found');
    });

    it('should use user id from x-user-id header', async () => {
      const mockUser = createMockUser();
      usersRepository.findOne.mockResolvedValue(mockUser);

      await request(app.getHttpServer())
        .get('/api/users/profile')
        .set(authHeaders)
        .expect(200);

      expect(usersRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUser.id },
      });
    });
  });

  describe('PUT /api/users/profile', () => {
    const updateProfileDto = {
      firstName: 'Updated',
      lastName: 'Name',
      email: 'updated@example.com',
      address: '789 Updated St',
    };

    it('should update user profile successfully', async () => {
      const mockUser = createMockUser();
      usersRepository.findOne
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(null);
      usersRepository.save.mockResolvedValue({
        ...mockUser,
        ...updateProfileDto,
      });

      const response = await request(app.getHttpServer())
        .put('/api/users/profile')
        .set(authHeaders)
        .send(updateProfileDto)
        .expect(200);

      expect(response.body.firstName).toBe(updateProfileDto.firstName);
      expect(response.body.lastName).toBe(updateProfileDto.lastName);
      expect(response.body.email).toBe(updateProfileDto.email);
      expect(response.body).not.toHaveProperty('password');
    });

    it('should return 401 when not authenticated', async () => {
      await request(app.getHttpServer())
        .put('/api/users/profile')
        .send(updateProfileDto)
        .expect(401);
    });

    it('should return 404 when user not found', async () => {
      usersRepository.findOne.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .put('/api/users/profile')
        .set(authHeaders)
        .send(updateProfileDto)
        .expect(404);

      expect(response.body.message).toBe('User not found');
    });

    it('should return 409 when email is already in use', async () => {
      const mockUser = createMockUser();
      const anotherUser = { ...createMockUser(), id: 'another-user-id' };
      usersRepository.findOne
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(anotherUser);

      const response = await request(app.getHttpServer())
        .put('/api/users/profile')
        .set(authHeaders)
        .send(updateProfileDto)
        .expect(409);

      expect(response.body.message).toBe('Email already in use');
    });

    it('should allow partial profile update', async () => {
      const mockUser = createMockUser();
      const partialDto = { firstName: 'OnlyFirst' };
      usersRepository.findOne.mockResolvedValue(mockUser);
      usersRepository.save.mockResolvedValue({ ...mockUser, ...partialDto });

      const response = await request(app.getHttpServer())
        .put('/api/users/profile')
        .set(authHeaders)
        .send(partialDto)
        .expect(200);

      expect(response.body.firstName).toBe('OnlyFirst');
    });

    it('should return 400 for invalid email format', async () => {
      const invalidDto = { email: 'invalid-email' };

      const response = await request(app.getHttpServer())
        .put('/api/users/profile')
        .set(authHeaders)
        .send(invalidDto)
        .expect(400);

      expect(response.body.message).toContain('email must be an email');
    });
  });

  describe('PUT /api/users/credentials', () => {
    const updateCredentialsDto = {
      currentPassword: 'OldPassword123!',
      username: 'newusername',
      newPassword: 'NewPassword123!',
    };

    it('should update credentials successfully', async () => {
      const mockUser = createMockUser();
      usersRepository.findOne
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(null);
      usersRepository.save.mockResolvedValue({
        ...mockUser,
        username: updateCredentialsDto.username,
      });

      const response = await request(app.getHttpServer())
        .put('/api/users/credentials')
        .set(authHeaders)
        .send(updateCredentialsDto)
        .expect(200);

      expect(response.body.username).toBe(updateCredentialsDto.username);
      expect(response.body).not.toHaveProperty('password');
    });

    it('should return 401 when not authenticated', async () => {
      await request(app.getHttpServer())
        .put('/api/users/credentials')
        .send(updateCredentialsDto)
        .expect(401);
    });

    it('should return 404 when user not found', async () => {
      usersRepository.findOne.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .put('/api/users/credentials')
        .set(authHeaders)
        .send(updateCredentialsDto)
        .expect(404);

      expect(response.body.message).toBe('User not found');
    });

    it('should return 401 when current password is incorrect', async () => {
      const mockUser = createMockUser();
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      usersRepository.findOne.mockResolvedValue(mockUser);

      const response = await request(app.getHttpServer())
        .put('/api/users/credentials')
        .set(authHeaders)
        .send(updateCredentialsDto)
        .expect(401);

      expect(response.body.message).toBe('Current password is incorrect');
    });

    it('should return 409 when username is already taken', async () => {
      const mockUser = createMockUser();
      const anotherUser = { ...createMockUser(), id: 'another-user-id' };
      usersRepository.findOne
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(anotherUser);

      const response = await request(app.getHttpServer())
        .put('/api/users/credentials')
        .set(authHeaders)
        .send(updateCredentialsDto)
        .expect(409);

      expect(response.body.message).toBe('Username already taken');
    });

    it('should allow username-only update', async () => {
      const mockUser = createMockUser();
      const usernameOnlyDto = {
        currentPassword: 'OldPassword123!',
        username: 'newusername',
      };
      usersRepository.findOne
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(null);
      usersRepository.save.mockResolvedValue({
        ...mockUser,
        username: 'newusername',
      });

      const response = await request(app.getHttpServer())
        .put('/api/users/credentials')
        .set(authHeaders)
        .send(usernameOnlyDto)
        .expect(200);

      expect(response.body.username).toBe('newusername');
    });

    it('should allow password-only update', async () => {
      const mockUser = createMockUser();
      const passwordOnlyDto = {
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword123!',
      };
      usersRepository.findOne.mockResolvedValue(mockUser);
      usersRepository.save.mockResolvedValue(mockUser);

      await request(app.getHttpServer())
        .put('/api/users/credentials')
        .set(authHeaders)
        .send(passwordOnlyDto)
        .expect(200);

      expect(bcrypt.hash).toHaveBeenCalledWith(passwordOnlyDto.newPassword, 10);
    });

    it('should return 400 when currentPassword is missing', async () => {
      const invalidDto = {
        username: 'newusername',
      };

      await request(app.getHttpServer())
        .put('/api/users/credentials')
        .set(authHeaders)
        .send(invalidDto)
        .expect(400);
    });
  });
});
