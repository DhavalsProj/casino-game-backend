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
    const user = await this.userRepository.findOne({
      where: { id: walletDto.userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    this.assertCanManageWalletUser(user, currentUser, 'update this wallet');

    const amountCents = this.toCents(walletDto.points, true);
    const existingWallet = await this.walletRepository.findOne({
      where: { userId: walletDto.userId },
    });

    const balanceBeforeCents = existingWallet
      ? this.toCents(existingWallet.balance, true)
      : 0;
    const balanceAfterCents = balanceBeforeCents + amountCents;
    this.assertDatabaseAmount(balanceAfterCents);

    const wallet =
      existingWallet ??
      this.walletRepository.create({
        userId: walletDto.userId,
        balance: '0.00',
        createdBy: currentUser.id,
        updatedBy: currentUser.id,
      });
    wallet.balance = this.fromCents(balanceAfterCents);
    wallet.updatedBy = currentUser.id;
    const savedWallet = await this.walletRepository.save(wallet);

    if (amountCents > 0) {
      await this.transactionRepository.save({
        walletId: savedWallet.id,
        userId: walletDto.userId,
        requestId: null,
        type: WalletTransactionType.CREDIT,
        source: WalletTransactionSource.ADMIN_ADD,
        amount: this.fromCents(amountCents),
        balanceBefore: this.fromCents(balanceBeforeCents),
        balanceAfter: this.fromCents(balanceAfterCents),
      });
    }

    return savedWallet;
  }

  async getWalletByUserId(
    userId: number,
    currentUser: AuthUser,
  ): Promise<Wallet | null> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    this.assertCanManageWalletUser(user, currentUser, 'view this wallet');

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

    const amountCents = this.toCents(createWalletRequestDto.amount, false);

    const type =
      createWalletRequestDto.type ?? WalletRequestType.ADD_POINTS;

    let wallet = await this.walletRepository.findOne({
      where: { userId: user.id },
    });
    if (!wallet) {
      wallet = await this.walletRepository.save(
        this.walletRepository.create({
          userId: user.id,
          balance: '0.00',
          createdBy: currentUser.id,
          updatedBy: currentUser.id,
        }),
      );
    }

    const request = this.walletRequestRepository.create({
      userId: user.id,
      walletId: wallet.id,
      type,
      amount: this.fromCents(amountCents),
      status: WalletRequestStatus.PENDING,
    });

    const savedRequest = await this.walletRequestRepository.save(request);

    await this.walletRequestActionRepository.save({
      requestId: savedRequest.id,
      performedBy: this.getActionActorId(currentUser),
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

    const amountCents = this.toCents(request.amount, false);

    let wallet = request.wallet;

    if (!wallet) {
      const existingWallet = await this.walletRepository.findOne({
        where: { userId: request.userId },
      });

      wallet = existingWallet ??
        this.walletRepository.create({
          userId: request.userId,
          balance: '0.00',
          createdBy: currentUser.id,
          updatedBy: currentUser.id,
        });

      wallet = await this.walletRepository.save(wallet);
    }

    const balanceBeforeCents = this.toCents(wallet.balance ?? '0', true);
    const balanceAfterCents =
      request.type === WalletRequestType.WITHDRAW
        ? balanceBeforeCents - amountCents
        : balanceBeforeCents + amountCents;
    if (balanceAfterCents < 0) {
      throw new BadRequestException(
        'Insufficient wallet balance for this withdrawal',
      );
    }
    this.assertDatabaseAmount(balanceAfterCents);

    wallet.updatedBy = currentUser.id;
    wallet.balance = this.fromCents(balanceAfterCents);
    await this.walletRepository.save(wallet);

    request.wallet = wallet;
    request.walletId = wallet.id;
    request.status = WalletRequestStatus.ACCEPTED;
    await this.walletRequestRepository.save(request);

    await this.walletRequestActionRepository.save({
      requestId: request.id,
      performedBy: this.getActionActorId(currentUser),
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
      amount: this.fromCents(amountCents),
      balanceBefore: this.fromCents(balanceBeforeCents),
      balanceAfter: this.fromCents(balanceAfterCents),
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
      performedBy: this.getActionActorId(currentUser),
      action: WalletRequestActionType.REJECTED,
    });

    return request;
  }

  async getTransactionsByUserId(
    userId: number,
    currentUser: AuthUser,
  ): Promise<Transaction[]> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    this.assertCanManageWalletUser(user, currentUser, 'view these transactions');

    return this.transactionRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      relations: { wallet: true, request: true },
    });
  }

  async getWalletTransactionsByUserId(
    userId: number,
    currentUser: AuthUser,
  ): Promise<Transaction[]> {
    return this.getTransactionsByUserId(userId, currentUser);
  }

  private async assertCanManageWalletRequestUser(
    userId: number,
    currentUser: AuthUser,
    action: string,
  ): Promise<void> {
    if (
      currentUser.type !== UserType.SUPERADMIN &&
      currentUser.type !== 'admin' &&
      currentUser.type !== UserType.AGENT
    ) {
      throw new ForbiddenException(
        `You are not authorized to ${action}`,
      );
    }

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

    if (user.type === UserType.AGENT && user.id === currentUser.id) {
      throw new ForbiddenException('Agents cannot approve their own wallet requests');
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
    const agentScopeId = currentUser.agentId ?? currentUser.uniqueId;
    const isAssignedAgent =
      currentUser.type === UserType.AGENT &&
      user.type === UserType.USER &&
      !!agentScopeId &&
      user.agentId === agentScopeId;
    const isAgentSelf =
      currentUser.type === UserType.AGENT &&
      user.type === UserType.AGENT &&
      currentUser.id === user.id;

    if (
      currentUser.type !== UserType.SUPERADMIN &&
      currentUser.type !== 'admin' &&
      !isOwner &&
      !isAssignedAgent &&
      !isAgentSelf
    ) {
      throw new ForbiddenException(
        `You are not authorized to ${action}`,
      );
    }
  }

  private toCents(value: string | number, allowZero: boolean): number {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0 || (!allowZero && amount === 0)) {
      throw new BadRequestException(
        allowZero
          ? 'Amount must be a valid non-negative number'
          : 'Amount must be greater than zero',
      );
    }

    const cents = Math.round(amount * 100);
    if (
      !Number.isSafeInteger(cents) ||
      Math.abs(amount - cents / 100) > 1e-8
    ) {
      throw new BadRequestException(
        'Amount must be a valid number with at most two decimal places',
      );
    }
    this.assertDatabaseAmount(cents);
    return cents;
  }

  private assertDatabaseAmount(amountCents: number): void {
    if (amountCents > 999_999_999_999_999) {
      throw new BadRequestException('Amount exceeds the wallet limit');
    }
  }

  private fromCents(amountCents: number): string {
    return (amountCents / 100).toFixed(2);
  }

  private getActionActorId(currentUser: AuthUser): number | null {
    return currentUser.id > 0 ? currentUser.id : null;
  }
}
