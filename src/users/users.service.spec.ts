import { Test, TestingModule } from '@nestjs/testing';
import { jest } from '@jest/globals';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import { User, UserType } from './entities/user.entity';
import { PasswordService } from '../auth/password.service';
import { SystemCredential } from '../auth/entities/system-credential.entity';

describe('UsersService', () => {
  let service: UsersService;
  let userRepository: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    count: jest.Mock;
  };

  beforeEach(async () => {
    userRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn(),
      create: jest.fn((user) => user),
      save: jest.fn(async (user) => ({
        ...user,
        id: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      count: jest.fn().mockResolvedValue(0),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        PasswordService,
        {
          provide: getRepositoryToken(User),
          useValue: userRepository,
        },
        {
          provide: getRepositoryToken(SystemCredential),
          useValue: { findOne: jest.fn(), save: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('does not include superadmin users in findAll results', async () => {
    const superadmin = {
      id: 1,
      name: 'Superadmin',
      mobile: '9876543210',
      type: UserType.SUPERADMIN,
      agentId: null,
      uniqueId: 'SUPERADMIN',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as User;
    const regularUser = {
      ...superadmin,
      id: 2,
      name: 'Regular user',
      type: UserType.USER,
      uniqueId: 'USER001',
    } as User;
    userRepository.find
      .mockResolvedValueOnce([superadmin, regularUser])
      .mockResolvedValueOnce([]);

    const users = await service.findAll({ type: 'superadmin' } as any);

    expect(users.map((user) => user.type)).toEqual([UserType.USER]);
  });

  it('filters admin user results by type and assigned agent ID', async () => {
    userRepository.find.mockResolvedValue([]);

    await service.findAll(
      { type: 'superadmin' } as any,
      UserType.USER,
      '5',
    );

    expect(userRepository.find).toHaveBeenNthCalledWith(1, {
      where: {
        type: UserType.USER,
        agentId: 5,
      },
    });
  });

  it('does not let agent filtering override the logged-in agent scope', async () => {
    userRepository.find.mockResolvedValue([]);

    await service.findAll(
      { id: 5, type: UserType.AGENT, uniqueId: 'GK0000001' } as any,
      undefined,
      'OTHER0001',
    );

    expect(userRepository.find).toHaveBeenNthCalledWith(1, {
      where: {
        type: UserType.USER,
        agentId: 5,
      },
    });
  });

  it('generates a unique GK00 identifier and stores only a matching bcrypt hash for an agent', async () => {
    const result = await service.create(
      {
        name: 'Test Agent',
        mobile: '9876543210',
        type: UserType.AGENT,
      },
      { type: 'superadmin' } as any,
    );
    const persistedUser = userRepository.create.mock.calls[0][0];

    expect(result.user.uniqueId).toMatch(/^GK00\d{6}$/);
    expect(persistedUser.uniqueId).toBe(result.user.uniqueId);
    expect(persistedUser).not.toHaveProperty('password');
    expect(persistedUser.passwordHash).not.toBe(result.credentials.password);
    await expect(
      bcrypt.compare(result.credentials.password, persistedUser.passwordHash),
    ).resolves.toBe(true);
    expect(result).not.toHaveProperty('passwordHash');
    expect(result).not.toHaveProperty('user.password');
  });

  it('persists the same generated-password format for an admin-created user', async () => {
    userRepository.findOne.mockImplementation(async ({ where }: any) => {
      if (!Array.isArray(where) && where?.type === UserType.AGENT && where?.id === 5) {
        return { id: 5, type: UserType.AGENT, uniqueId: 'GK00123456' };
      }
      return null;
    });

    const result = await service.create(
      { name: 'Child User', mobile: '9876543210', type: UserType.USER, agentId: 5 },
      { type: 'superadmin' } as any,
    );
    const persistedUser = userRepository.create.mock.calls[0][0];

    expect(result.user.uniqueId).toMatch(/^GK00\d{6}$/);
    expect(persistedUser).not.toHaveProperty('password');
    await expect(bcrypt.compare(result.credentials.password, persistedUser.passwordHash)).resolves.toBe(true);
  });

  it('retries a duplicate database identifier before saving a user', async () => {
    userRepository.findOne.mockImplementation(async ({ where }: any) => {
      if (!Array.isArray(where) && where?.type === UserType.AGENT && where?.id === 5) {
        return { id: 5, type: UserType.AGENT, uniqueId: 'GK00123456' };
      }
      return null;
    });
    userRepository.save
      .mockRejectedValueOnce({ driverError: { code: '23505', constraint: 'UQ_users_unique_id' } })
      .mockImplementationOnce(async (user) => ({ ...user, id: 7, createdAt: new Date(), updatedAt: new Date() }));
    jest.spyOn(service as any, 'generateUserId')
      .mockReturnValueOnce('GK00111111')
      .mockReturnValueOnce('GK00222222');

    const result = await service.create(
      { name: 'Retry User', mobile: '9876543212', type: UserType.USER, agentId: 5 },
      { type: 'admin' } as any,
    );

    expect(userRepository.save).toHaveBeenCalledTimes(2);
    expect(userRepository.create.mock.calls.map(([user]) => user.uniqueId)).toEqual([
      'GK00111111',
      'GK00222222',
    ]);
    expect(result.user.uniqueId).toBe('GK00222222');
  });

  it('forces an agent-created user to use the authenticated agent ownership and generated password', async () => {
    userRepository.findOne.mockImplementation(async ({ where }: any) => {
      if (!Array.isArray(where) && where?.type === UserType.AGENT && where?.id === 5) {
        return { id: 5, type: UserType.AGENT, uniqueId: 'GK00123456' };
      }
      return null;
    });

    const result = await service.create(
      { name: 'Child User', mobile: '9876543210', type: UserType.AGENT, agentId: 999 },
      { id: 5, type: UserType.AGENT, uniqueId: 'GK00123456', mobile: '9000000000' },
    );
    const persistedUser = userRepository.create.mock.calls[0][0];

    expect(persistedUser).toMatchObject({ type: UserType.USER, agentId: 5, uniqueId: expect.stringMatching(/^GK00\d{6}$/) });
    expect(persistedUser).not.toHaveProperty('password');
    await expect(bcrypt.compare(result.credentials.password, persistedUser.passwordHash)).resolves.toBe(true);
  });
  it('forces agent-created accounts to be users assigned to the authenticated agent', async () => {
    userRepository.findOne.mockImplementation(async ({ where }: any) => {
      if (!Array.isArray(where) && where?.type === UserType.AGENT && where?.id === 5) {
        return { id: 5, type: UserType.AGENT, uniqueId: 'GK00123456' };
      }
      return null;
    });

    await service.create(
      { name: 'Child User', mobile: '9876543210', type: UserType.AGENT, agentId: 999 },
      { id: 5, type: UserType.AGENT, uniqueId: 'GK00123456', mobile: '9000000000' },
    );

    expect(userRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      type: UserType.USER,
      agentId: 5,
    }));
  });

  it('updates only a user assigned to the authenticated agent', async () => {
    const ownedUser = { id: 42, type: UserType.USER, agentId: 5, name: 'Old', mobile: '9876543210' } as User;
    userRepository.findOne.mockResolvedValue(ownedUser);

    await service.update(42, { name: 'Updated' }, {
      id: 5, type: UserType.AGENT, uniqueId: 'GK00123456', agentId: 5, mobile: '9000000000',
    });

    expect(userRepository.update).toHaveBeenCalledWith(
      { id: 42, type: UserType.USER, agentId: 5 },
      { name: 'Updated' },
    );
  });

  it('rejects an agent update to another agent’s user', async () => {
    userRepository.findOne.mockResolvedValue({
      id: 42, type: UserType.USER, agentId: 77, name: 'Other', mobile: '9876543210',
    } as User);

    await expect(service.update(42, { name: 'Changed' }, {
      id: 5, type: UserType.AGENT, uniqueId: 'GK00123456', agentId: 5, mobile: '9000000000',
    })).rejects.toMatchObject({ status: 403 });
    expect(userRepository.update).not.toHaveBeenCalled();
  });

  it('deletes only users assigned to the authenticated agent', async () => {
    userRepository.findOne.mockResolvedValue({
      id: 42, type: UserType.USER, agentId: 5, name: 'Owned', mobile: '9876543210',
    } as User);

    await service.remove(42, {
      id: 5, type: UserType.AGENT, uniqueId: 'GK00123456', agentId: 5, mobile: '9000000000',
    });

    expect(userRepository.delete).toHaveBeenCalledWith({
      id: 42, type: UserType.USER, agentId: 5,
    });
  });
  it('prevents deleting an agent that still owns users', async () => {
    userRepository.findOne.mockResolvedValue({
      id: 5, type: UserType.AGENT, uniqueId: 'GK00123456',
    } as User);
    userRepository.count.mockResolvedValue(2);

    await expect(service.remove(5, { type: 'superadmin' } as any))
      .rejects.toMatchObject({ status: 409 });
    expect(userRepository.delete).not.toHaveBeenCalled();
  });
});
