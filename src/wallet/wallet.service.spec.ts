import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { jest } from '@jest/globals';

import { User } from '../users/entities/user.entity';
import { Transaction } from '../transcation/entities/transcation.entity';
import { Wallet } from './entities/wallet.entity';
import { WalletRequest } from './entities/wallet.request.entity';
import { WalletRequestAction } from './entities/wallet_request.action.entity';
import { WalletService } from './wallet.service';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

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

  it('records a credit transaction when adding wallet points', async () => {
    const user = {
      id: 42,
      type: 'user',
      agentId: 'AGENT001',
    };
    const wallet = { id: 9, userId: user.id, balance: '0.00' };
    mockUserRepository.findOne.mockResolvedValue(user);
    mockWalletRepository.findOne.mockResolvedValue(null);
    mockWalletRepository.create.mockReturnValue(wallet);
    mockWalletRepository.save.mockImplementation(async (value) => value);

    await service.create(
      { userId: user.id, points: '12.50' },
      {
        id: 5,
        type: 'agent',
        uniqueId: 'AGENT001',
        mobile: '9000000000',
      },
    );

    expect(wallet.balance).toBe('12.50');
    expect(mockTransactionRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        walletId: wallet.id,
        userId: user.id,
        type: 'CREDIT',
        source: 'ADMIN_ADD',
        amount: '12.50',
        balanceBefore: '0.00',
        balanceAfter: '12.50',
      }),
    );
  });

  it('allows an agent to create a wallet request for an assigned user', async () => {
    const user = {
      id: 42,
      type: 'user',
      agentId: 'AGENT001',
    };
    const wallet = { id: 9, userId: user.id, balance: '0.00' };
    const request = { id: 7, userId: user.id };
    mockUserRepository.findOne.mockResolvedValue(user);
    mockWalletRepository.findOne.mockResolvedValue(wallet);
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
        walletId: wallet.id,
        amount: '100.00',
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

  it('creates a wallet before saving a request when the user has no wallet', async () => {
    const user = {
      id: 42,
      type: 'user',
      agentId: 'AGENT001',
    };
    const wallet = { id: 9, userId: user.id, balance: '0.00' };
    const request = { id: 7, userId: user.id };
    mockUserRepository.findOne.mockResolvedValue(user);
    mockWalletRepository.findOne.mockResolvedValue(null);
    mockWalletRepository.create.mockReturnValue(wallet);
    mockWalletRepository.save.mockResolvedValue(wallet);
    mockWalletRequestRepository.create.mockReturnValue(request);
    mockWalletRequestRepository.save.mockResolvedValue(request);

    await service.createWalletRequest(
      { userId: user.id, amount: '10.25' },
      {
        id: 5,
        type: 'agent',
        uniqueId: 'AGENT001',
        mobile: '9000000000',
      },
    );

    expect(mockWalletRequestRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        walletId: wallet.id,
        amount: '10.25',
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

  it('stores superadmin wallet actions without a user foreign key', async () => {
    const user = {
      id: 42,
      type: 'user',
      agentId: 'AGENT001',
    };
    const wallet = { id: 9, userId: user.id, balance: '0.00' };
    const request = { id: 7, userId: user.id };
    mockUserRepository.findOne.mockResolvedValue(user);
    mockWalletRepository.findOne.mockResolvedValue(wallet);
    mockWalletRequestRepository.create.mockReturnValue(request);
    mockWalletRequestRepository.save.mockResolvedValue(request);

    await service.createWalletRequest(
      { userId: user.id, amount: '10.00' },
      {
        id: 0,
        type: 'superadmin',
        uniqueId: 'GK00001',
        mobile: '9000000000',
      },
    );

    expect(mockWalletRequestActionRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: request.id,
        performedBy: null,
        action: 'CREATED',
      }),
    );
  });

  it('deducts the balance and records a debit when accepting a withdrawal', async () => {
    const wallet = {
      id: 3,
      userId: 42,
      balance: '50.00',
      updatedBy: 0,
    };
    const request = {
      id: 8,
      userId: 42,
      walletId: wallet.id,
      wallet,
      type: 'WITHDRAW',
      amount: '12.50',
      status: 'PENDING',
    };
    mockWalletRequestRepository.findOne.mockResolvedValue(request);
    mockUserRepository.findOne.mockResolvedValue({
      id: 42,
      type: 'user',
      agentId: 'AGENT001',
    });
    mockWalletRepository.save.mockImplementation(async (value) => value);

    await service.acceptWalletRequest(8, {
      id: 5,
      type: 'agent',
      uniqueId: 'AGENT001',
      mobile: '9000000000',
    });

    expect(wallet.balance).toBe('37.50');
    expect(mockTransactionRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'DEBIT',
        source: 'WITHDRAW',
        amount: '12.50',
        balanceBefore: '50.00',
        balanceAfter: '37.50',
      }),
    );
  });

  it('rejects a withdrawal that exceeds the wallet balance', async () => {
    const wallet = {
      id: 3,
      userId: 42,
      balance: '10.00',
      updatedBy: 0,
    };
    const request = {
      id: 8,
      userId: 42,
      walletId: wallet.id,
      wallet,
      type: 'WITHDRAW',
      amount: '12.50',
      status: 'PENDING',
    };
    mockWalletRequestRepository.findOne.mockResolvedValue(request);
    mockUserRepository.findOne.mockResolvedValue({
      id: 42,
      type: 'user',
      agentId: 'AGENT001',
    });

    await expect(
      service.acceptWalletRequest(8, {
        id: 5,
        type: 'agent',
        uniqueId: 'AGENT001',
        mobile: '9000000000',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(mockWalletRepository.save).not.toHaveBeenCalled();
    expect(mockTransactionRepository.save).not.toHaveBeenCalled();
  });

  it('prevents a user from reading another user wallet', async () => {
    mockUserRepository.findOne.mockResolvedValue({
      id: 42,
      type: 'user',
      agentId: 'AGENT001',
    });

    await expect(
      service.getWalletByUserId(42, {
        id: 6,
        type: 'user',
        uniqueId: 'USER002',
        mobile: '9000000001',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('allows an agent to view its own wallet', async () => {
    const wallet = { id: 12, userId: 5, balance: '30.00' };
    mockUserRepository.findOne.mockResolvedValue({ id: 5, type: 'agent', uniqueId: 'AGENT001' });
    mockWalletRepository.findOne.mockResolvedValue(wallet);

    await expect(service.getWalletByUserId(5, {
      id: 5, type: 'agent', uniqueId: 'AGENT001', agentId: 'AGENT001', mobile: '9000000000',
    })).resolves.toBe(wallet);
  });

  it('does not allow an agent to approve its own wallet request', async () => {
    mockWalletRequestRepository.findOne.mockResolvedValue({
      id: 7, userId: 5, status: 'PENDING', type: 'ADD_POINTS', amount: '10.00',
    });
    mockUserRepository.findOne.mockResolvedValue({ id: 5, type: 'agent', uniqueId: 'AGENT001' });

    await expect(service.acceptWalletRequest(7, {
      id: 5, type: 'agent', uniqueId: 'AGENT001', agentId: 'AGENT001', mobile: '9000000000',
    })).rejects.toBeInstanceOf(ForbiddenException);
    expect(mockWalletRepository.save).not.toHaveBeenCalled();
  });
});