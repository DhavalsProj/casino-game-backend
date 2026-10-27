
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
import type { AuthUser } from './auth-user';
import { ChangePasswordDto } from './dto/change-password.dto';

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
    const superAdminName = systemCredential?.profileName ?? 'Super Admin';
    const superAdminMobile = systemCredential?.profileMobile ?? process.env.SUPERADMIN_MOBILE ?? '9000000000';

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
        mobile: superAdminMobile,
        type: 'superadmin',
        uniqueId: superAdminUniqueId,
        agentId: null,
      });

      return {
        accessToken,
        user: {
          id: 0,
          name: superAdminName,
          mobile: superAdminMobile,
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
        '(user.mobile = :identifier OR LOWER(user.uniqueId) = LOWER(:identifier))',
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
    const isPasswordValid = user.passwordHash
      ? await bcrypt.compare(loginUserDto.password, user.passwordHash)
      : false;

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
    const effectiveAgentId = user.type === UserType.AGENT ? user.id : user.agentId;
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      mobile: user.mobile,
      type: user.type as UserType,
      uniqueId: user.uniqueId,
      agentId: effectiveAgentId,
    });

    return {
      accessToken,
      user: {
        ...toUserResponse(user),
        agentId: effectiveAgentId,
      },
    };
  }

  async changePassword(currentUser: AuthUser, dto: ChangePasswordDto): Promise<{ message: string }> {
    if (currentUser.type === 'superadmin') {
      const credentialName = process.env.SUPERADMIN_IDENTIFIER ?? 'superadmin';
      const credential = await this.systemCredentialRepository.findOne({
        where: { credentialName, isActive: true },
      });
      if (!credential || !(await bcrypt.compare(dto.currentPassword, credential.passwordHash))) {
        throw new UnauthorizedException('Current password is incorrect');
      }
      credential.passwordHash = await this.passwordService.hashPassword(dto.newPassword);
      await this.systemCredentialRepository.save(credential);
      return { message: 'Password updated successfully' };
    }

    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id: currentUser.id })
      .andWhere('user.isActive = :active', { active: true })
      .getOne();
    if (!user || !user.passwordHash || !(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    user.passwordHash = await this.passwordService.hashPassword(dto.newPassword);
    await this.userRepository.save(user);
    return { message: 'Password updated successfully' };
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
