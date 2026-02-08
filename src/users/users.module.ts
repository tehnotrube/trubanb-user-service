import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { ReservationsClientModule } from '../reservation-client/reservation-client.module';
import { MessagingModule } from 'src/messaging/messaging.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]),ReservationsClientModule,
    MessagingModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [TypeOrmModule],
})
export class UsersModule {}
