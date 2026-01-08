import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan } from 'typeorm';
import { Repository } from 'typeorm';
import { RefreshToken } from '../entities/refresh-token.entity';

/**
 * Scheduled task to clean up expired and revoked refresh tokens
 * Runs daily at 2:00 AM to maintain database hygiene
 */
@Injectable()
export class CleanupRefreshTokensTask {
  private readonly logger = new Logger(CleanupRefreshTokensTask.name);

  constructor(
    @InjectRepository(RefreshToken)
    private refreshTokensRepository: Repository<RefreshToken>,
  ) {}

  /**
   * Delete expired refresh tokens
   * Runs daily at 2:00 AM server time
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleCleanup() {
    this.logger.log('Starting refresh token cleanup task');

    try {
      const now = new Date();

      // Delete tokens that are either:
      // 1. Expired (expiresAt < now)
      // 2. Revoked (isRevoked = true)
      const result = await this.refreshTokensRepository
        .createQueryBuilder()
        .delete()
        .from(RefreshToken)
        .where('expiresAt < :now OR isRevoked = :revoked', {
          now,
          revoked: true,
        })
        .execute();

      this.logger.log(
        `Cleanup completed: ${result.affected || 0} refresh tokens deleted`,
      );
    } catch (error) {
      this.logger.error('Error during refresh token cleanup', error);
    }
  }

  /**
   * Manual cleanup method for testing or on-demand execution
   */
  async cleanupExpiredTokens(): Promise<number> {
    const now = new Date();

    const result = await this.refreshTokensRepository
      .createQueryBuilder()
      .delete()
      .from(RefreshToken)
      .where('expiresAt < :now OR isRevoked = :revoked', {
        now,
        revoked: true,
      })
      .execute();

    return result.affected || 0;
  }
}