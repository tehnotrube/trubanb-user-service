import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { KongJwtGuard } from './kong-jwt.guard';
import { UserRole } from './roles.guard';

describe('KongJwtGuard', () => {
  let guard: KongJwtGuard;

  beforeEach(() => {
    guard = new KongJwtGuard();
  });

  const createMockExecutionContext = (
    headers: Record<string, string | undefined>,
  ): ExecutionContext => {
    const request = {
      headers,
      user: undefined,
    };

    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as ExecutionContext;
  };

  describe('canActivate', () => {
    it('should return true and attach user when all headers are present', () => {
      const context = createMockExecutionContext({
        'x-user-id': 'user-uuid-123',
        'x-user-email': 'test@example.com',
        'x-user-role': 'guest',
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
      const request = context.switchToHttp().getRequest();
      expect(request.user).toEqual({
        id: 'user-uuid-123',
        email: 'test@example.com',
        role: 'guest',
      });
    });

    it('should throw UnauthorizedException when x-user-id is missing', () => {
      const context = createMockExecutionContext({
        'x-user-email': 'test@example.com',
        'x-user-role': 'guest',
      });

      expect(() => guard.canActivate(context)).toThrow(
        new UnauthorizedException(
          'No user information found in request headers',
        ),
      );
    });

    it('should use empty string for email when not provided', () => {
      const context = createMockExecutionContext({
        'x-user-id': 'user-uuid-123',
        'x-user-role': 'guest',
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
      const request = context.switchToHttp().getRequest();
      expect(request.user?.email).toBe('');
    });

    it('should default to GUEST role when not provided', () => {
      const context = createMockExecutionContext({
        'x-user-id': 'user-uuid-123',
        'x-user-email': 'test@example.com',
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
      const request = context.switchToHttp().getRequest();
      expect(request.user?.role).toBe(UserRole.GUEST);
    });

    it('should handle HOST role', () => {
      const context = createMockExecutionContext({
        'x-user-id': 'user-uuid-123',
        'x-user-email': 'host@example.com',
        'x-user-role': 'host',
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
      const request = context.switchToHttp().getRequest();
      expect(request.user?.role).toBe('host');
    });

    it('should handle ADMIN role', () => {
      const context = createMockExecutionContext({
        'x-user-id': 'user-uuid-123',
        'x-user-email': 'admin@example.com',
        'x-user-role': 'admin',
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
      const request = context.switchToHttp().getRequest();
      expect(request.user?.role).toBe('admin');
    });

    it('should work with only x-user-id header', () => {
      const context = createMockExecutionContext({
        'x-user-id': 'user-uuid-123',
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
      const request = context.switchToHttp().getRequest();
      expect(request.user).toEqual({
        id: 'user-uuid-123',
        email: '',
        role: UserRole.GUEST,
      });
    });
  });
});
