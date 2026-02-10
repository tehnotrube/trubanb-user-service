import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dtos/update-profile.dto';
import { UpdateCredentialsDto } from './dtos/update-credentials.dto';
import { UserRole } from './entities/user.entity';
import type { AuthenticatedUser } from '../auth';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: jest.Mocked<UsersService>;

  const mockAuthenticatedUser: AuthenticatedUser = {
    id: 'user-uuid-123',
    email: 'test@example.com',
    role: UserRole.GUEST,
  };

  const mockUserProfile = {
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

  beforeEach(async () => {
    const mockUsersService = {
      getProfile: jest.fn(),
      updateProfile: jest.fn(),
      updateCredentials: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    usersService = module.get(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getProfile', () => {
    it('should return user profile', async () => {
      usersService.getProfile.mockResolvedValue(mockUserProfile);

      const result = await controller.getProfile(mockAuthenticatedUser);

      expect(result).toEqual(mockUserProfile);
      expect(usersService.getProfile).toHaveBeenCalledWith(
        mockAuthenticatedUser.id,
      );
    });

    it('should use authenticated user id from request', async () => {
      const differentUser: AuthenticatedUser = {
        id: 'different-user-id',
        email: 'different@example.com',
        role: UserRole.HOST,
      };
      usersService.getProfile.mockResolvedValue({
        ...mockUserProfile,
        id: 'different-user-id',
      });

      await controller.getProfile(differentUser);

      expect(usersService.getProfile).toHaveBeenCalledWith('different-user-id');
    });
  });

  describe('updateProfile', () => {
    const updateProfileDto: UpdateProfileDto = {
      firstName: 'Updated',
      lastName: 'Name',
      email: 'updated@example.com',
      address: '789 Updated St',
    };

    it('should update user profile', async () => {
      const updatedProfile = { ...mockUserProfile, ...updateProfileDto };
      usersService.updateProfile.mockResolvedValue(updatedProfile);

      const result = await controller.updateProfile(
        mockAuthenticatedUser,
        updateProfileDto,
      );

      expect(result).toEqual(updatedProfile);
      expect(usersService.updateProfile).toHaveBeenCalledWith(
        mockAuthenticatedUser.id,
        updateProfileDto,
      );
    });

    it('should handle partial profile update', async () => {
      const partialDto: UpdateProfileDto = {
        firstName: 'OnlyFirst',
      };
      const updatedProfile = { ...mockUserProfile, firstName: 'OnlyFirst' };
      usersService.updateProfile.mockResolvedValue(updatedProfile);

      const result = await controller.updateProfile(
        mockAuthenticatedUser,
        partialDto,
      );

      expect(result.firstName).toBe('OnlyFirst');
      expect(usersService.updateProfile).toHaveBeenCalledWith(
        mockAuthenticatedUser.id,
        partialDto,
      );
    });
  });

  describe('updateCredentials', () => {
    const updateCredentialsDto: UpdateCredentialsDto = {
      currentPassword: 'OldPassword123!',
      username: 'newusername',
      newPassword: 'NewPassword123!',
    };

    it('should update user credentials', async () => {
      const updatedProfile = {
        ...mockUserProfile,
        username: updateCredentialsDto.username,
      };
      usersService.updateCredentials.mockResolvedValue(updatedProfile);

      const result = await controller.updateCredentials(
        mockAuthenticatedUser,
        updateCredentialsDto,
      );

      expect(result).toEqual(updatedProfile);
      expect(usersService.updateCredentials).toHaveBeenCalledWith(
        mockAuthenticatedUser.id,
        updateCredentialsDto,
      );
    });

    it('should handle username-only update', async () => {
      const usernameOnlyDto: UpdateCredentialsDto = {
        currentPassword: 'OldPassword123!',
        username: 'newusername',
      };
      usersService.updateCredentials.mockResolvedValue({
        ...mockUserProfile,
        username: 'newusername',
      });

      await controller.updateCredentials(
        mockAuthenticatedUser,
        usernameOnlyDto,
      );

      expect(usersService.updateCredentials).toHaveBeenCalledWith(
        mockAuthenticatedUser.id,
        usernameOnlyDto,
      );
    });

    it('should handle password-only update', async () => {
      const passwordOnlyDto: UpdateCredentialsDto = {
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword123!',
      };
      usersService.updateCredentials.mockResolvedValue(mockUserProfile);

      await controller.updateCredentials(
        mockAuthenticatedUser,
        passwordOnlyDto,
      );

      expect(usersService.updateCredentials).toHaveBeenCalledWith(
        mockAuthenticatedUser.id,
        passwordOnlyDto,
      );
    });
  });
});
