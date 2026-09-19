import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ unique: true, length: 15, type: 'varchar' })
  mobile: string;

  @Column()
  type: string;

  @Column({ name: 'agent_id', nullable: true })
  agentId: string;

  @Column({ name: 'unique_id', unique: true, length: 10 })
  uniqueId: string;

  @Column({ unique: true, length: 6 })
  password: string;

  @Column({ unique: true, length: 4 })
  pin: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}