import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { User, UserRole } from '../users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { NotificationPreferencesService } from '../notification-preferences';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let usersRepository: jest.Mocked<Repository<User>>;
  let refreshTokensRepository: jest.Mocked<Repository<RefreshToken>>;
  let jwtService: jest.Mocked<JwtService>;
  let notificationPreferencesService: jest.Mocked<NotificationPreferencesService>;

  const mockUser: User = {
    id: 'user-uuid-123',
    username: 'testuser',
    email: 'test@example.com',
    password: 'hashedPassword123',
    firstName: 'Test',
    lastName: 'User',
    address: '123 Test St',
    role: UserRole.GUEST,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    refreshTokens: [],
  };

  const mockRefreshToken: RefreshToken = {
    id: 'token-uuid-123',
    token: 'valid-refresh-token',
    userId: mockUser.id,
    user: mockUser,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    isRevoked: false,
    createdAt: new Date(),
  };

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

    const mockJwtService = {
      sign: jest.fn(),
    };

    const mockNotificationPreferencesService = {
      createDefaultPreferences: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUsersRepository,
        },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: mockRefreshTokensRepository,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: NotificationPreferencesService,
          useValue: mockNotificationPreferencesService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersRepository = module.get(getRepositoryToken(User));
    refreshTokensRepository = module.get(getRepositoryToken(RefreshToken));
    jwtService = module.get(JwtService);
    notificationPreferencesService = module.get(NotificationPreferencesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      username: 'newuser',
      email: 'new@example.com',
      password: 'Password123!',
      firstName: 'New',
      lastName: 'User',
      address: '456 New St',
    };

    it('should successfully register a new user', async () => {
      usersRepository.findOne.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
      usersRepository.create.mockReturnValue({
        ...mockUser,
        ...registerDto,
        password: 'hashedPassword',
      });
      usersRepository.save.mockResolvedValue({
        ...mockUser,
        ...registerDto,
        password: 'hashedPassword',
      });
      notificationPreferencesService.createDefaultPreferences.mockResolvedValue(
        [],
      );
      jwtService.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');
      refreshTokensRepository.save.mockResolvedValue(mockRefreshToken);

      const result = await service.register(registerDto);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken', 'access-token');
      expect(result).toHaveProperty('refreshToken', 'refresh-token');
      expect(result.user).not.toHaveProperty('password');
      expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 10);
      expect(
        notificationPreferencesService.createDefaultPreferences,
      ).toHaveBeenCalled();
    });

    it('should throw ConflictException if username already exists', async () => {
      usersRepository.findOne.mockResolvedValueOnce(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow(
        new ConflictException('Username already taken'),
      );
    });

    it('should throw ConflictException if email already exists', async () => {
      usersRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow(
        new ConflictException('Email already registered'),
      );
    });

    it('should create user with specified role', async () => {
      const registerDtoWithRole: RegisterDto = {
        ...registerDto,
        role: UserRole.HOST,
      };

      usersRepository.findOne.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
      usersRepository.create.mockReturnValue({
        ...mockUser,
        ...registerDtoWithRole,
        password: 'hashedPassword',
      });
      usersRepository.save.mockResolvedValue({
        ...mockUser,
        ...registerDtoWithRole,
        password: 'hashedPassword',
        role: UserRole.HOST,
      });
      notificationPreferencesService.createDefaultPreferences.mockResolvedValue(
        [],
      );
      jwtService.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');
      refreshTokensRepository.save.mockResolvedValue(mockRefreshToken);

      await service.register(registerDtoWithRole);

      expect(
        notificationPreferencesService.createDefaultPreferences,
      ).toHaveBeenCalledWith(expect.any(String), UserRole.HOST);
    });
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      emailOrUsername: 'test@example.com',
      password: 'Password123!',
    };

    it('should successfully login with email', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockUser),
      };
      usersRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder as any,
      );
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      jwtService.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');
      refreshTokensRepository.save.mockResolvedValue(mockRefreshToken);

      const result = await service.login(loginDto);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken', 'access-token');
      expect(result).toHaveProperty('refreshToken', 'refresh-token');
      expect(result.user).not.toHaveProperty('password');
    });

    it('should successfully login with username', async () => {
      const loginDtoWithUsername: LoginDto = {
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
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      jwtService.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');
      refreshTokensRepository.save.mockResolvedValue(mockRefreshToken);

      const result = await service.login(loginDtoWithUsername);

      expect(result).toHaveProperty('accessToken');
    });

    it('should throw UnauthorizedException if user not found', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      usersRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder as any,
      );

      await expect(service.login(loginDto)).rejects.toThrow(
        new UnauthorizedException('Invalid credentials'),
      );
    });

    it('should throw UnauthorizedException if password is incorrect', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockUser),
      };
      usersRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder as any,
      );
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        new UnauthorizedException('Invalid credentials'),
      );
    });

    it('should throw UnauthorizedException if account is deactivated', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(inactiveUser),
      };
      usersRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder as any,
      );
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.login(loginDto)).rejects.toThrow(
        new UnauthorizedException('Account is deactivated'),
      );
    });
  });

  describe('refreshTokens', () => {
    it('should successfully refresh tokens', async () => {
      refreshTokensRepository.findOne.mockResolvedValue(mockRefreshToken);
      refreshTokensRepository.save.mockResolvedValue({
        ...mockRefreshToken,
        isRevoked: true,
      });
      jwtService.sign
        .mockReturnValueOnce('new-access-token')
        .mockReturnValueOnce('new-refresh-token');

      const result = await service.refreshTokens('valid-refresh-token');

      expect(result).toHaveProperty('accessToken', 'new-access-token');
      expect(result).toHaveProperty('refreshToken', 'new-refresh-token');
      expect(refreshTokensRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isRevoked: true }),
      );
    });

    it('should throw UnauthorizedException if refresh token not found', async () => {
      refreshTokensRepository.findOne.mockResolvedValue(null);

      await expect(service.refreshTokens('invalid-token')).rejects.toThrow(
        new UnauthorizedException('Invalid refresh token'),
      );
    });

    it('should throw UnauthorizedException if refresh token is expired', async () => {
      const expiredToken = {
        ...mockRefreshToken,
        expiresAt: new Date(Date.now() - 1000),
      };
      refreshTokensRepository.findOne.mockResolvedValue(expiredToken);

      await expect(service.refreshTokens('expired-token')).rejects.toThrow(
        new UnauthorizedException('Invalid refresh token'),
      );
    });
  });

  describe('logout', () => {
    it('should successfully logout and revoke refresh token', async () => {
      refreshTokensRepository.update.mockResolvedValue({ affected: 1 } as any);

      await expect(
        service.logout('valid-refresh-token'),
      ).resolves.toBeUndefined();
      expect(refreshTokensRepository.update).toHaveBeenCalledWith(
        { token: 'valid-refresh-token' },
        { isRevoked: true },
      );
    });

    it('should throw UnauthorizedException if refresh token not found', async () => {
      refreshTokensRepository.update.mockResolvedValue({ affected: 0 } as any);

      await expect(service.logout('invalid-token')).rejects.toThrow(
        new UnauthorizedException('Invalid refresh token'),
      );
    });
  });
});
