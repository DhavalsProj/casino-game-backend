import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('wallets')
export class Wallet {
    @PrimaryGeneratedColumn()
    id: number;
    
    @Column({ name: 'user_id', type: 'integer' })
    userId: number;

    @Column({
        type: 'decimal',
        precision: 15,
        scale: 2,
        default: 0,
    })
    balance: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

}