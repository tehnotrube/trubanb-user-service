import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  getHello(): string {
    this.logger.log('User service getHello called');
    this.logger.debug('Debug: getHello method execution');
    this.logger.warn('Warning: This is a test warning log');
    return 'hello world from user-service';
  }
}
