import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import { UserRole } from './roles.guard';

/**
 * Kong API Gateway Auth Guard
 *
 * Kong validates JWT tokens and forwards user information via headers:
 * - X-User-Id: User's unique identifier
 * - X-User-Email: User's email address
 * - X-User-Role: User's role (guest, host, admin)
 *
 * This guard extracts user info from Kong headers instead of re-validating JWT.
 */
@Injectable()
export class KongJwtGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    // Extract user info from Kong headers
    const userId = request.headers['x-user-id'];
    const userEmail = request.headers['x-user-email'];
    const userRole = request.headers['x-user-role'] as UserRole;

    if (!userId) {
      throw new UnauthorizedException('No user information found in request headers');
    }

    // Attach user info to request object for use in controllers
    const user: AuthenticatedUser = {
      id: userId,
      email: userEmail,
      role: userRole,
    };

    request.user = user;

    return true;
  }
}
