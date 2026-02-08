// NOTE: Do NOT export AuthModule here to avoid circular dependencies
// AuthModule should be imported directly: import { AuthModule } from './auth/auth.module'
export * from './guards/kong-jwt.guard';
export * from './decorators/current-user.decorator';
export * from './interfaces/authenticated-user.interface';