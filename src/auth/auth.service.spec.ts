import { Test, TestingModule } from '@nestjs/testing';
import { jest } from '@jest/globals';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { User } from '../users/entities/user.entity';
import { LoginAudit } from './entities/login-audit.entity';
import { SystemCredential } from './entities/system-credential.entity';
import { PasswordService } from './password.service';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: { createQueryBuilder: jest.Mock };
  let systemCredentialRepository: {
    findOne: jest.Mock;
    save: jest.Mock;
  };
  let loginAuditRepository: { save: jest.Mock };

  beforeEach(async () => {
    systemCredentialRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
    };
    loginAuditRepository = { save: jest.fn() };
    userRepository = { createQueryBuilder: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        PasswordService,
        {
          provide: getRepositoryToken(User),
          useValue: userRepository,
        },
        {
          provide: getRepositoryToken(SystemCredential),
          useValue: systemCredentialRepository,
        },
        {
          provide: getRepositoryToken(LoginAudit),
          useValue: loginAuditRepository,
        },
        {
          provide: JwtService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('stores the initial superadmin password as a bcrypt hash', async () => {
    const previousIdentifier = process.env.SUPERADMIN_IDENTIFIER;
    const previousPassword = process.env.SUPERADMIN_PASSWORD;
    process.env.SUPERADMIN_IDENTIFIER = 'superadmin';
    process.env.SUPERADMIN_PASSWORD = 'test-superadmin-password';
    systemCredentialRepository.findOne.mockResolvedValue(null);
    systemCredentialRepository.save.mockImplementation(async (value) => value);

    try {
      await service.onModuleInit();

      const savedCredential =
        systemCredentialRepository.save.mock.calls[0][0];
      expect(savedCredential).toMatchObject({
        credentialName: 'superadmin',
        isActive: true,
      });
      expect(savedCredential.passwordHash).not.toBe(
        'test-superadmin-password',
      );
      await expect(
        bcrypt.compare(
          'test-superadmin-password',
          savedCredential.passwordHash,
        ),
      ).resolves.toBe(true);
    } finally {
      if (previousIdentifier === undefined) {
        delete process.env.SUPERADMIN_IDENTIFIER;
      } else {
        process.env.SUPERADMIN_IDENTIFIER = previousIdentifier;
      }
      if (previousPassword === undefined) {
        delete process.env.SUPERADMIN_PASSWORD;
      } else {
        process.env.SUPERADMIN_PASSWORD = previousPassword;
      }
    }
  });

  it('does not overwrite an existing superadmin database credential', async () => {
    const previousIdentifier = process.env.SUPERADMIN_IDENTIFIER;
    const previousPassword = process.env.SUPERADMIN_PASSWORD;
    process.env.SUPERADMIN_IDENTIFIER = 'superadmin';
    process.env.SUPERADMIN_PASSWORD = 'new-environment-password';
    systemCredentialRepository.findOne.mockResolvedValue({
      credentialName: 'superadmin',
      passwordHash: 'existing-database-hash',
      isActive: true,
    });

    try {
      await service.onModuleInit();
      expect(systemCredentialRepository.save).not.toHaveBeenCalled();
    } finally {
      if (previousIdentifier === undefined) {
        delete process.env.SUPERADMIN_IDENTIFIER;
      } else {
        process.env.SUPERADMIN_IDENTIFIER = previousIdentifier;
      }
      if (previousPassword === undefined) {
        delete process.env.SUPERADMIN_PASSWORD;
      } else {
        process.env.SUPERADMIN_PASSWORD = previousPassword;
      }
    }
  });

  it('does not allow superadmin login from the environment when no DB row exists', async () => {
    const previousIdentifier = process.env.SUPERADMIN_IDENTIFIER;
    const previousPassword = process.env.SUPERADMIN_PASSWORD;
    process.env.SUPERADMIN_IDENTIFIER = 'superadmin';
    process.env.SUPERADMIN_PASSWORD = 'environment-password';
    systemCredentialRepository.findOne.mockResolvedValue(null);
    loginAuditRepository.save.mockResolvedValue(undefined);

    try {
      await expect(
        service.login({
          identifier: 'superadmin',
          password: 'environment-password',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    } finally {
      if (previousIdentifier === undefined) {
        delete process.env.SUPERADMIN_IDENTIFIER;
      } else {
        process.env.SUPERADMIN_IDENTIFIER = previousIdentifier;
      }
      if (previousPassword === undefined) {
        delete process.env.SUPERADMIN_PASSWORD;
      } else {
        process.env.SUPERADMIN_PASSWORD = previousPassword;
      }
    }
  });

  it('authenticates a generated user credential by comparing the stored bcrypt hash', async () => {
    const previousIdentifier = process.env.SUPERADMIN_IDENTIFIER;
    process.env.SUPERADMIN_IDENTIFIER = 'master-account';
    const password = '5A71k2';
    const passwordHash = await bcrypt.hash(password, 4);
    const user = {
      id: 12,
      name: 'Credential User',
      mobile: '9876543212',
      type: 'user',
      agentId: 5,
      uniqueId: 'GK00123456',
      passwordHash,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const queryBuilder = {
      addSelect: jest.fn(),
      where: jest.fn(),
      andWhere: jest.fn(),
      getOne: jest.fn().mockResolvedValue(user),
    };
    queryBuilder.addSelect.mockReturnValue(queryBuilder);
    queryBuilder.where.mockReturnValue(queryBuilder);
    queryBuilder.andWhere.mockReturnValue(queryBuilder);
    userRepository.createQueryBuilder.mockReturnValue(queryBuilder);
    loginAuditRepository.save.mockResolvedValue(undefined);
    const signAsync = jest.fn().mockResolvedValue('signed-token');
    (service as any).jwtService.signAsync = signAsync;

    try {
      const result = await service.login({ identifier: 'GK00123456', password });
      expect(result.accessToken).toBe('signed-token');
      expect(result.user.uniqueId).toBe('GK00123456');
      expect(queryBuilder.addSelect).toHaveBeenCalledWith(['user.passwordHash']);
      expect(signAsync).toHaveBeenCalled();
      expect(loginAuditRepository.save).toHaveBeenCalledWith(expect.objectContaining({ loginStatus: 'SUCCESS' }));
    } finally {
      if (previousIdentifier === undefined) delete process.env.SUPERADMIN_IDENTIFIER;
      else process.env.SUPERADMIN_IDENTIFIER = previousIdentifier;
    }
  });
});
