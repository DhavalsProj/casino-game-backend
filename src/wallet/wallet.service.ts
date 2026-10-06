import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type { AuthUser } from '../auth/auth-user';
import { User, UserType } from '../users/entities/user.entity';
import { Transaction, WalletTransactionSource, WalletTransactionType } from '../transcation/entities/transcation.entity';
import { Wallet } from './entities/wallet.entity';
import {
  WalletRequest,
  WalletRequestStatus,
  WalletRequestType,
} from './entities/wallet.request.entity';
import { WalletRequestAction, WalletRequestActionType } from './entities/wallet_request.action.entity';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { CreateWalletRequestDto } from './dto/create-wallet-request.dto';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,

    @InjectRepository(WalletRequest)
    private readonly walletRequestRepository: Repository<WalletRequest>,

    @InjectRepository(WalletRequestAction)
    private readonly walletRequestActionRepository: Repository<WalletRequestAction>,

    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(
    walletDto: CreateWalletDto,
    currentUser: AuthUser,
  ): Promise<Wallet> {
    const amount = Number(walletDto.points ?? 0);

    if (!Number.isFinite(amount) || amount < 0) {
      throw new BadRequestException('Wallet points must be a valid non-negative number');
    }

    const existingWallet = await this.walletRepository.findOne({
      where: {
        userId: walletDto.userId,
      },
    });

    if (existingWallet) {
      const balance = Number(existingWallet.balance) + amount;

      existingWallet.balance = balance.toString();
      existingWallet.updatedBy = currentUser.id;

      return this.walletRepository.save(existingWallet);
    }

    const wallet = this.walletRepository.create({
      userId: walletDto.userId,
      balance: amount.toString(),
      createdBy: currentUser.id,
      updatedBy: currentUser.id,
    });

    return this.walletRepository.save(wallet);
  }

  async getWalletByUserId(userId: number): Promise<Wallet | null> {
    return this.walletRepository.findOne({
      where: { userId },
    });
  }

  async createWalletRequest(
    createWalletRequestDto: CreateWalletRequestDto,
    currentUser: AuthUser,
  ): Promise<WalletRequest> {
    const user = await this.userRepository.findOne({
      where: { id: createWalletRequestDto.userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    this.assertCanManageWalletUser(
      user,
      currentUser,
      'create this wallet request',
    );

    const amount = Number(createWalletRequestDto.amount ?? 0);

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Request amount must be greater than zero');
    }

    const type =
      createWalletRequestDto.type ?? WalletRequestType.ADD_POINTS;

    const wallet = await this.walletRepository.findOne({
      where: { userId: user.id },
    });

    const request = this.walletRequestRepository.create({
      userId: user.id,
      walletId: wallet?.id ?? 0,
      type,
      amount: amount.toString(),
      status: WalletRequestStatus.PENDING,
    });

    const savedRequest = await this.walletRequestRepository.save(request);

    await this.walletRequestActionRepository.save({
      requestId: savedRequest.id,
      performedBy: currentUser.id,
      action: WalletRequestActionType.CREATED,
    });

    return savedRequest;
  }

  async getWalletRequestsForUser(
    userId: number,
    currentUser: AuthUser,
  ): Promise<WalletRequest[]> {
    const walletUser = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!walletUser) {
      throw new NotFoundException('User not found');
    }

    this.assertCanManageWalletUser(
      walletUser,
      currentUser,
      'view wallet requests for this user',
    );

    return this.walletRequestRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async acceptRequest(
    requestId: number,
    currentUser: AuthUser,
  ): Promise<WalletRequest> {
    return this.acceptWalletRequest(requestId, currentUser);
  }

  async acceptWalletRequest(
    requestId: number,
    currentUser: AuthUser,
  ): Promise<WalletRequest> {
    const request = await this.walletRequestRepository.findOne({
      where: { id: requestId },
      relations: { wallet: true },
    });

    if (!request) {
      throw new NotFoundException('Wallet request not found');
    }

    await this.assertCanManageWalletRequestUser(
      request.userId,
      currentUser,
      'accept this wallet request',
    );

    if (request.status !== WalletRequestStatus.PENDING) {
      throw new BadRequestException(
        `Wallet request is already ${request.status.toLowerCase()}`,
      );
    }

    const amountValue = Number(request.amount ?? 0);

    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      throw new BadRequestException('Request amount is invalid');
    }

    let wallet = request.wallet;

    if (!wallet) {
      const existingWallet = await this.walletRepository.findOne({
        where: { userId: request.userId },
      });

      wallet = existingWallet ??
        this.walletRepository.create({
          userId: request.userId,
          balance: '0',
          createdBy: currentUser.id,
          updatedBy: currentUser.id,
        });

      wallet = await this.walletRepository.save(wallet);
    }

    const balanceBefore = Number(wallet.balance ?? 0);
    const balanceAfter = balanceBefore + amountValue;

    wallet.updatedBy = currentUser.id;
    wallet.balance = balanceAfter.toFixed(2);
    await this.walletRepository.save(wallet);

    request.wallet = wallet;
    request.walletId = wallet.id;
    request.status = WalletRequestStatus.ACCEPTED;
    await this.walletRequestRepository.save(request);

    await this.walletRequestActionRepository.save({
      requestId: request.id,
      performedBy: currentUser.id,
      action: WalletRequestActionType.ACCEPTED,
    });

    await this.transactionRepository.save({
      walletId: wallet.id,
      userId: request.userId,
      requestId: request.id,
      type:
        request.type === WalletRequestType.ADD_POINTS
          ? WalletTransactionType.CREDIT
          : WalletTransactionType.DEBIT,
      source:
        request.type === WalletRequestType.ADD_POINTS
          ? WalletTransactionSource.ADMIN_ADD
          : WalletTransactionSource.WITHDRAW,
      amount: amountValue.toString(),
      balanceBefore: balanceBefore.toFixed(2),
      balanceAfter: balanceAfter.toFixed(2),
    });

    return request;
  }

  async rejectRequest(
    requestId: number,
    currentUser: AuthUser,
  ): Promise<WalletRequest> {
    return this.rejectWalletRequest(requestId, currentUser);
  }

  async rejectWalletRequest(
    requestId: number,
    currentUser: AuthUser,
  ): Promise<WalletRequest> {
    const request = await this.walletRequestRepository.findOne({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('Wallet request not found');
    }

    await this.assertCanManageWalletRequestUser(
      request.userId,
      currentUser,
      'reject this wallet request',
    );

    if (request.status !== WalletRequestStatus.PENDING) {
      throw new BadRequestException(
        `Wallet request is already ${request.status.toLowerCase()}`,
      );
    }

    request.status = WalletRequestStatus.REJECTED;
    await this.walletRequestRepository.save(request);

    await this.walletRequestActionRepository.save({
      requestId: request.id,
      performedBy: currentUser.id,
      action: WalletRequestActionType.REJECTED,
    });

    return request;
  }

  async getTransactionsByUserId(userId: number): Promise<Transaction[]> {
    return this.transactionRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      relations: { wallet: true, request: true },
    });
  }

  async getWalletTransactionsByUserId(userId: number): Promise<Transaction[]> {
    return this.getTransactionsByUserId(userId);
  }

  private async assertCanManageWalletRequestUser(
    userId: number,
    currentUser: AuthUser,
    action: string,
  ): Promise<void> {
    if (
      currentUser.type === UserType.SUPERADMIN ||
      currentUser.type === 'admin'
    ) {
      return;
    }

    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    this.assertCanManageWalletUser(user, currentUser, action);
  }

  private assertCanManageWalletUser(
    user: User,
    currentUser: AuthUser,
    action: string,
  ): void {
    const isOwner =
      currentUser.type === UserType.USER && currentUser.id === user.id;
    const isAssignedAgent =
      currentUser.type === UserType.AGENT &&
      user.type === UserType.USER &&
      !!currentUser.uniqueId &&
      user.agentId === currentUser.uniqueId;

    if (
      currentUser.type !== UserType.SUPERADMIN &&
      currentUser.type !== 'admin' &&
      !isOwner &&
      !isAssignedAgent
    ) {
      throw new ForbiddenException(
        `You are not authorized to ${action}`,
      );
    }
  }
}
