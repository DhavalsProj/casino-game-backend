import { UserType } from '../users/entities/user.entity';

export interface AuthUser {
  id: number;
  mobile: string;
  type: UserType | 'superadmin' | 'admin';
  uniqueId: string | null;
  agentId?: string | null;
}
