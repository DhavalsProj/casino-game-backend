import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
} from 'typeorm';

import type { User } from '../../users/entities/user.entity';
import type { Wallet } from '../../wallet/entities/wallet.entity';
import type { WalletRequest } from '../../wallet/entities/wallet.request.entity';

export enum WalletTransactionType {
  CREDIT = 'CREDIT',
  DEBIT = 'DEBIT',
}

export enum WalletTransactionSource {
  ADMIN_ADD = 'ADMIN_ADD',
  WITHDRAW = 'WITHDRAW',
  GAME_WIN = 'GAME_WIN',
  GAME_ENTRY = 'GAME_ENTRY',
  BONUS = 'BONUS',
  REFUND = 'REFUND',
  OTHER = 'OTHER',
}

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(
    () => require('../../wallet/entities/wallet.entity').Wallet,
    (wallet: Wallet) => wallet.transactions,
    {
    onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'wallet_id' })
  wallet: Wallet;

  @Column({ name: 'wallet_id' })
  walletId: number;

  @ManyToOne(() => require('../../users/entities/user.entity').User, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => require('../../wallet/entities/wallet.request.entity').WalletRequest, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'request_id' })
  request: WalletRequest;

  @Column({
    name: 'request_id',
    nullable: true,
  })
  requestId: number;

  @Column({
    type: 'enum',
    enum: WalletTransactionType,
  })
  type: WalletTransactionType;

  @Column({
    type: 'enum',
    enum: WalletTransactionSource,
  })
  source: WalletTransactionSource;

  @Column({
    type: 'bigint',
  })
  amount: string;

  @Column({
    name: 'balance_before',
    type: 'bigint',
  })
  balanceBefore: string;

  @Column({
    name: 'balance_after',
    type: 'bigint',
  })
  balanceAfter: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  description: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}