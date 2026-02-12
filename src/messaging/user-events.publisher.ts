import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { Injectable, Logger } from '@nestjs/common';
import { UserRole } from 'src/auth/guards/roles.guard';

export interface UserDeletedEvent {
  userId: string;
  userEmail: string;
  userRole: UserRole; // e.g. ['GUEST', 'HOST']
}

@Injectable()
export class UserEventsPublisher {
  private readonly logger = new Logger(UserEventsPublisher.name);

  constructor(private readonly amqp: AmqpConnection) {}

  async publishUserDeleted(payload: UserDeletedEvent) {
    try {
      await this.amqp.publish('user.events', 'user.deleted', payload);
      this.logger.log(
        `Published user.deleted → userId=${payload.userId}, email=${payload.userEmail}`,
      );
    } catch (err) {
      this.logger.error(`Failed to publish user.deleted`, err);
    }
  }
}
