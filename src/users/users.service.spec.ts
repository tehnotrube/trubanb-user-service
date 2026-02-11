import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  NotFoundException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import { User, UserRole } from './entities/user.entity';
import { UpdateProfileDto } from './dtos/update-profile.dto';
import { UpdateCredentialsDto } from './dtos/update-credentials.dto';

jest.mock('bcrypt');

describe('UsersService', () => {
  let service: UsersService;
  let usersRepository: jest.Mocked<Repository<User>>;
  let mockUser: User;

  const createMockUser = (): User => ({
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
  });

  beforeEach(async () => {
    mockUser = createMockUser();
    const mockUsersRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUsersRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    usersRepository = module.get(getRepositoryToken(User));
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('getProfile', () => {
    it('should return user profile without password', async () => {
      usersRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.getProfile(mockUser.id);

      expect(result).not.toHaveProperty('password');
      expect(result).toHaveProperty('id', mockUser.id);
      expect(result).toHaveProperty('email', mockUser.email);
      expect(result).toHaveProperty('username', mockUser.username);
      expect(usersRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUser.id },
      });
    });

    it('should throw NotFoundException if user not found', async () => {
      usersRepository.findOne.mockResolvedValue(null);

      await expect(service.getProfile('non-existent-id')).rejects.toThrow(
        new NotFoundException('User not found'),
      );
    });
  });

  describe('updateProfile', () => {
    const updateProfileDto: UpdateProfileDto = {
      firstName: 'Updated',
      lastName: 'Name',
      email: 'updated@example.com',
      address: '789 Updated St',
    };

    it('should successfully update user profile', async () => {
      usersRepository.findOne
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(null);
      usersRepository.save.mockResolvedValue({
        ...mockUser,
        ...updateProfileDto,
      });

      const result = await service.updateProfile(mockUser.id, updateProfileDto);

      expect(result).not.toHaveProperty('password');
      expect(result).toHaveProperty('firstName', updateProfileDto.firstName);
      expect(result).toHaveProperty('lastName', updateProfileDto.lastName);
      expect(usersRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if user not found', async () => {
      usersRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateProfile('non-existent-id', updateProfileDto),
      ).rejects.toThrow(new NotFoundException('User not found'));
    });

    it('should throw ConflictException if email is already in use', async () => {
      const anotherUser = {
        ...mockUser,
        id: 'another-user-id',
        email: 'updated@example.com',
      };
      // First call returns the user, second call returns another user with the same email
      usersRepository.findOne
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(anotherUser);

      await expect(
        service.updateProfile(mockUser.id, updateProfileDto),
      ).rejects.toThrow(ConflictException);

      expect(usersRepository.findOne).toHaveBeenCalledTimes(2);
    });

    it('should allow updating email to the same value', async () => {
      const sameEmailDto: UpdateProfileDto = {
        email: mockUser.email,
      };
      usersRepository.findOne.mockResolvedValue(mockUser);
      usersRepository.save.mockResolvedValue(mockUser);

      const result = await service.updateProfile(mockUser.id, sameEmailDto);

      expect(result).toHaveProperty('email', mockUser.email);
    });

    it('should update only provided fields', async () => {
      const partialDto: UpdateProfileDto = {
        firstName: 'OnlyFirst',
      };
      usersRepository.findOne.mockResolvedValue(mockUser);
      usersRepository.save.mockResolvedValue({ ...mockUser, ...partialDto });

      const result = await service.updateProfile(mockUser.id, partialDto);

      expect(result).toHaveProperty('firstName', 'OnlyFirst');
      expect(result).toHaveProperty('lastName', mockUser.lastName);
    });
  });

  describe('updateCredentials', () => {
    const updateCredentialsDto: UpdateCredentialsDto = {
      currentPassword: 'OldPassword123!',
      username: 'newusername',
      newPassword: 'NewPassword123!',
    };

    it('should successfully update username and password', async () => {
      // First call returns the user, second call returns null (username not taken)
      usersRepository.findOne
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(null);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('newHashedPassword');
      usersRepository.save.mockResolvedValue({
        ...mockUser,
        username: updateCredentialsDto.username,
        password: 'newHashedPassword',
      });

      const result = await service.updateCredentials(
        mockUser.id,
        updateCredentialsDto,
      );

      expect(result).not.toHaveProperty('password');
      expect(result).toHaveProperty('username', updateCredentialsDto.username);
      expect(bcrypt.compare).toHaveBeenCalled();
      expect(bcrypt.hash).toHaveBeenCalledWith(
        updateCredentialsDto.newPassword,
        10,
      );
    });

    it('should throw NotFoundException if user not found', async () => {
      usersRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateCredentials('non-existent-id', updateCredentialsDto),
      ).rejects.toThrow(new NotFoundException('User not found'));
    });

    it('should throw UnauthorizedException if current password is incorrect', async () => {
      usersRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.updateCredentials(mockUser.id, updateCredentialsDto),
      ).rejects.toThrow(
        new UnauthorizedException('Current password is incorrect'),
      );
    });

    it('should throw ConflictException if username is already taken', async () => {
      const anotherUser = {
        ...mockUser,
        id: 'another-user-id',
        username: 'newusername',
      };
      // First call returns the user, second call returns another user with the same username
      usersRepository.findOne
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(anotherUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.updateCredentials(mockUser.id, updateCredentialsDto),
      ).rejects.toThrow(ConflictException);

      expect(usersRepository.findOne).toHaveBeenCalledTimes(2);
    });

    it('should update only username when newPassword is not provided', async () => {
      const usernameOnlyDto: UpdateCredentialsDto = {
        currentPassword: 'OldPassword123!',
        username: 'newusername',
      };
      usersRepository.findOne
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(null);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      usersRepository.save.mockResolvedValue({
        ...mockUser,
        username: usernameOnlyDto.username,
      });

      const result = await service.updateCredentials(
        mockUser.id,
        usernameOnlyDto,
      );

      expect(result).toHaveProperty('username', usernameOnlyDto.username);
      expect(bcrypt.hash).not.toHaveBeenCalled();
    });

    it('should update only password when username is not provided', async () => {
      const passwordOnlyDto: UpdateCredentialsDto = {
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword123!',
      };
      usersRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('newHashedPassword');
      usersRepository.save.mockResolvedValue({
        ...mockUser,
        password: 'newHashedPassword',
      });

      await service.updateCredentials(mockUser.id, passwordOnlyDto);

      expect(bcrypt.hash).toHaveBeenCalledWith(passwordOnlyDto.newPassword, 10);
    });

    it('should allow keeping same username', async () => {
      const sameUsernameDto: UpdateCredentialsDto = {
        currentPassword: 'OldPassword123!',
        username: mockUser.username,
      };
      usersRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      usersRepository.save.mockResolvedValue(mockUser);

      const result = await service.updateCredentials(
        mockUser.id,
        sameUsernameDto,
      );

      expect(result).toHaveProperty('username', mockUser.username);
    });
  });
});
