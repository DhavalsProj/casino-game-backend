import { Test, TestingModule } from '@nestjs/testing';
import { jest } from '@jest/globals';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import { User, UserType } from './entities/user.entity';

describe('UsersService', () => {
  let service: UsersService;
  let userRepository: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
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
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: userRepository,
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
      'GK0012345',
    );

    expect(userRepository.find).toHaveBeenNthCalledWith(1, {
      where: {
        type: UserType.USER,
        agentId: 'GK0012345',
      },
    });
  });

  it('does not let agent filtering override the logged-in agent scope', async () => {
    userRepository.find.mockResolvedValue([]);

    await service.findAll(
      { type: UserType.AGENT, uniqueId: 'GK0000001' } as any,
      undefined,
      'OTHER0001',
    );

    expect(userRepository.find).toHaveBeenNthCalledWith(1, {
      where: {
        type: UserType.USER,
        agentId: 'GK0000001',
      },
    });
  });

  it('returns the generated password without persisting it', async () => {
    const result = await service.create(
      {
        name: 'Test Agent',
        mobile: '9876543210',
        type: UserType.AGENT,
      },
      { type: 'superadmin' } as any,
    );
    const persistedUser = userRepository.create.mock.calls[0][0];

    expect(persistedUser).not.toHaveProperty('password');
    expect(persistedUser.passwordHash).not.toBe(result.credentials.password);
    await expect(
      bcrypt.compare(result.credentials.password, persistedUser.passwordHash),
    ).resolves.toBe(true);
  });
});
