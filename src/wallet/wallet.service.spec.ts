import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { jest } from '@jest/globals';

import { User } from '../users/entities/user.entity';
import { Transaction } from '../transcation/entities/transcation.entity';
import { Wallet } from './entities/wallet.entity';
import { WalletRequest } from './entities/wallet.request.entity';
import { WalletRequestAction } from './entities/wallet_request.action.entity';
import { WalletService } from './wallet.service';
import { ForbiddenException } from '@nestjs/common';

describe('WalletService', () => {
  let service: WalletService;

  const mockWalletRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockWalletRequestRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
  };

  const mockWalletRequestActionRepository = {
    save: jest.fn(),
  };

  const mockTransactionRepository = {
    find: jest.fn(),
    save: jest.fn(),
  };

  const mockUserRepository = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        {
          provide: getRepositoryToken(Wallet),
          useValue: mockWalletRepository,
        },
        {
          provide: getRepositoryToken(WalletRequest),
          useValue: mockWalletRequestRepository,
        },
        {
          provide: getRepositoryToken(WalletRequestAction),
          useValue: mockWalletRequestActionRepository,
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: mockTransactionRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    service = module.get<WalletService>(WalletService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('allows an agent to create a wallet request for an assigned user', async () => {
    const user = {
      id: 42,
      type: 'user',
      agentId: 'AGENT001',
    };
    const request = { id: 7, userId: user.id };
    mockUserRepository.findOne.mockResolvedValue(user);
    mockWalletRepository.findOne.mockResolvedValue(null);
    mockWalletRequestRepository.create.mockReturnValue(request);
    mockWalletRequestRepository.save.mockResolvedValue(request);

    const result = await service.createWalletRequest(
      { userId: user.id, amount: '100' },
      {
        id: 5,
        type: 'agent',
        uniqueId: 'AGENT001',
        mobile: '9000000000',
      },
    );

    expect(result).toBe(request);
    expect(mockWalletRequestRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: user.id,
        amount: '100',
        status: 'PENDING',
      }),
    );
    expect(mockWalletRequestActionRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: request.id,
        performedBy: 5,
        action: 'CREATED',
      }),
    );
  });

  it("prevents an agent from creating a wallet request for another agent's user", async () => {
    mockUserRepository.findOne.mockResolvedValue({
      id: 42,
      type: 'user',
      agentId: 'OTHER001',
    });

    await expect(
      service.createWalletRequest(
        { userId: 42, amount: '100' },
        {
          id: 5,
          type: 'agent',
          uniqueId: 'AGENT001',
          mobile: '9000000000',
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(mockWalletRequestRepository.save).not.toHaveBeenCalled();
  });

  it('allows an agent to accept a pending wallet request for an assigned user', async () => {
    const wallet = {
      id: 3,
      userId: 42,
      balance: '50.00',
      updatedBy: 0,
    };
    const request = {
      id: 7,
      userId: 42,
      walletId: wallet.id,
      wallet,
      type: 'ADD_POINTS',
      amount: '25',
      status: 'PENDING',
    };
    mockWalletRequestRepository.findOne.mockResolvedValue(request);
    mockUserRepository.findOne.mockResolvedValue({
      id: 42,
      type: 'user',
      agentId: 'AGENT001',
    });
    mockWalletRepository.save.mockImplementation(async (value) => value);

    await service.acceptWalletRequest(7, {
      id: 5,
      type: 'agent',
      uniqueId: 'AGENT001',
      mobile: '9000000000',
    });

    expect(wallet.balance).toBe('75.00');
    expect(request.status).toBe('ACCEPTED');
    expect(mockTransactionRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        walletId: wallet.id,
        userId: 42,
        requestId: request.id,
        balanceBefore: '50.00',
        balanceAfter: '75.00',
      }),
    );
  });

  it('allows an agent to reject a pending wallet request for an assigned user', async () => {
    const request = {
      id: 7,
      userId: 42,
      status: 'PENDING',
    };
    mockWalletRequestRepository.findOne.mockResolvedValue(request);
    mockUserRepository.findOne.mockResolvedValue({
      id: 42,
      type: 'user',
      agentId: 'AGENT001',
    });

    await service.rejectWalletRequest(7, {
      id: 5,
      type: 'agent',
      uniqueId: 'AGENT001',
      mobile: '9000000000',
    });

    expect(request.status).toBe('REJECTED');
    expect(mockWalletRequestActionRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: request.id,
        performedBy: 5,
        action: 'REJECTED',
      }),
    );
  });
});