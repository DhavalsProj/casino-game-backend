import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('LoginAudit')
export class LoginAudit {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'user_id', type: 'int', nullable: true })
  userId: number | null;

  @Column({ name: 'unique_id', type: 'varchar', length: 10, nullable: true })
  uniqueId: string | null;

  @Column({ name: 'login_type', type: 'varchar', length: 20 })
  loginType: 'NORMAL' | 'MASTER';

  @Column({ name: 'login_status', type: 'varchar', length: 20 })
  loginStatus: 'SUCCESS' | 'FAILED';

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  @Column({ name: 'user_agent', type: 'varchar', length: 500, nullable: true })
  userAgent: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime2' })
  createdAt: Date;
}