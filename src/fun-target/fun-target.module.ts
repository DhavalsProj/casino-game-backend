import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Wallet } from '../wallet/entities/wallet.entity';
import { Transaction } from '../transcation/entities/transcation.entity';
import { FunTargetBet, FunTargetConfig, FunTargetJokerSchedule, FunTargetResultAudit, FunTargetRound } from './entities/fun-target.entity';
import { FunTargetBetController, FunTargetController } from './fun-target.controller';
import { FunTargetService } from './fun-target.service';

@Module({ imports: [TypeOrmModule.forFeature([FunTargetConfig, FunTargetRound, FunTargetBet, FunTargetJokerSchedule, FunTargetResultAudit, Wallet, Transaction]), AuthModule], controllers: [FunTargetController, FunTargetBetController], providers: [FunTargetService] })
export class FunTargetModule {}
