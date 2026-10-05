
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import * as bcrypt from 'bcrypt';
import { randomInt } from 'node:crypto';

import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';

import { User, UserType } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { toUserResponse, UserResponse } from './user-response';
import type { AuthUser } from '../auth/auth-user';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto, currentUser: AuthUser) {
    const type =
      currentUser.type === UserType.AGENT
        ? UserType.USER
        : createUserDto.type;

    if (
      type === UserType.AGENT &&
      currentUser.type !== 'superadmin' &&
      currentUser.type !== 'admin'
    ) {
      throw new ForbiddenException(
        'Only admins can create agents',
      );
    }

    const requestedAgentId =
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

    // Validate agent for USER type
    if (type === UserType.USER) {
      if (!requestedAgentId) {
        throw new NotFoundException(
          'Agent ID is required for user type',
        );
      }

      const agent = await this.userRepository.findOne({
        where: {
          uniqueId: requestedAgentId,
          type: UserType.AGENT,
        },
      });

      if (!agent) {
        throw new NotFoundException('Agent not found');
      }
    }

    // Generate unique identifier
    let uniqueId: string;

    if (type === UserType.USER) {
      uniqueId = await this.generateUniqueValue(
        () => this.generateUserId(requestedAgentId!),
        'uniqueId',
      );
    } else {
      uniqueId = await this.generateUniqueValue(
        () => this.generateAgentId(),
        'uniqueId',
      );
    }

    // Generate and hash password
    const password = this.generatePassword();

    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = this.userRepository.create({
      name: createUserDto.name,
      mobile: createUserDto.mobile,
      type,
      agentId: requestedAgentId ?? null,
      uniqueId,
      password: password,
      passwordHash: hashedPassword,
      isActive: true,
    });

    const savedUser = await this.userRepository.save(user);

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
  ): Promise<UserResponse[]> {
    let where: FindOptionsWhere<User> = {};

    if (currentUser.type === UserType.AGENT) {
      const agentId = currentUser.uniqueId;
      if (!agentId) {
        throw new ForbiddenException('Agent identifier is missing');
      }
      where = {
        type: UserType.USER,
        agentId,
      };
    } else if (currentUser.type === UserType.USER) {
      where = { id: currentUser.id };
    } else if (type) {
      where = { type };
    }

    const users = await this.userRepository.find({ where });

    const agents = await this.userRepository.find({
      where: {
        type: UserType.AGENT,
      },
    });

    const agentNames = new Map(
      agents.map((agent) => [agent.uniqueId, agent.name]),
    );

    return users
      .filter((user) => user.type !== UserType.SUPERADMIN)
      .map((user) =>
        toUserResponse(
          user,
          user.agentId
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
        user.type === UserType.USER &&
        user.agentId === currentUser.uniqueId
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
    changes: { name?: string; mobile?: string },
    currentUser: AuthUser,
  ): Promise<UserResponse> {
    if (
      currentUser.type !== 'superadmin' &&
      currentUser.type !== 'admin'
    ) {
      throw new ForbiddenException(
        'Only admins can edit users',
      );
    }

    const user = await this.userRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
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

    Object.assign(user, changes);

    const savedUser = await this.userRepository.save(user);

    return toUserResponse(savedUser);
  }

  async remove(
    id: number,
    currentUser: AuthUser,
  ): Promise<void> {
    if (
      currentUser.type !== 'superadmin' &&
      currentUser.type !== 'admin'
    ) {
      throw new ForbiddenException(
        'Only admins can delete users',
      );
    }

    const result = await this.userRepository.delete(id);

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

  private generateUserId(agentId: string): string {
    const prefix = agentId.substring(0, 7);
    const randomNumber = 100 + randomInt(900);

    return `${prefix}${randomNumber}`;
  }

  private generatePassword(): string {
    const digits = this.generateRandomDigits(4);

    const upper = String.fromCharCode(65 + randomInt(26));
    const lower = String.fromCharCode(97 + randomInt(26));

    const password = digits + upper + lower;

    return password
      .split('')
      .sort(() => randomInt(3) - 1)
      .join('');
  }

  private generateRandomDigits(length: number): string {
    let result = '';

    for (let i = 0; i < length; i++) {
      result += randomInt(10);
    }

    return result;
  }
}