import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type { AuthUser } from '../auth/auth-user';
import { User, UserType } from '../users/entities/user.entity';
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

  async getTransactionsByUserId(
    userId: number,
    currentUser: AuthUser,
  ): Promise<Transaction[]> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }
    const canView =
      currentUser.type === UserType.SUPERADMIN ||
      currentUser.type === 'admin' ||
      (currentUser.type === UserType.USER && currentUser.id === user.id) ||
      (currentUser.type === UserType.AGENT &&
        user.type === UserType.USER &&
        user.agentId === currentUser.uniqueId);
    if (!canView) {
      throw new ForbiddenException(
        'You are not authorized to view these transactions',
      );
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
