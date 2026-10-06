import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { User } from '../users/entities/user.entity';
import { Wallet } from '../wallet/entities/wallet.entity';
import { WalletRequest } from '../wallet/entities/wallet.request.entity';
import { Transaction } from './entities/transcation.entity';
import { TranscationController } from './transcation.controller';
import { TranscationService } from './transcation.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, Wallet, WalletRequest, User]),
    AuthModule,
  ],
  controllers: [TranscationController],
  providers: [TranscationService],
  exports: [TranscationService],
})
export class TranscationModule {}
