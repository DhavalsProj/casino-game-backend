import {
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const existingUser = await this.userRepository.findOne({
      where: {
        mobile: createUserDto.mobile,
      },
    });

    if (existingUser) {
      throw new ConflictException('User already registered');
    }

    if (createUserDto.type === 'user') {
      if (!createUserDto.agentId) {
        throw new NotFoundException('Agent ID is required for user type');
      }

    const agent = await this.userRepository.findOne({
      where: {
        uniqueId: createUserDto.agentId,
        type: 'agent',
      },
    });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }
  }

    let uniqueId: string;

  if (createUserDto.type === 'user') {
    uniqueId = await this.generateUniqueValue(
      () => this.generateUserId(createUserDto.agentId!),
      'uniqueId',
    );
  } else {
    uniqueId = await this.generateUniqueValue(
      () => this.generateAgentId(),
      'uniqueId',
    );
  }

    const password = await this.generateUniqueValue(
      () => this.generatePassword(),
      'password',
    );

    const pin = await this.generateUniqueValue(
      () => this.generatePin(),
      'pin',
    );

    const user = this.userRepository.create({
      name: createUserDto.name,
      mobile: createUserDto.mobile,
      type: createUserDto.type,
      uniqueId: uniqueId,
      password: password,
      pin: pin,
    });

    return this.userRepository.save(user);
  }

  async findAll(): Promise<User[]> {
    return this.userRepository.find();
  }
    
  async findOne(id: number) : Promise<User> {
    const user = await this.userRepository.findOne({where: { id }});

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      name: user.name,
      mobile: user.mobile,
      type: user.type,
      password: user.password,
      agentId: user.agentId,
      uniqueId: user.uniqueId,
      pin: user.pin,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private async generateUniqueValue(
    generator: () => string,
    field: 'uniqueId' | 'password' | 'pin',
  ): Promise<string> {
    let value: string;

    do {
      value = generator();

      const existing = await this.userRepository.findOne({
          where: {
          [field]: value,
        },
      });

      if (!existing) {
        return value;
      }
    } while (true);
  }

  private generateAgentId(): string {
    return `GK00${this.generateRandomDigits(6)}`;
  }

  private generateUserId(agentId: string): string {
    const prefix = agentId.substring(0, 7);

    const randomNumber = Math.floor(
     100 + Math.random() * 900,
   );

  return `${prefix}${randomNumber}`;
}

  private generatePassword(): string {
    const digits = this.generateRandomDigits(4);

    const upper =
      String.fromCharCode(65 + Math.floor(Math.random() * 26));

    const lower =
      String.fromCharCode(97 + Math.floor(Math.random() * 26));

    const password = digits + upper + lower;

    return password
      .split('')
      .sort(() => Math.random() - 0.5)
      .join('');
  }

  private generatePin(): string {
    return this.generateRandomDigits(4);
  }

  private generateRandomDigits(length: number): string {
    let result = '';

    for (let i = 0; i < length; i++) {
      result += Math.floor(Math.random() * 10);
    }

    return result;
  }  
}