
import {
  Injectable,
  UnauthorizedException,
  OnModuleInit,
} from '@nestjs/common';

import type { Request } from 'express';
import * as bcrypt from 'bcrypt';

import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User, UserType } from '../users/entities/user.entity';
import { LoginUserDto } from './dto/login-user.dto';
import { toUserResponse } from '../users/user-response';

import { LoginAudit } from './entities/login-audit.entity';
import { SystemCredential } from './entities/system-credential.entity';
import { PasswordService } from './password.service';

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(SystemCredential)
    private readonly systemCredentialRepository: Repository<SystemCredential>,

    @InjectRepository(LoginAudit)
    private readonly loginAuditRepository: Repository<LoginAudit>,

    private readonly jwtService: JwtService,
    private readonly passwordService: PasswordService,
  ) {}

  async onModuleInit(): Promise<void> {
    const credentialName =
      process.env.SUPERADMIN_IDENTIFIER ?? 'superadmin';
    const existingCredential =
      await this.systemCredentialRepository.findOne({
        where: { credentialName },
      });

    if (existingCredential) {
      return;
    }

    const password = process.env.SUPERADMIN_PASSWORD;
    if (!password) {
      throw new Error(
        'SUPERADMIN_PASSWORD is required to initialize the superadmin database credential',
      );
    }

    await this.systemCredentialRepository.save({
      credentialName,
      passwordHash: await this.passwordService.hashPassword(password),
      isActive: true,
    });
  }

  async login(loginUserDto: LoginUserDto, request?: Request) {
    // Support mobile, identifier, and teammate's id-based login
    const identifier =
      loginUserDto.identifier ??
      loginUserDto.mobile ??
      loginUserDto.id;

    if (!identifier) {
      throw new UnauthorizedException('Mobile or password is incorrect');
    }

    // Super Admin configuration
    const superAdminIdentifier =
      process.env.SUPERADMIN_IDENTIFIER ?? 'superadmin';

    const superAdminUniqueId =
      process.env.SUPERADMIN_UNIQUE_ID ?? 'GK00001';
    const systemCredential =
      await this.systemCredentialRepository.findOne({
        where: {
          credentialName: superAdminIdentifier,
          isActive: true,
        },
      });

    const isMasterPasswordValid = systemCredential
      ? await bcrypt.compare(
          loginUserDto.password,
          systemCredential.passwordHash,
        )
      : false;

    // Super Admin login
    if (
      identifier.toLowerCase() ===
        superAdminIdentifier.toLowerCase() &&
      isMasterPasswordValid
    ) {
      await this.recordLoginAudit(
        null,
        superAdminUniqueId,
        'MASTER',
        'SUCCESS',
        request,
      );

      const accessToken = await this.jwtService.signAsync({
        sub: 0,
        mobile: process.env.SUPERADMIN_MOBILE ?? '9000000000',
        type: 'superadmin',
        uniqueId: superAdminUniqueId,
        agentId: null,
      });

      return {
        accessToken,
        user: {
          id: 0,
          name: 'Super Admin',
          mobile: process.env.SUPERADMIN_MOBILE ?? '9000000000',
          type: 'superadmin',
          uniqueId: superAdminUniqueId,
          agentId: null,
        },
      };
    }

    if (
      identifier.toLowerCase() ===
      superAdminIdentifier.toLowerCase()
    ) {
      await this.recordLoginAudit(
        null,
        superAdminUniqueId,
        'MASTER',
        'FAILED',
        request,
      );

      throw new UnauthorizedException(
        'Mobile or password is incorrect',
      );
    }

    // Find active user using mobile or unique ID
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect(['user.passwordHash'])
      .where(
        '(user.mobile = :identifier OR user.uniqueId = :identifier)',
        { identifier },
      )
      .andWhere('user.isActive = :isActive', {
        isActive: true,
      })
      .getOne();

    if (!user) {
      await this.recordLoginAudit(
        null,
        null,
        'NORMAL',
        'FAILED',
        request,
      );

      throw new UnauthorizedException(
        'Mobile or password is incorrect',
      );
    }

    // Validate password
    const isPasswordValid = await bcrypt.compare(
      loginUserDto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      await this.recordLoginAudit(
        user.id,
        user.uniqueId,
        'NORMAL',
        'FAILED',
        request,
      );

      throw new UnauthorizedException(
        'Mobile or password is incorrect',
      );
    }

    // Record successful login
    await this.recordLoginAudit(
      user.id,
      user.uniqueId,
      'NORMAL',
      'SUCCESS',
      request,
    );

    // Generate JWT token
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      mobile: user.mobile,
      type: user.type as UserType,
      uniqueId: user.uniqueId,
      agentId: user.type === UserType.AGENT ? user.uniqueId : user.agentId,
    });

    return {
      accessToken,
      user: {
        ...toUserResponse(user),
        agentId: user.type === UserType.AGENT ? user.uniqueId : user.agentId,
      },
    };
  }

  private async recordLoginAudit(
    userId: number | null,
    uniqueId: string | null,
    loginType: 'NORMAL' | 'MASTER',
    loginStatus: 'SUCCESS' | 'FAILED',
    request?: Request,
  ): Promise<void> {
    await this.loginAuditRepository.save({
      userId,
      uniqueId,
      loginType,
      loginStatus,
      ipAddress: request?.ip ?? null,
      userAgent: request?.get('user-agent') ?? null,
    });
  }
}
