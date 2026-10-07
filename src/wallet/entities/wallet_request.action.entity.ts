import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import type { WalletRequest } from "./wallet.request.entity";
import type { User } from "../../users/entities/user.entity";

export enum WalletRequestActionType {
  CREATED = 'CREATED',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
}

@Entity('wallet_request_actions')
export class WalletRequestAction {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(
      () => require('./wallet.request.entity').WalletRequest,
      (request: WalletRequest) => request.actions,
      {
        onDelete: 'CASCADE',
      },
    )

    @JoinColumn({ name: 'request_id' })
    request: WalletRequest;

    @Column({ name: 'request_id' })
    requestId: number;

    @ManyToOne(() => require('../../users/entities/user.entity').User, {
    nullable: true,
    onDelete: 'SET NULL',
  })

    @JoinColumn({ name: 'performed_by' })
    performedByUser: User;

    @Column({
        name: 'performed_by',
        nullable: true,
    })
    performedBy: number | null;

    @Column({
        type: 'enum',
        enum: WalletRequestActionType,
    })
    action: WalletRequestActionType;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;
}