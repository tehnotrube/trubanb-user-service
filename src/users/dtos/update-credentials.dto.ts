import { IsString, MinLength, IsOptional } from 'class-validator';
import { IsStrongPassword } from '../../auth/decorators/is-strong-password.decorator';

export class UpdateCredentialsDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  username?: string;

  @IsOptional()
  @IsString()
  @IsStrongPassword()
  newPassword?: string;

  @IsString()
  currentPassword: string;
}
