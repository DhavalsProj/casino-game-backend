import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { jest } from '@jest/globals';

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
});
