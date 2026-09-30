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
    create: jest.Mock;
    save: jest.Mock;
  };

  beforeEach(async () => {
    userRepository = {
      findOne: jest.fn().mockResolvedValue(null),
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
