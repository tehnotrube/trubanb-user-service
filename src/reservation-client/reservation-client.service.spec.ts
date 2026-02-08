import { Test, TestingModule } from '@nestjs/testing';
import {
  ReservationClientService,
  HasActiveReservationsResponse,
} from './reservation-client.service';
import { of } from 'rxjs';
import { ClientGrpc } from '@nestjs/microservices';

interface MockReservationGrpcService {
  hasActiveOrFutureReservations: jest.Mock;
}

describe('ReservationClientService', () => {
  let service: ReservationClientService;
  let mockGrpcService: MockReservationGrpcService;

  const mockClientGrpc: jest.Mocked<Partial<ClientGrpc>> = {
    getService: jest.fn(),
  };

  beforeEach(async () => {
    mockGrpcService = {
      hasActiveOrFutureReservations: jest.fn(),
    };

    (mockClientGrpc.getService as jest.Mock).mockReturnValue(mockGrpcService);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationClientService,
        {
          provide: 'RESERVATION_PACKAGE',
          useValue: mockClientGrpc,
        },
      ],
    }).compile();

    service = module.get<ReservationClientService>(ReservationClientService);
    service.onModuleInit();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('hasBlockingReservations', () => {
    const userId = 'usr_987654';

    it('should return false when no blocking reservations (guest)', async () => {
      const expected: HasActiveReservationsResponse = {
        hasBlockingReservations: false,
        message: undefined,
      };

      mockGrpcService.hasActiveOrFutureReservations.mockReturnValue(of(expected));

      const result = await service.hasBlockingReservations(userId, false);

      expect(mockGrpcService.hasActiveOrFutureReservations).toHaveBeenCalledWith({
        userId,
        isHostCheck: false,
      });
      expect(result).toEqual(expected);
    });

    it('should return true + message when blocking reservations exist (host)', async () => {
      const expected: HasActiveReservationsResponse = {
        hasBlockingReservations: true,
        message: '3 future reservations found on your accommodations',
      };

      mockGrpcService.hasActiveOrFutureReservations.mockReturnValue(of(expected));

      const result = await service.hasBlockingReservations(userId, true);

      expect(result).toEqual(expected);
      expect(mockGrpcService.hasActiveOrFutureReservations).toHaveBeenCalledWith({
        userId,
        isHostCheck: true,
      });
    });

  });
});