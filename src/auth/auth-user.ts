import { UserType } from '../users/entities/user.entity';

export interface AuthUser {
  id: number;
  mobile: string;
  type: UserType | 'superadmin' | 'admin';
  uniqueId: string;
  agentId?: string | null;
}
