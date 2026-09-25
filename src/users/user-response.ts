import { User } from './entities/user.entity';

export interface UserResponse {
  id: number;
  name: string;
  mobile: string;
  type: string;
  agentId: string | null;
  agentName: string | null;
  uniqueId: string;
  createdAt: Date;
  updatedAt: Date;
}

export function toUserResponse(user: User, agentName: string | null = null): UserResponse {
  return {
    id: user.id,
    name: user.name,
    mobile: user.mobile,
    type: user.type,
    agentId: user.agentId ?? null,
    agentName,
    uniqueId: user.uniqueId,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}