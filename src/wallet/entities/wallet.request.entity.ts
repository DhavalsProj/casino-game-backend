import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { User } from "../../users/entities/user.entity";
import { Wallet } from "./wallet.entity";
import { WalletRequestAction } from "./wallet_request.action.entity";

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

    @ManyToOne(() => User, {onDelete: 'CASCADE',})
    @JoinColumn({ name: 'user_id' })
    user: User;

    @Column({ name: 'user_id' })
    userId: number;

    @ManyToOne(() => Wallet, (wallet) => wallet.requests, {
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'wallet_id' })
    wallet: Wallet;

    @Column({ name: 'wallet_id' })
    walletId: number;

    @Column({ type: 'enum', enum: WalletRequestType,})
    type: WalletRequestType;

    @Column({ type: 'bigint',})
    amount: string;

    @Column({
        type: 'enum',
        enum: WalletRequestStatus,
        default: WalletRequestStatus.PENDING,
    })
    status: WalletRequestStatus;

    @OneToMany(() => WalletRequestAction,(action) => action.request,)
    actions: WalletRequestAction[];

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
