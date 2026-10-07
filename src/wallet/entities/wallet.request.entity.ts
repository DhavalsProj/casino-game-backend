import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import type { User } from "../../users/entities/user.entity";
import type { Wallet } from "./wallet.entity";
import type { WalletRequestAction } from "./wallet_request.action.entity";

export enum WalletRequestType {
  ADD_POINTS = 'ADD_POINTS',
  WITHDRAW = 'WITHDRAW',
}

export enum WalletRequestStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
}

@Entity('wallet_requests')
export class WalletRequest {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => require('../../users/entities/user.entity').User, {onDelete: 'CASCADE',})
    @JoinColumn({ name: 'user_id' })
    user: User;

    @Column({ name: 'user_id' })
    userId: number;

    @ManyToOne(
        () => require('./wallet.entity').Wallet,
        (wallet: Wallet) => wallet.requests,
        {
            onDelete: 'CASCADE',
        },
    )
    @JoinColumn({ name: 'wallet_id' })
    wallet: Wallet;

    @Column({ name: 'wallet_id' })
    walletId: number;

    @Column({ type: 'enum', enum: WalletRequestType,})
    type: WalletRequestType;

    @Column({ type: 'decimal', precision: 15, scale: 2 })
    amount: string;

    @Column({
        type: 'enum',
        enum: WalletRequestStatus,
        default: WalletRequestStatus.PENDING,
    })
    status: WalletRequestStatus;

    @OneToMany(
        () => require('./wallet_request.action.entity').WalletRequestAction,
        (action: WalletRequestAction) => action.request,
    )
    actions: WalletRequestAction[];

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
