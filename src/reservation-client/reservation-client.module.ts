import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'path';
import { ReservationClientService } from './reservation-client.service';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'RESERVATION_PACKAGE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: 'reservation',
            protoPath: join(__dirname, '../proto/reservation.proto'),
            url: configService.get<string>(
              'RESERVATION_GRPC_URL',
              'localhost:50052',
            ),
          },
        }),
      },
    ]),
  ],
  providers: [ReservationClientService],
  exports: [ReservationClientService],
})
export class ReservationsClientModule {}
