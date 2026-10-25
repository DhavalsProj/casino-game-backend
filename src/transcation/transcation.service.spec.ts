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
    find: jest.fn(),
  };

  const mockWalletRequestRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockWalletRequestRepository.find.mockResolvedValue([]);

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

  it('includes rejected requests in transaction history without a ledger movement', async () => {
    const rejectedAt = new Date('2026-10-25T16:30:00.000Z');
    mockUserRepository.findOne.mockResolvedValue({ id: 42, type: 'user' });
    mockTransactionRepository.find.mockResolvedValue([]);
    mockWalletRequestRepository.find.mockResolvedValue([{
      id: 10,
      userId: 42,
      walletId: 4,
      type: 'WITHDRAW',
      amount: '522.00',
      status: 'REJECTED',
      createdAt: new Date('2026-10-25T15:00:00.000Z'),
      updatedAt: rejectedAt,
      actions: [{ action: 'REJECTED', balanceBefore: '0.00', balanceAfter: '0.00' }],
    }]);

    const history = await service.getTransactionsByUserId(42, {
      id: 42, type: 'user', uniqueId: 'USER001', mobile: '9000000000',
    });

    expect(history).toHaveLength(1);
    expect(history[0]).toEqual(expect.objectContaining({
      requestId: 10,
      status: 'REJECTED',
      recordType: 'WALLET_REQUEST',
      source: 'WALLET_REQUEST',
      amount: '522.00',
      balanceBefore: '0.00',
      balanceAfter: '0.00',
    }));
  });

  it('shows the accepted state on the associated credit ledger entry', async () => {
    mockUserRepository.findOne.mockResolvedValue({ id: 42, type: 'user' });
    mockTransactionRepository.find.mockResolvedValue([{
      id: 21, userId: 42, requestId: 11, amount: '898.00', type: 'CREDIT',
      createdAt: new Date('2026-10-25T16:00:00.000Z'),
      request: { id: 11, status: 'ACCEPTED' },
    }]);
    mockWalletRequestRepository.find.mockResolvedValue([{
      id: 11, userId: 42, walletId: 4, type: 'WITHDRAW', amount: '898.00', status: 'ACCEPTED',
    }]);

    const history = await service.getTransactionsByUserId(42, {
      id: 42, type: 'user', uniqueId: 'USER001', mobile: '9000000000',
    });

    expect(history).toHaveLength(1);
    expect(history[0]).toEqual(expect.objectContaining({ id: 21, status: 'ACCEPTED', recordType: 'WALLET_TRANSACTION' }));
  });

  it('returns assigned users transaction histories for an admin-selected agent', async () => {
    mockUserRepository.findOne.mockResolvedValue({ id: 7, type: 'agent', name: 'Agent' });
    mockUserRepository.find.mockResolvedValue([
      { id: 42, name: 'Player A', uniqueId: 'USER0001', type: 'user' },
      { id: 43, name: 'Player B', uniqueId: 'USER0002', type: 'user' },
    ]);
    mockTransactionRepository.find.mockResolvedValue([]);
    mockWalletRequestRepository.find.mockResolvedValue([{
      id: 15, userId: 43, walletId: 9, type: 'WITHDRAW', amount: '20.00', status: 'REJECTED',
      updatedAt: new Date(), createdAt: new Date(),
      actions: [{ action: 'REJECTED', balanceBefore: '30.00', balanceAfter: '30.00' }],
    }]);

    const history = await service.getTransactionsByAgentId(7, {
      id: 0, type: 'superadmin', uniqueId: 'GK00001', mobile: '9000000000',
    });

    expect(history).toHaveLength(1);
    expect(history[0]).toEqual(expect.objectContaining({
      userId: 43,
      status: 'REJECTED',
      balanceBefore: '30.00',
      balanceAfter: '30.00',
      user: { id: 43, name: 'Player B', uniqueId: 'USER0002', type: 'user' },
    }));
    expect(mockTransactionRepository.find).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: expect.anything() },
    }));
  });

  it('aggregates assigned users when admin requests the agent through the existing history route', async () => {
    mockUserRepository.findOne.mockResolvedValue({ id: 7, type: 'agent', name: 'Agent' });
    mockUserRepository.find.mockResolvedValue([
      { id: 42, name: 'Player A', uniqueId: 'USER0001', type: 'user' },
    ]);
    mockTransactionRepository.find.mockResolvedValue([{
      id: 25, userId: 42, requestId: null, amount: '50.00', type: 'CREDIT',
      createdAt: new Date('2026-10-25T17:00:00.000Z'),
    }]);
    mockWalletRequestRepository.find.mockResolvedValue([]);

    const history = await service.getTransactionsByUserId(7, {
      id: 0, type: 'superadmin', uniqueId: 'GK00001', mobile: '9000000000',
    });

    expect(history).toHaveLength(1);
    expect(history[0]).toEqual(expect.objectContaining({
      id: 25,
      userId: 42,
      user: { id: 42, name: 'Player A', uniqueId: 'USER0001', type: 'user' },
    }));
  });

  it('accepts an agent unique ID from the account selector', async () => {
    mockUserRepository.findOne.mockResolvedValue({ id: 7, type: 'agent', uniqueId: 'GK00969651' });
    mockUserRepository.find.mockResolvedValue([
      { id: 42, name: 'Player A', uniqueId: 'USER0001', type: 'user' },
    ]);
    mockTransactionRepository.find.mockResolvedValue([]);
    mockWalletRequestRepository.find.mockResolvedValue([]);

    const history = await service.getTransactionsByAccountIdentifier('GK00969651', {
      id: 0, type: 'superadmin', uniqueId: 'GK00001', mobile: '9000000000',
    });

    expect(history).toEqual([]);
    expect(mockUserRepository.findOne).toHaveBeenCalledWith({
      where: { uniqueId: 'GK00969651' },
    });
    expect(mockTransactionRepository.find).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: expect.anything() },
    }));
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
  it('allows an agent to read its own transaction history', async () => {
    mockUserRepository.findOne.mockResolvedValue({ id: 7, type: 'agent', uniqueId: 'AGENT001' });
    mockTransactionRepository.find.mockResolvedValue([]);

    await expect(service.getTransactionsByUserId(7, {
      id: 7, type: 'agent', uniqueId: 'AGENT001', agentId: 'AGENT001', mobile: '9000000000',
    })).resolves.toEqual([]);
    expect(mockTransactionRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 7 } }),
    );
  });
});
