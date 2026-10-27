import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('api_logs')
@Index('idx_api_logs_created_at', ['createdAt'])
@Index('idx_api_logs_user_created_at', ['userId', 'createdAt'])
@Index('idx_api_logs_status_created_at', ['statusCode', 'createdAt'])
export class ApiLog {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'request_id', type: 'varchar', length: 64 })
  requestId: string;

  @Column({ type: 'varchar', length: 10 })
  method: string;

  @Column({ type: 'text' })
  path: string;

  @Column({ name: 'status_code', type: 'integer' })
  statusCode: number;

  @Column({ name: 'duration_ms', type: 'integer' })
  durationMs: number;

  @Column({ name: 'user_id', type: 'integer', nullable: true })
  userId: number | null;

  @Column({ name: 'user_type', type: 'varchar', length: 20, nullable: true })
  userType: string | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  @Column({ name: 'user_agent', type: 'varchar', length: 500, nullable: true })
  userAgent: string | null;

  @Column({ name: 'request_headers', type: 'jsonb' })
  requestHeaders: Record<string, string>;

  @Column({ name: 'request_query', type: 'jsonb' })
  requestQuery: Record<string, unknown>;

  @Column({ name: 'request_body', type: 'jsonb', nullable: true })
  requestBody: unknown;

  @Column({ name: 'response_body', type: 'jsonb', nullable: true })
  responseBody: unknown;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
