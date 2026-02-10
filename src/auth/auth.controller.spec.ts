import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { UserRole } from '../users/entities/user.entity';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  const mockUser = {
    id: 'user-uuid-123',
    username: 'testuser',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    address: '123 Test St',
    role: UserRole.GUEST,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAuthResponse = {
    user: mockUser,
    accessToken: 'access-token-123',
    refreshToken: 'refresh-token-123',
  };

  beforeEach(async () => {
    const mockAuthService = {
      register: jest.fn(),
      login: jest.fn(),
      refreshTokens: jest.fn(),
      logout: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
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

    it('should register a new user and return tokens', async () => {
      authService.register.mockResolvedValue(mockAuthResponse);

      const result = await controller.register(registerDto);

      expect(result).toEqual(mockAuthResponse);
      expect(authService.register).toHaveBeenCalledWith(registerDto);
    });

    it('should pass role to service when provided', async () => {
      const registerDtoWithRole: RegisterDto = {
        ...registerDto,
        role: UserRole.HOST,
      };
      authService.register.mockResolvedValue({
        ...mockAuthResponse,
        user: { ...mockUser, role: UserRole.HOST },
      });

      await controller.register(registerDtoWithRole);

      expect(authService.register).toHaveBeenCalledWith(registerDtoWithRole);
    });
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      emailOrUsername: 'test@example.com',
      password: 'Password123!',
    };

    it('should login user and return tokens', async () => {
      authService.login.mockResolvedValue(mockAuthResponse);

      const result = await controller.login(loginDto);

      expect(result).toEqual(mockAuthResponse);
      expect(authService.login).toHaveBeenCalledWith(loginDto);
    });

    it('should handle login with username', async () => {
      const loginWithUsername: LoginDto = {
        emailOrUsername: 'testuser',
        password: 'Password123!',
      };
      authService.login.mockResolvedValue(mockAuthResponse);

      await controller.login(loginWithUsername);

      expect(authService.login).toHaveBeenCalledWith(loginWithUsername);
    });
  });

  describe('refresh', () => {
    const refreshTokenDto: RefreshTokenDto = {
      refreshToken: 'valid-refresh-token',
    };

    it('should refresh tokens', async () => {
      const newTokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      };
      authService.refreshTokens.mockResolvedValue(newTokens);

      const result = await controller.refresh(refreshTokenDto);

      expect(result).toEqual(newTokens);
      expect(authService.refreshTokens).toHaveBeenCalledWith(
        refreshTokenDto.refreshToken,
      );
    });
  });

  describe('logout', () => {
    const refreshTokenDto: RefreshTokenDto = {
      refreshToken: 'valid-refresh-token',
    };

    it('should logout user and revoke refresh token', async () => {
      authService.logout.mockResolvedValue(undefined);

      await controller.logout(refreshTokenDto);

      expect(authService.logout).toHaveBeenCalledWith(
        refreshTokenDto.refreshToken,
      );
    });
  });
});
