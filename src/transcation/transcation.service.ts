import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import type { AuthUser } from '../auth/auth-user';
import { User, UserType } from '../users/entities/user.entity';
import { Wallet } from '../wallet/entities/wallet.entity';
import { WalletRequest } from '../wallet/entities/wallet.request.entity';
import { Transaction } from './entities/transcation.entity';
import { combineTransactionHistory, TransactionHistoryEntry } from './transaction-history';

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
  ): Promise<TransactionHistoryEntry[]> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (
      user.type === UserType.AGENT &&
      (currentUser.type === UserType.SUPERADMIN || currentUser.type === 'admin')
    ) {
      return this.getTransactionsByAgentId(userId, currentUser);
    }
    const canView =
      currentUser.type === UserType.SUPERADMIN ||
      currentUser.type === 'admin' ||
      (currentUser.type === UserType.USER && currentUser.id === user.id) ||
      (currentUser.type === UserType.AGENT && currentUser.id === user.id) ||
      (currentUser.type === UserType.AGENT &&
        user.type === UserType.USER &&
        user.agentId === (currentUser.type === 'agent' ? currentUser.id : currentUser.agentId));
    if (!canView) {
      throw new ForbiddenException(
        'You are not authorized to view these transactions',
      );
    }

    const [transactions, requests] = await Promise.all([
      this.transactionRepository.find({
        where: { userId },
        relations: { wallet: true, request: true },
        order: { createdAt: 'DESC' },
      }),
      this.walletRequestRepository.find({
        where: { userId, status: In(['ACCEPTED', 'REJECTED']) },
        relations: { actions: true },
        order: { updatedAt: 'DESC' },
      }),
    ]);
    return combineTransactionHistory(transactions, requests);
  }

  async getTransactionsByAccountIdentifier(
    identifier: string,
    currentUser: AuthUser,
  ): Promise<TransactionHistoryEntry[]> {
    const numericId = /^\d+$/.test(identifier) ? Number(identifier) : null;
    const user = await this.userRepository.findOne({
      where: numericId === null ? { uniqueId: identifier } : { id: numericId },
    });
    if (!user) throw new NotFoundException('User or agent not found');
    return this.getTransactionsByUserId(user.id, currentUser);
  }

  async getTransactionsByAgentId(
    agentId: number,
    currentUser: AuthUser,
  ): Promise<TransactionHistoryEntry[]> {
    if (currentUser.type !== UserType.SUPERADMIN && currentUser.type !== 'admin') {
      throw new ForbiddenException('Only administrators can view an agent transaction history');
    }

    const agent = await this.userRepository.findOne({
      where: { id: agentId, type: UserType.AGENT },
    });
    if (!agent) throw new NotFoundException('Agent not found');

    const assignedUsers = await this.userRepository.find({
      where: { agentId, type: UserType.USER },
      select: { id: true, name: true, uniqueId: true, type: true },
    });
    if (!assignedUsers.length) return [];

    const userIds = assignedUsers.map((user) => user.id);
    const [transactions, requests] = await Promise.all([
      this.transactionRepository.find({
        where: { userId: In(userIds) },
        relations: { wallet: true, request: true },
        order: { createdAt: 'DESC' },
      }),
      this.walletRequestRepository.find({
        where: { userId: In(userIds), status: In(['ACCEPTED', 'REJECTED']) },
        relations: { actions: true },
        order: { updatedAt: 'DESC' },
      }),
    ]);

    const userById = new Map(assignedUsers.map((user) => [user.id, user]));
    return combineTransactionHistory(transactions, requests).map((entry) => ({
      ...entry,
      user: userById.get(Number(entry.userId)),
    }));
  }

  async getTransactionById(id: number): Promise<Transaction | null> {
    return this.transactionRepository.findOne({
      where: { id },
      relations: { wallet: true, request: true },
    });
  }
}
