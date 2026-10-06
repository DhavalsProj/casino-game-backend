import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { User } from '../users/entities/user.entity';
import { Transaction } from '../transcation/entities/transcation.entity';
import { Wallet } from './entities/wallet.entity';
import { WalletRequest } from './entities/wallet.request.entity';
import { WalletRequestAction } from './entities/wallet_request.action.entity';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Wallet,
      WalletRequest,
      WalletRequestAction,
      Transaction,
      User,
    ]),
    AuthModule,
  ],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
