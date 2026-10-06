import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { User } from '../../users/entities/user.entity';
import type { WalletRequest } from './wallet.request.entity';
import type { Transaction } from '../../transcation/entities/transcation.entity';

@Entity('wallets')
export class Wallet {
    @PrimaryGeneratedColumn()
    id: number;

    @JoinColumn({ name: 'user_id' })
    user: User;

    @Column({ name: 'user_id', type: 'integer' })
    userId: number;

    @Column({
        type: 'decimal',
        precision: 15,
        scale: 2,
        default: 0,
    })
    balance: string;

    @OneToMany(
        () => require('../../transcation/entities/transcation.entity').Transaction,
        (transaction: Transaction) => transaction.wallet,
    )
    transactions: Transaction[];

    @OneToMany(
        () => require('./wallet.request.entity').WalletRequest,
        (request: WalletRequest) => request.wallet,
    )
    requests: WalletRequest[];

    @Column({ name: 'created_by', type: 'integer' })
    createdBy: number;

    @Column({ name: 'updated_by', type: 'integer' })
    updatedBy: number;

    @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
    updatedAt: Date;

}
