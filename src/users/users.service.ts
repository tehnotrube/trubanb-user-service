import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from './entities/user.entity';
import { UpdateProfileDto } from './dtos/update-profile.dto';
import { UpdateCredentialsDto } from './dtos/update-credentials.dto';
import { ReservationClientService } from '../reservation-client/reservation-client.service';
import { UserEventsPublisher } from '../messaging/user-events.publisher';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private reservationClient: ReservationClientService,
    private userEventsPublisher: UserEventsPublisher,
  ) {}

  async getProfile(userId: string) {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.sanitizeUser(user);
  }

  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto) {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if email is being changed and if it's already taken
    if (updateProfileDto.email && updateProfileDto.email !== user.email) {
      const existingEmail = await this.usersRepository.findOne({
        where: { email: updateProfileDto.email },
      });

      if (existingEmail) {
        throw new ConflictException('Email already in use');
      }
    }

    // Update user fields
    Object.assign(user, updateProfileDto);
    await this.usersRepository.save(user);

    return this.sanitizeUser(user);
  }

  async updateCredentials(
    userId: string,
    updateCredentialsDto: UpdateCredentialsDto,
  ) {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(
      updateCredentialsDto.currentPassword,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Check if username is being changed and if it's already taken
    if (
      updateCredentialsDto.username &&
      updateCredentialsDto.username !== user.username
    ) {
      const existingUsername = await this.usersRepository.findOne({
        where: { username: updateCredentialsDto.username },
      });

      if (existingUsername) {
        throw new ConflictException('Username already taken');
      }

      user.username = updateCredentialsDto.username;
    }

    // Update password if provided
    if (updateCredentialsDto.newPassword) {
      user.password = await bcrypt.hash(updateCredentialsDto.newPassword, 10);
    }

    await this.usersRepository.save(user);

    return this.sanitizeUser(user);
  }

  private sanitizeUser(user: User) {
    const { password: _password, ...result } = user;
    return result;
  }

  async canDeleteAccount(
    userId: string,
    isHost: boolean,
  ): Promise<{ allowed: boolean; reason?: string }> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    console.log(
      `[canDeleteAccount] checking userId=${userId}, isHost=${isHost}`,
    );

    const reply = await this.reservationClient.hasBlockingReservations(
      userId,
      isHost,
    );

    console.log(`[canDeleteAccount] reply:`, reply);

    if (reply.hasBlockingReservations) {
      return {
        allowed: false,
        reason:
          reply.message ??
          (isHost
            ? 'Cannot delete account: you have active or future reservations on your accommodations.'
            : 'Cannot delete account: you have active or future reservations.'),
      };
    }

    return { allowed: true };
  }

  async deleteAccount(userId: string): Promise<void> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.usersRepository.delete({ id: userId });
    Logger.log(`User account deleted: ${userId}`);

    await this.userEventsPublisher.publishUserDeleted({
      userId,
      userEmail: user.email,
      userRole: user.role,
    });
  }
}
