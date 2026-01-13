import { Controller, Get } from '@nestjs/common';

@Controller('api/users/health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      service: 'user-service',
      timestamp: new Date().toISOString(),
    };
  }
}
