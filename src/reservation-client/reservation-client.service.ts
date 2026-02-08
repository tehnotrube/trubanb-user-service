import { Injectable, Inject, OnModuleInit, Logger } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, Observable } from 'rxjs';

interface HasActiveReservationsRequest {
  userIdentifier: string; // email for hosts, userId for guests
  isHostCheck: boolean;
}

export interface HasActiveReservationsResponse {
  hasBlockingReservations: boolean;
  message?: string;
}

interface ReservationGrpcService {
  hasActiveOrFutureReservations(
    data: HasActiveReservationsRequest,
  ): Observable<HasActiveReservationsResponse>;
}

@Injectable()
export class ReservationClientService implements OnModuleInit {
  private reservationService: ReservationGrpcService;
  private readonly logger = new Logger(ReservationClientService.name);

  constructor(
    @Inject('RESERVATION_PACKAGE')
    private readonly client: ClientGrpc,
  ) {}

  onModuleInit() {
    this.reservationService =
      this.client.getService<ReservationGrpcService>('ReservationService');
  }

  async hasBlockingReservations(
    userIdentifier: string,
    isHost: boolean,
  ): Promise<HasActiveReservationsResponse> {
    console.log(`[ReservationClientService] calling gRPC with userIdentifier=${userIdentifier}, isHost=${isHost}`);
    try {
      const response = await firstValueFrom(
        this.reservationService.hasActiveOrFutureReservations({
          userIdentifier,
          isHostCheck: isHost,
        }),
      );
      console.log(`[ReservationClientService] gRPC response:`, response);
      return response;
    } catch (error) {
      this.logger.error(
        `gRPC call to hasActiveOrFutureReservations failed for identifier ${userIdentifier} (host=${isHost})`,
        error,
      );

      return {
        hasBlockingReservations: true,
        message:
          'Unable to verify reservation status right now – deletion blocked for safety',
      };
    }
  }
}
