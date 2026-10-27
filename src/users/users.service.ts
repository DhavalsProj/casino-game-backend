
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { randomInt } from 'node:crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';

import { User, UserType } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { toUserResponse, UserResponse } from './user-response';
import type { AuthUser } from '../auth/auth-user';
import { PasswordService } from '../auth/password.service';
import { SystemCredential } from '../auth/entities/system-credential.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(SystemCredential)
    private readonly systemCredentialRepository: Repository<SystemCredential>,
    private readonly passwordService: PasswordService,
  ) {}

  async create(createUserDto: CreateUserDto, currentUser: AuthUser) {
    const type =
      currentUser.type === UserType.AGENT
        ? UserType.USER
        : createUserDto.type ?? UserType.USER;

    if (
      type === UserType.AGENT &&
      currentUser.type !== 'superadmin' &&
      currentUser.type !== 'admin'
    ) {
      throw new ForbiddenException(
        'Only admins can create agents',
      );
    }

    const requestedAgentUniqueId =
      currentUser.type === UserType.AGENT
        ? currentUser.uniqueId
        : createUserDto.agentId;

    // Check whether mobile number is already registered
    const existingUser = await this.userRepository.findOne({
      where: [
        { mobile: createUserDto.mobile },
        { uniqueId: createUserDto.mobile },
      ],
    });

    if (existingUser) {
      throw new ConflictException('User already registered');
    }

    // Validate agent for USER type and keep its database ID for ownership.
    let requestedAgent: User | null = null;
    if (type === UserType.USER) {
      if (!requestedAgentUniqueId) {
        throw new NotFoundException(
          'Agent ID is required for user type',
        );
      }

      requestedAgent = currentUser.type === UserType.AGENT
        ? await this.userRepository.findOne({ where: { id: currentUser.id, type: UserType.AGENT } })
        : createUserDto.agentId
          ? await this.userRepository.findOne({ where: { id: createUserDto.agentId, type: UserType.AGENT } })
          : null;

      if (!requestedAgent) {
        throw new NotFoundException('Agent not found');
      }
    }

    // Generate unique identifier
    let uniqueId: string;

    if (type === UserType.USER) {
      uniqueId = await this.generateUniqueValue(() => this.generateUserId(), 'uniqueId');
    } else {
      uniqueId = await this.generateUniqueValue(
        () => this.generateAgentId(),
        'uniqueId',
      );
    }

    // Generate and hash password
    const password = this.passwordService.generateRandomPassword();
    const passwordHash = await this.passwordService.hashPassword(password);

    // Create user
    let savedUser: User | null = null;
    for (let attempt = 0; attempt < 20; attempt++) {
      const user = this.userRepository.create({
        name: createUserDto.name,
        mobile: createUserDto.mobile,
        type,
        agentId: requestedAgent?.id ?? null,
        uniqueId: attempt === 0 ? uniqueId : this.generateUserIdForType(type),
        passwordHash,
        isActive: true,
      });
      try {
        savedUser = await this.userRepository.save(user);
        break;
      } catch (error) {
        const databaseError = error as { code?: string; driverError?: { code?: string; constraint?: string } };
        const code = databaseError.driverError?.code ?? databaseError.code;
        const constraint = databaseError.driverError?.constraint ?? '';
        if (code !== '23505') throw error;
        if (/mobile/i.test(constraint)) throw new ConflictException('Mobile number is already registered');
        const duplicateMobile = await this.userRepository.findOne({ where: { mobile: createUserDto.mobile } });
        if (duplicateMobile) throw new ConflictException('Mobile number is already registered');
        if (attempt === 19) throw new ConflictException('Could not generate a unique user identifier');
      }
    }
    if (!savedUser) throw new ConflictException('Could not create the user');

    return {
      user: toUserResponse(savedUser),
      credentials: {
        password,
      },
    };
  }

  async findAll(
    currentUser: AuthUser,
    type?: UserType,
    agentId?: string,
  ): Promise<UserResponse[]> {
    let where: FindOptionsWhere<User> = {};

    if (currentUser.type === UserType.AGENT) {
      const assignedAgentId = this.getAgentScopeId(currentUser);
      if (!assignedAgentId) {
        throw new ForbiddenException('Agent identifier is missing');
      }
      where = {
        type: UserType.USER,
        agentId: assignedAgentId,
      };
    } else if (currentUser.type === UserType.USER) {
      where = { id: currentUser.id };
    } else {
      if (type) {
        where.type = type;
      }
      if (agentId) {
        const parsedAgentId = Number(agentId);
        if (Number.isSafeInteger(parsedAgentId) && parsedAgentId > 0) where.agentId = parsedAgentId;
      }
    }

    const users = await this.userRepository.find({ where });

    const agents = await this.userRepository.find({
      where: {
        type: UserType.AGENT,
      },
    });

    const agentNames = new Map(
      agents.map((agent) => [agent.id, agent.name]),
    );

    return users
      .filter((user) => user.type !== UserType.SUPERADMIN)
      .map((user) =>
        toUserResponse(
          user,
          user.agentId !== null
            ? agentNames.get(user.agentId) ?? null
            : null,
        ),
      );
  }

  async findAgents(
    currentUser: AuthUser,
  ): Promise<UserResponse[]> {
    if (
      currentUser.type !== 'superadmin' &&
      currentUser.type !== 'admin'
    ) {
      throw new ForbiddenException(
        'Only admins can list agents',
      );
    }

    const agents = await this.userRepository.find({
      where: {
        type: UserType.AGENT,
      },
    });

    return agents.map((agent) => toUserResponse(agent));
  }

  async findOne(
    id: number,
    currentUser: AuthUser,
  ): Promise<UserResponse> {
    if (id === 0 && currentUser.type === 'superadmin') {
      const credential = await this.getSuperAdminCredential();
      return this.superAdminProfile(credential);
    }
    const user = await this.userRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const canView =
      currentUser.type === 'superadmin' ||
      currentUser.type === 'admin' ||
      (
        currentUser.type === UserType.AGENT &&
        user.type === UserType.AGENT &&
        user.id === currentUser.id
      ) ||
      (
        currentUser.type === UserType.AGENT &&
        user.type === UserType.USER &&
        user.agentId === this.getAgentScopeId(currentUser)
      ) ||
      (
        currentUser.type === UserType.USER &&
        user.id === currentUser.id
      );

    if (!canView) {
      throw new ForbiddenException(
        'You are not authorized to view this user',
      );
    }

    return toUserResponse(user);
  }

  async update(
    id: number,
    changes: { name?: string; mobile?: string; agentId?: number | null },
    currentUser: AuthUser,
  ): Promise<UserResponse> {
    if (id === 0 && currentUser.type === 'superadmin') {
      const credential = await this.getSuperAdminCredential();
      if (changes.mobile && changes.mobile !== (credential.profileMobile ?? process.env.SUPERADMIN_MOBILE ?? '9000000000')) {
        const duplicate = await this.userRepository.findOne({ where: { mobile: changes.mobile } });
        if (duplicate) throw new ConflictException('Mobile number is already registered');
      }
      if (changes.name !== undefined) credential.profileName = changes.name;
      if (changes.mobile !== undefined) credential.profileMobile = changes.mobile;
      await this.systemCredentialRepository.save(credential);
      return this.superAdminProfile(credential);
    }
    const user = await this.userRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    this.assertCanManageUser(user, currentUser, 'edit');

    const isAdministrator = currentUser.type === 'superadmin' || currentUser.type === 'admin';
    const updateChanges: { name?: string; mobile?: string; agentId?: number | null } = {
      name: changes.name,
      mobile: changes.mobile,
    };

    if (changes.agentId !== undefined) {
      if (!isAdministrator || user.type !== UserType.USER) {
        throw new ForbiddenException('Only admins can reassign users to an agent');
      }

      const agentId = changes.agentId ?? null;
      if (agentId) {
        const agent = await this.userRepository.findOne({
          where: { id: agentId, type: UserType.AGENT },
        });
        if (!agent) throw new NotFoundException('Agent not found');
      }
      updateChanges.agentId = agentId;
    }

    if (changes.mobile && changes.mobile !== user.mobile) {
      const duplicate = await this.userRepository.findOne({
        where: {
          mobile: changes.mobile,
        },
      });

      if (duplicate) {
        throw new ConflictException(
          'Mobile number is already registered',
        );
      }
    }

    Object.assign(user, updateChanges);

    const criteria: FindOptionsWhere<User> = isAdministrator
      ? { id }
      : currentUser.type === UserType.AGENT && user.type === UserType.USER
        ? { id, type: UserType.USER, agentId: this.getAgentScopeId(currentUser) }
        : { id, type: user.type };
    const result = await this.userRepository.update(criteria, updateChanges);
    if (!result.affected) throw new NotFoundException('User not found');

    const savedUser = await this.userRepository.findOne({ where: { id } });
    if (!savedUser) throw new NotFoundException('User not found');
    return toUserResponse(savedUser);
  }

  private async getSuperAdminCredential(): Promise<SystemCredential> {
    const credential = await this.systemCredentialRepository.findOne({
      where: { credentialName: process.env.SUPERADMIN_IDENTIFIER ?? 'superadmin', isActive: true },
    });
    if (!credential) throw new NotFoundException('Superadmin credential not found');
    return credential;
  }

  private superAdminProfile(credential: SystemCredential): UserResponse {
    return {
      id: 0,
      name: credential.profileName ?? 'Super Admin',
      mobile: credential.profileMobile ?? process.env.SUPERADMIN_MOBILE ?? '9000000000',
      type: 'superadmin',
      agentId: null,
      agentName: null,
      uniqueId: process.env.SUPERADMIN_UNIQUE_ID ?? 'GK00001',
      isActive: true,
      createdAt: credential.createdAt,
      updatedAt: credential.updatedAt,
    };
  }

  async remove(
    id: number,
    currentUser: AuthUser,
  ): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    this.assertCanManageUser(user, currentUser, 'delete');

    const isAdministrator = currentUser.type === 'superadmin' || currentUser.type === 'admin';
    if (isAdministrator && user.type === UserType.AGENT) {
      const assignedUsers = await this.userRepository.count({
        where: { type: UserType.USER, agentId: user.id },
      });
      if (assignedUsers > 0) {
        throw new ConflictException('Reassign or delete this agent’s users before deleting the agent');
      }
    }
    const criteria: FindOptionsWhere<User> = isAdministrator
      ? { id }
      : { id, type: UserType.USER, agentId: this.getAgentScopeId(currentUser) };
    const result = await this.userRepository.delete(criteria);

    if (!result.affected) {
      throw new NotFoundException('User not found');
    }
  }

  async getAllAgents(): Promise<User[]> {
    return this.userRepository.find({
      where: {
        type: UserType.AGENT,
      },
    });
  }

  private getAgentScopeId(currentUser: AuthUser): number {
    const agentId = currentUser.type === UserType.AGENT ? currentUser.id : currentUser.agentId;
    if (!agentId) throw new ForbiddenException('Agent identifier is missing');
    return agentId;
  }

  private assertCanManageUser(
    user: User,
    currentUser: AuthUser,
    action: 'edit' | 'delete',
  ): void {
    const isAdmin =
      currentUser.type === 'superadmin' || currentUser.type === 'admin';
    const isAssignedAgent =
      currentUser.type === UserType.AGENT &&
      user.type === UserType.USER &&
      !!this.getAgentScopeId(currentUser) &&
      user.agentId === this.getAgentScopeId(currentUser);

    const isAgentSelf =
      action === 'edit' &&
      currentUser.type === UserType.AGENT &&
      user.type === UserType.AGENT &&
      user.id === currentUser.id;
    const isUserSelf =
      action === 'edit' &&
      currentUser.type === UserType.USER &&
      user.type === UserType.USER &&
      user.id === currentUser.id;

    if (!isAdmin && !isAssignedAgent && !isAgentSelf && !isUserSelf) {
      throw new ForbiddenException(
        `You are not authorized to ${action} this user`,
      );
    }
  }

  private async generateUniqueValue(
    generator: () => string,
    field: 'uniqueId',
  ): Promise<string> {
    for (let attempt = 0; attempt < 20; attempt++) {
      const value = generator();

      const existing = await this.userRepository.findOne({
        where: {
          [field]: value,
        },
      });

      if (!existing) {
        return value;
      }
    }

    throw new ConflictException(
      'Could not generate a unique user identifier',
    );
  }

  private generateAgentId(): string {
    return `GK00${this.generateRandomDigits(6)}`;
  }

  private generateUserIdForType(type: UserType): string {
    return type === UserType.AGENT ? this.generateAgentId() : this.generateUserId();
  }

  private generateUserId(): string {
    return `GK00${this.generateRandomDigits(6)}`;
  }

  private generateRandomDigits(length: number): string {
    let result = '';

    for (let i = 0; i < length; i++) {
      result += randomInt(10);
    }

    return result;
  }
}
