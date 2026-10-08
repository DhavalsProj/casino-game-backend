import { ConflictException, ForbiddenException, Injectable, NotFoundException, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomInt } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { AuthUser } from '../auth/auth-user';
import { PasswordService } from '../auth/password.service';
import { UserType } from '../users/entities/user.entity';

export interface MemoryUser {
  id: number;
  name: string;
  mobile: string;
  type: UserType;
  agentId: string | null;
  uniqueId: string;
  password: string;
  passwordHash: string;
  createdAt: Date;
}

@Injectable()
export class NoDbService implements OnModuleInit {
  private readonly users: MemoryUser[] = [];

  constructor(
    private readonly jwtService: JwtService,
    private readonly passwordService: PasswordService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.addSample('Aarav Mehta', '9876543210', UserType.AGENT, null, 'GK00123456', 'Agent@123');
    await this.addSample('John Carter', '9876543211', UserType.USER, 'GK00123456', 'GK00123789', 'User@123');
  }

  async login(identifier: string, password: string) {
    if (identifier.toLowerCase() === (process.env.SUPERADMIN_IDENTIFIER ?? 'superadmin').toLowerCase() && password === (process.env.SUPERADMIN_PASSWORD ?? 'SuperAdmin@123')) {
      const user = { id: 0, name: 'Super Admin', mobile: process.env.SUPERADMIN_MOBILE ?? '9000000000', type: 'superadmin', uniqueId: process.env.SUPERADMIN_UNIQUE_ID ?? 'GK00001', agentId: null };
      return { accessToken: await this.jwtService.signAsync({ sub: user.id, mobile: user.mobile, type: user.type, uniqueId: user.uniqueId, agentId: null }), user };
    }

    const user = this.users.find((item) => item.mobile === identifier || item.uniqueId === identifier);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Mobile, unique ID, or password is incorrect');
    }
    const safeUser = this.toResponse(user);
    return {
      accessToken: await this.jwtService.signAsync({ sub: user.id, mobile: user.mobile, type: user.type, uniqueId: user.uniqueId, agentId: user.type === UserType.AGENT ? user.uniqueId : user.agentId }),
      user: user.type === UserType.AGENT ? { ...safeUser, agentId: user.uniqueId } : safeUser,
    };
  }

  list(currentUser: AuthUser, type?: UserType, agentId?: string) {
    const visible = this.users.filter((user) => {
      if (currentUser.type === UserType.AGENT) return user.type === UserType.USER && user.agentId === currentUser.uniqueId;
      if (currentUser.type === UserType.USER) return user.id === currentUser.id;
      return (!type || user.type === type) && (!agentId || user.agentId === agentId);
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
    const password = this.passwordService.generateRandomPassword();
    const passwordHash = await this.passwordService.hashPassword(password);
    const user: MemoryUser = { id: Math.max(0, ...this.users.map((item) => item.id)) + 1, name: request.name, mobile: request.mobile, type, agentId: normalizedAgentId, uniqueId, password, passwordHash, createdAt: new Date() };
    this.users.unshift(user);
    return { user: this.toResponse(user), credentials: { password } };
  }

  getById(id: number, currentUser: AuthUser) {
    const user = this.users.find((item) => item.id === id);
    if (!user) throw new NotFoundException('User not found');
    const allowed = currentUser.type === 'superadmin' || currentUser.type === 'admin' || (currentUser.type === UserType.AGENT && user.type === UserType.AGENT && user.id === currentUser.id) || (currentUser.type === UserType.AGENT && user.type === UserType.USER && user.agentId === (currentUser.agentId ?? currentUser.uniqueId)) || (currentUser.type === UserType.USER && user.id === currentUser.id);
    if (!allowed) throw new ForbiddenException('You are not authorized to view this user');
    return this.toResponse(user);
  }

  update(id: number, changes: { name?: string; mobile?: string }, currentUser: AuthUser) {
    const user = this.users.find((item) => item.id === id);
    if (!user) throw new NotFoundException('User not found');
    const admin = currentUser.type === 'superadmin' || currentUser.type === 'admin';
    const self = currentUser.id === user.id &&
      (currentUser.type === user.type);
    const assigned = currentUser.type === UserType.AGENT &&
      user.type === UserType.USER &&
      user.agentId === (currentUser.agentId ?? currentUser.uniqueId);
    if (!admin && !self && !assigned) {
      throw new ForbiddenException('You are not authorized to edit this user');
    }
    if (changes.mobile && changes.mobile !== user.mobile &&
        this.users.some((item) => item.mobile === changes.mobile)) {
      throw new ConflictException('Mobile number is already registered');
    }
    if (changes.name !== undefined) user.name = changes.name;
    if (changes.mobile !== undefined) user.mobile = changes.mobile;
    return this.toResponse(user);
  }

  remove(id: number, currentUser: AuthUser): void {
    const index = this.users.findIndex((item) => item.id === id);
    if (index < 0) throw new NotFoundException('User not found');
    const user = this.users[index];
    const admin = currentUser.type === 'superadmin' || currentUser.type === 'admin';
    const assigned = currentUser.type === UserType.AGENT &&
      user.type === UserType.USER &&
      user.agentId === (currentUser.agentId ?? currentUser.uniqueId);
    if (!admin && !assigned) {
      throw new ForbiddenException('You are not authorized to delete this user');
    }
    if (admin && user.type === UserType.AGENT &&
        this.users.some((item) => item.type === UserType.USER && item.agentId === user.uniqueId)) {
      throw new ConflictException('Reassign or delete this agent’s users before deleting the agent');
    }
    this.users.splice(index, 1);
  }

  private async addSample(name: string, mobile: string, type: UserType, agentId: string | null, uniqueId: string, password: string): Promise<void> {
    const passwordHash = await this.passwordService.hashPassword(password);
    this.users.push({ id: this.users.length + 1, name, mobile, type, agentId, uniqueId, password, passwordHash, createdAt: new Date() });
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

  private randomDigits(length: number): string {
    return Array.from({ length }, () => randomInt(10)).join('');
  }

}
