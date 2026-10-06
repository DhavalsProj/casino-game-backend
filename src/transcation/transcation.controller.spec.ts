import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { jest } from '@jest/globals';
import { TranscationController } from './transcation.controller';
import { TranscationService } from './transcation.service';

describe('TranscationController', () => {
  let controller: TranscationController;

  const mockTranscationService = {
    getTransactionsByUserId: jest.fn(),
    getTransactionById: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TranscationController],
      providers: [
        {
          provide: TranscationService,
          useValue: mockTranscationService,
        },
        {
          provide: JwtService,
          useValue: { verifyAsync: jest.fn() },
        },
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<TranscationController>(TranscationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
