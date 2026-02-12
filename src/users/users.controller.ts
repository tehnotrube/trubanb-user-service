import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  HttpStatus,
  HttpCode,
  Delete,
  BadRequestException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dtos/update-profile.dto';
import { UpdateCredentialsDto } from './dtos/update-credentials.dto';
import { KongJwtGuard } from '../auth/guards/kong-jwt.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../auth/guards/roles.guard';

@Controller('api/users')
@UseGuards(KongJwtGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  async getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getProfile(user.id);
  }

  @Put('profile')
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.id, updateProfileDto);
  }

  @Put('credentials')
  async updateCredentials(
    @CurrentUser() user: AuthenticatedUser,
    @Body() updateCredentialsDto: UpdateCredentialsDto,
  ) {
    return this.usersService.updateCredentials(user.id, updateCredentialsDto);
  }

  @Delete('account')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAccount(@CurrentUser() user: AuthenticatedUser) {
    const isHost = user.role === UserRole.HOST;

    const check = await this.usersService.canDeleteAccount(user.id, isHost);

    if (!check.allowed) {
      throw new BadRequestException(check.reason);
    }

    await this.usersService.deleteAccount(user.id);
  }
}
