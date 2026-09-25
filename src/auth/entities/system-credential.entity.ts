import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('SystemCredentials')
export class SystemCredential {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'CredentialName', type: 'varchar', length: 50, unique: true })
  credentialName: string;

  @Column({ name: 'PasswordHash', type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ name: 'IsActive', type: 'bit', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'CreatedAt', type: 'datetime2' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UpdatedAt', type: 'datetime2' })
  updatedAt: Date;
}