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
  Param,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dtos/update-profile.dto';
import { UpdateCredentialsDto } from './dtos/update-credentials.dto';
import { KongJwtGuard } from '../auth/guards/kong-jwt.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../auth/guards/roles.guard';

@Controller('api/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  @UseGuards(KongJwtGuard)
  async getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getProfile(user.id);
  }

  @Put('profile')
  @UseGuards(KongJwtGuard)
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.id, updateProfileDto);
  }

  @Put('credentials')
  @UseGuards(KongJwtGuard)
  async updateCredentials(
    @CurrentUser() user: AuthenticatedUser,
    @Body() updateCredentialsDto: UpdateCredentialsDto,
  ) {
    return this.usersService.updateCredentials(user.id, updateCredentialsDto);
  }

  @Delete('account')
  @UseGuards(KongJwtGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAccount(@CurrentUser() user: AuthenticatedUser) {
    const isHost = user.role === UserRole.HOST;

    const check = await this.usersService.canDeleteAccount(user.id, isHost);

    if (!check.allowed) {
      throw new BadRequestException(check.reason);
    }

    await this.usersService.deleteAccount(user.id);
  }

  @Get('public/:id')
  async getPublicProfile(@Param('id') id: string) {
    return this.usersService.getPublicProfile(id);
  }
}
