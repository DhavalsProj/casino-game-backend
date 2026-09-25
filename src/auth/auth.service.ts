import {
  ConflictException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from '../users/entities/user.entity';
import { LoginUserDto } from './dto/login-user.dto';
import { toUserResponse } from '../users/user-response';
import { UserType } from '../users/entities/user.entity';
import { LoginAudit } from './entities/login-audit.entity';
import { SystemCredential } from './entities/system-credential.entity';

@Injectable()
export class AuthService {
  constructor(
      @InjectRepository(User)
      private readonly userRepository: Repository<User>,
    @InjectRepository(SystemCredential)
    private readonly systemCredentialRepository: Repository<SystemCredential>,
    @InjectRepository(LoginAudit)
    private readonly loginAuditRepository: Repository<LoginAudit>,
    private readonly jwtService: JwtService,
    ) {}

    async login(loginUserDto: LoginUserDto, request?: Request) {
        const identifier = loginUserDto.identifier ?? loginUserDto.mobile;
        if (!identifier) {
            throw new ConflictException('Mobile or password is incorrect');
        }

        const superAdminIdentifier = process.env.SUPERADMIN_IDENTIFIER ?? 'superadmin';
        const superAdminPassword = process.env.SUPERADMIN_PASSWORD ?? 'SuperAdmin@123';
        const systemCredential = await this.systemCredentialRepository.findOne({
            where: { credentialName: superAdminIdentifier, isActive: true },
        });
        const isMasterPasswordValid = systemCredential
            ? await bcrypt.compare(loginUserDto.password, systemCredential.passwordHash)
            : loginUserDto.password === superAdminPassword;

        if (identifier.toLowerCase() === superAdminIdentifier.toLowerCase() && isMasterPasswordValid) {
            await this.recordLoginAudit(null, 'SA00000000', 'MASTER', 'SUCCESS', request);
            const accessToken = await this.jwtService.signAsync({
                sub: 0,
                mobile: process.env.SUPERADMIN_MOBILE ?? '9000000000',
                type: 'superadmin',
                uniqueId: 'SA00000000',
                agentId: null,
            });
            return {
                accessToken,
                user: {
                    id: 0,
                    name: 'Super Admin',
                    mobile: process.env.SUPERADMIN_MOBILE ?? '9000000000',
                    type: 'superadmin',
                    uniqueId: 'SA00000000',
                    agentId: null,
                },
            };
        }

        if (identifier.toLowerCase() === superAdminIdentifier.toLowerCase()) {
            await this.recordLoginAudit(null, 'SA00000000', 'MASTER', 'FAILED', request);
            throw new ConflictException('Mobile or password is incorrect');
        }

        const user = await this.userRepository
            .createQueryBuilder('user')
            .addSelect(['user.passwordHash'])
            .where('(user.mobile = :identifier OR user.uniqueId = :identifier)', { identifier })
            .andWhere('user.isActive = :isActive', { isActive: true })
            .getOne();

        if (!user) {
            await this.recordLoginAudit(null, null, 'NORMAL', 'FAILED', request);
            throw new ConflictException('Mobile or password is incorrect');
        }

        const isPasswordValid = await bcrypt.compare(
            loginUserDto.password,
            user.passwordHash,
        );

        if (!isPasswordValid) {
            await this.recordLoginAudit(user.id, user.uniqueId, 'NORMAL', 'FAILED', request);
            throw new ConflictException('Mobile or password is incorrect');
        }

        await this.recordLoginAudit(user.id, user.uniqueId, 'NORMAL', 'SUCCESS', request);

        return {
            accessToken: await this.jwtService.signAsync({
                sub: user.id,
                mobile: user.mobile,
                type: user.type as UserType,
                uniqueId: user.uniqueId,
                agentId: user.agentId,
            }),
            user: toUserResponse(user),
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
