import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from '../users/entities/user.entity';
import { Wallet } from '../wallet/entities/wallet.entity';
import { WalletRequest } from '../wallet/entities/wallet.request.entity';
import { Transaction } from './entities/transcation.entity';

@Injectable()
export class TranscationService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,

    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(WalletRequest)
    private readonly walletRequestRepository: Repository<WalletRequest>,
  ) {}

  async getTransactionsByUserId(userId: number): Promise<Transaction[]> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.transactionRepository.find({
      where: { userId },
      relations: { wallet: true, request: true },
      order: { createdAt: 'DESC' },
    });
  }

  async getTransactionById(id: number): Promise<Transaction | null> {
    return this.transactionRepository.findOne({
      where: { id },
      relations: { wallet: true, request: true },
    });
  }
}
