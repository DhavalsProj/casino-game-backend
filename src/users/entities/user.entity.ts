import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('Users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ unique: true, length: 15, type: 'varchar' })
  mobile: string;

  @Column({ type: 'varchar', length: 20 })
  type: UserType;

  @Column({ name: 'agent_id', type: 'varchar', length: 10, nullable: true })
  agentId: string | null;

  @Column({ name: 'unique_id', unique: true, length: 10 })
  uniqueId: string;

  @Column({ name: 'password', type: 'varchar', length: 255, nullable: true, select: false })
  password: string | null;

  @Column({ name: 'password_hash', type: 'varchar', length: 255, select: false })
  passwordHash: string;

  @Column({ name: 'is_active', type: 'bit', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'datetime2' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime2' })
  updatedAt: Date;
}

export enum UserType {
  SUPERADMIN = 'superadmin',
  USER = 'user',
  AGENT = 'agent',
}