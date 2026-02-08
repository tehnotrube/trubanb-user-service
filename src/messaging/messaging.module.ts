import { Module } from '@nestjs/common';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { UserEventsPublisher } from './user-events.publisher'

@Module({
  imports: [
    RabbitMQModule.forRootAsync({
      useFactory: () => ({
        exchanges: [
          {
            name: 'user.events',
            type: 'topic',
          },
        ],
        uri: process.env.RABBITMQ_URL!,
        connectionInitOptions: { wait: false, reject: false },
      }),
    }),
  ],
  providers: [UserEventsPublisher],
  exports: [UserEventsPublisher],
})
export class MessagingModule {}
