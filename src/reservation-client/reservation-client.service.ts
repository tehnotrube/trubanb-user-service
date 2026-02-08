import { Injectable, Inject, OnModuleInit, Logger } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, Observable } from 'rxjs';


interface HasActiveReservationsRequest {
  userId: string;
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
    this.reservationService = this.client.getService<ReservationGrpcService>('ReservationService');
  }

  async hasBlockingReservations(
    userId: string,
    isHost: boolean,
  ): Promise<HasActiveReservationsResponse> {
    try {
      return await firstValueFrom(
        this.reservationService.hasActiveOrFutureReservations({
          userId,
          isHostCheck: isHost,
        }),
      );
    } catch (error) {
      this.logger.error(
        `gRPC call to hasActiveOrFutureReservations failed for user ${userId} (host=${isHost})`,
        error,
      );

      return {
        hasBlockingReservations: true,
        message: 'Unable to verify reservation status right now – deletion blocked for safety',
      };
    }
  }
}