import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { jest } from '@jest/globals';
import { ForbiddenException } from '@nestjs/common';

import { User } from '../users/entities/user.entity';
import { Wallet } from '../wallet/entities/wallet.entity';
import { WalletRequest } from '../wallet/entities/wallet.request.entity';
import { Transaction } from './entities/transcation.entity';
import { TranscationService } from './transcation.service';

describe('TranscationService', () => {
  let service: TranscationService;

  const mockTransactionRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockWalletRepository = {
    findOne: jest.fn(),
  };

  const mockUserRepository = {
    findOne: jest.fn(),
  };

  const mockWalletRequestRepository = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TranscationService,
        {
          provide: getRepositoryToken(Transaction),
          useValue: mockTransactionRepository,
        },
        {
          provide: getRepositoryToken(Wallet),
          useValue: mockWalletRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(WalletRequest),
          useValue: mockWalletRequestRepository,
        },
      ],
    }).compile();

    service = module.get<TranscationService>(TranscationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('allows users to read their own transactions', async () => {
    const user = { id: 42, type: 'user', agentId: 'AGENT001' };
    mockUserRepository.findOne.mockResolvedValue(user);
    mockTransactionRepository.find.mockResolvedValue([]);

    await expect(
      service.getTransactionsByUserId(42, {
        id: 42,
        type: 'user',
        uniqueId: 'USER001',
        mobile: '9000000000',
      }),
    ).resolves.toEqual([]);
    expect(mockTransactionRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 42 } }),
    );
  });

  it('prevents users from reading another users transactions', async () => {
    mockUserRepository.findOne.mockResolvedValue({
      id: 42,
      type: 'user',
      agentId: 'AGENT001',
    });

    await expect(
      service.getTransactionsByUserId(42, {
        id: 7,
        type: 'user',
        uniqueId: 'USER002',
        mobile: '9000000001',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(mockTransactionRepository.find).not.toHaveBeenCalled();
  });
});
