import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomInt } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { AuthUser } from '../auth/auth-user';
import { UserType } from '../users/entities/user.entity';

export interface MemoryUser {
  id: number;
  name: string;
  mobile: string;
  type: UserType;
  agentId: string | null;
  uniqueId: string;
  passwordHash: string;
  createdAt: Date;
}

@Injectable()
export class NoDbService {
  private readonly users: MemoryUser[] = [];
  private readonly plainPasswords = new Map<string, string>();

  constructor(private readonly jwtService: JwtService) {
    this.addSample('Aarav Mehta', '9876543210', UserType.AGENT, null, 'GK00123456', 'Agent@123');
    this.addSample('John Carter', '9876543211', UserType.USER, 'GK00123456', 'GK00123789', 'User@123');
  }

  async login(identifier: string, password: string) {
    if (identifier.toLowerCase() === (process.env.SUPERADMIN_IDENTIFIER ?? 'superadmin').toLowerCase() && password === (process.env.SUPERADMIN_PASSWORD ?? 'SuperAdmin@123')) {
      const user = { id: 0, name: 'Super Admin', mobile: '9000000000', type: 'superadmin', uniqueId: 'SA00000000', agentId: null };
      return { accessToken: await this.jwtService.signAsync({ sub: user.id, mobile: user.mobile, type: user.type, uniqueId: user.uniqueId, agentId: null }), user };
    }

    const user = this.users.find((item) => item.mobile === identifier || item.uniqueId === identifier);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new ForbiddenException('Mobile, unique ID, or password is incorrect');
    }
    const safeUser = this.toResponse(user);
    return {
      accessToken: await this.jwtService.signAsync({ sub: user.id, mobile: user.mobile, type: user.type, uniqueId: user.uniqueId, agentId: user.agentId }),
      user: safeUser,
    };
  }

  list(currentUser: AuthUser, type?: UserType) {
    const visible = this.users.filter((user) => {
      if (currentUser.type === UserType.AGENT) return user.type === UserType.USER && user.agentId === currentUser.uniqueId;
      if (currentUser.type === UserType.USER) return user.id === currentUser.id;
      return !type || user.type === type;
    });
    return visible.map((user) => this.toResponse(user));
  }

  agents(currentUser: AuthUser) {
    if (currentUser.type !== 'superadmin' && currentUser.type !== 'admin') throw new ForbiddenException('Only admins can list agents');
    return this.users.filter((user) => user.type === UserType.AGENT).map((user) => this.toResponse(user));
  }

  async create(request: { name: string; mobile: string; type?: UserType; agentId?: string }, currentUser: AuthUser) {
    const type = currentUser.type === UserType.AGENT ? UserType.USER : request.type ?? UserType.USER;
    if (type === UserType.AGENT && currentUser.type !== 'superadmin' && currentUser.type !== 'admin') throw new ForbiddenException('Only admins can create agents');
    const agentId = type === UserType.USER ? (currentUser.type === UserType.AGENT ? currentUser.uniqueId : request.agentId) : null;
    if (type === UserType.USER && !this.users.some((user) => user.type === UserType.AGENT && user.uniqueId === agentId)) throw new NotFoundException('Agent not found');
    if (this.users.some((user) => user.mobile === request.mobile)) throw new ConflictException('User already registered');
    const normalizedAgentId = agentId ?? null;
    const uniqueId = this.generateUniqueId(type, normalizedAgentId);
    const password = this.generatePassword();
    const user: MemoryUser = { id: Math.max(0, ...this.users.map((item) => item.id)) + 1, name: request.name, mobile: request.mobile, type, agentId: normalizedAgentId, uniqueId, passwordHash: await bcrypt.hash(password, 12), createdAt: new Date() };
    this.users.unshift(user);
    this.plainPasswords.set(uniqueId, password);
    return { user: this.toResponse(user), credentials: { password } };
  }

  getById(id: number, currentUser: AuthUser) {
    const user = this.users.find((item) => item.id === id);
    if (!user) throw new NotFoundException('User not found');
    const allowed = currentUser.type === 'superadmin' || currentUser.type === 'admin' || (currentUser.type === UserType.AGENT && user.agentId === currentUser.uniqueId) || (currentUser.type === UserType.USER && user.id === currentUser.id);
    if (!allowed) throw new ForbiddenException('You are not authorized to view this user');
    return this.toResponse(user);
  }

  private addSample(name: string, mobile: string, type: UserType, agentId: string | null, uniqueId: string, password: string): void {
    void bcrypt.hash(password, 12).then((passwordHash) => this.users.push({ id: this.users.length + 1, name, mobile, type, agentId, uniqueId, passwordHash, createdAt: new Date() }));
  }

  private toResponse(user: MemoryUser) {
    return { id: user.id, name: user.name, mobile: user.mobile, type: user.type, agentId: user.agentId, agentName: user.agentId ? this.users.find((item) => item.uniqueId === user.agentId)?.name ?? null : null, uniqueId: user.uniqueId, createdAt: user.createdAt, updatedAt: user.createdAt };
  }

  private generateUniqueId(type: UserType, agentId: string | null): string {
    let candidate = '';
    do {
      candidate = type === UserType.AGENT ? `GK00${this.randomDigits(6)}` : `${agentId!.slice(0, 7)}${this.randomDigits(3)}`;
    } while (this.users.some((user) => user.uniqueId === candidate));
    return candidate;
  }

  private generatePassword(): string { return `${this.randomDigits(4)}Aa`; }
  private randomDigits(length: number): string { return Array.from({ length }, () => randomInt(10)).join(''); }
}
