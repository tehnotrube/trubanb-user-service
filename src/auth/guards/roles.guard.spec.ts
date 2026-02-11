import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard, UserRole } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as any;
    guard = new RolesGuard(reflector);
  });

  const createMockExecutionContext = (
    userRole?: UserRole,
  ): ExecutionContext => {
    const request = {
      user: userRole ? { role: userRole } : undefined,
    };

    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    } as unknown as ExecutionContext;
  };

  describe('canActivate', () => {
    it('should allow access when no roles are required', () => {
      reflector.getAllAndOverride.mockReturnValue(undefined);
      const context = createMockExecutionContext(UserRole.GUEST);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow access when user has required role', () => {
      reflector.getAllAndOverride.mockReturnValue([UserRole.GUEST]);
      const context = createMockExecutionContext(UserRole.GUEST);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow access when user has one of multiple required roles', () => {
      reflector.getAllAndOverride.mockReturnValue([
        UserRole.HOST,
        UserRole.ADMIN,
      ]);
      const context = createMockExecutionContext(UserRole.HOST);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should throw ForbiddenException when user role does not match', () => {
      reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);
      const context = createMockExecutionContext(UserRole.GUEST);

      expect(() => guard.canActivate(context)).toThrow(
        new ForbiddenException(
          `User role 'guest' does not have access. Required roles: admin`,
        ),
      );
    });

    it('should throw ForbiddenException when user object is missing', () => {
      reflector.getAllAndOverride.mockReturnValue([UserRole.GUEST]);
      const context = createMockExecutionContext();

      expect(() => guard.canActivate(context)).toThrow(
        new ForbiddenException('User role not found'),
      );
    });

    it('should handle case-insensitive role comparison', () => {
      reflector.getAllAndOverride.mockReturnValue([UserRole.HOST]);
      const request = {
        user: { role: 'HOST' },
      };
      const context = {
        switchToHttp: () => ({
          getRequest: () => request,
        }),
        getHandler: () => jest.fn(),
        getClass: () => jest.fn(),
      } as unknown as ExecutionContext;

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow ADMIN to access ADMIN-only routes', () => {
      reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);
      const context = createMockExecutionContext(UserRole.ADMIN);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should deny GUEST access to HOST-only routes', () => {
      reflector.getAllAndOverride.mockReturnValue([UserRole.HOST]);
      const context = createMockExecutionContext(UserRole.GUEST);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should call reflector with correct parameters', () => {
      reflector.getAllAndOverride.mockReturnValue([UserRole.GUEST]);
      const mockHandler = jest.fn();
      const mockClass = jest.fn();
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({ user: { role: UserRole.GUEST } }),
        }),
        getHandler: () => mockHandler,
        getClass: () => mockClass,
      } as unknown as ExecutionContext;

      guard.canActivate(context);

      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
        mockHandler,
        mockClass,
      ]);
    });
  });
});
