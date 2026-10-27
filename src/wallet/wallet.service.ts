import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";

import type { AuthUser } from "../auth/auth-user";
import { User, UserType } from "../users/entities/user.entity";
import {
  Transaction,
  WalletBalanceBucket,
  WalletTransactionSource,
  WalletTransactionType,
} from "../transcation/entities/transcation.entity";
import { Wallet } from "./entities/wallet.entity";
import {
  WalletRequest,
  WalletRequestStatus,
  WalletRequestType,
} from "./entities/wallet.request.entity";
import {
  WalletRequestAction,
  WalletRequestActionType,
} from "./entities/wallet_request.action.entity";
import { CreateWalletDto } from "./dto/create-wallet.dto";
import { CreateWalletRequestDto } from "./dto/create-wallet-request.dto";
import { UpdateWalletRequestDto } from "./dto/update-wallet-request.dto";
import {
  combineTransactionHistory,
  TransactionHistoryEntry,
} from "../transcation/transaction-history";

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
    const amountCents = this.toCents(walletDto.points, true);
    return this.transactionRepository.manager.transaction(async (manager) => {
      // Lock the owner row so concurrent wallet creation paths serialize even
      // when there is not yet a wallet row to lock.
      const user = await manager.getRepository(User).findOne({
        where: { id: walletDto.userId },
        lock: { mode: "pessimistic_write" },
      });
      if (!user) throw new NotFoundException("User not found");
      this.assertCanManageWalletUser(user, currentUser, "update this wallet");

      const wallets = manager.getRepository(Wallet);
      const existingWallet = await wallets.findOne({
        where: { userId: walletDto.userId },
        lock: { mode: "pessimistic_write" },
      });
      const balanceBeforeCents = existingWallet
        ? this.toCents(existingWallet.balance, true)
        : 0;
      const balanceAfterCents = balanceBeforeCents + amountCents;
      this.assertDatabaseAmount(balanceAfterCents);

      const wallet =
        existingWallet ??
        wallets.create({
          userId: walletDto.userId,
          balance: "0.00",
          createdBy: currentUser.id,
          updatedBy: currentUser.id,
        });
      wallet.balance = this.fromCents(balanceAfterCents);
      wallet.updatedBy = currentUser.id;
      const savedWallet = await wallets.save(wallet);

      if (amountCents > 0) {
        await manager.getRepository(Transaction).save({
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
    });
  }

  async getWalletByUserId(
    userId: number,
    currentUser: AuthUser,
  ): Promise<Wallet | null> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    this.assertCanManageWalletUser(user, currentUser, "view this wallet");

    const wallet = await this.walletRepository.findOne({
      where: { userId },
    });
    return wallet ? {
      ...wallet,
      blockedFromBetting: Number(wallet.temporaryWinningBalance) > 0,
    } as Wallet & { blockedFromBetting: boolean } : null;
  }

  async transferTemporaryWinnings(userId: number, currentUser: AuthUser) {
    if (currentUser.type !== UserType.USER || currentUser.id !== userId) {
      throw new ForbiddenException("Only the wallet owner can transfer temporary winnings");
    }
    return this.transactionRepository.manager.transaction(async (manager) => {
      const user = await manager.getRepository(User).findOne({
        where: { id: userId },
        lock: { mode: "pessimistic_write" },
      });
      if (!user) throw new NotFoundException("User not found");
      const wallets = manager.getRepository(Wallet);
      const wallet = await wallets.findOne({
        where: { userId },
        lock: { mode: "pessimistic_write" },
      });
      if (!wallet) throw new NotFoundException("Wallet not found");
      const temporaryCents = this.toCents(wallet.temporaryWinningBalance, true);
      if (temporaryCents <= 0) throw new BadRequestException("No temporary winnings to transfer");
      const mainBeforeCents = this.toCents(wallet.balance, true);
      const mainAfterCents = mainBeforeCents + temporaryCents;
      this.assertDatabaseAmount(mainAfterCents);
      wallet.balance = this.fromCents(mainAfterCents);
      wallet.temporaryWinningBalance = "0.00";
      wallet.updatedBy = currentUser.id;
      await wallets.save(wallet);

      const transactions = manager.getRepository(Transaction);
      await transactions.save([
        {
          walletId: wallet.id,
          userId,
          requestId: null,
          type: WalletTransactionType.DEBIT,
          source: WalletTransactionSource.GAME_WIN,
          balanceBucket: WalletBalanceBucket.TEMPORARY_WINNING,
          amount: this.fromCents(temporaryCents),
          balanceBefore: this.fromCents(temporaryCents),
          balanceAfter: "0.00",
          description: "Transfer temporary winnings to main wallet",
        },
        {
          walletId: wallet.id,
          userId,
          requestId: null,
          type: WalletTransactionType.CREDIT,
          source: WalletTransactionSource.GAME_WIN,
          balanceBucket: WalletBalanceBucket.MAIN,
          amount: this.fromCents(temporaryCents),
          balanceBefore: this.fromCents(mainBeforeCents),
          balanceAfter: wallet.balance,
          description: "Transfer temporary winnings to main wallet",
        },
      ]);
      return { ...wallet, blockedFromBetting: false };
    });
  }

  async createWalletRequest(
    createWalletRequestDto: CreateWalletRequestDto,
    currentUser: AuthUser,
  ): Promise<WalletRequest> {
    const amountCents = this.toCents(createWalletRequestDto.amount, false);
    const type = createWalletRequestDto.type ?? WalletRequestType.ADD_POINTS;
    return this.transactionRepository.manager.transaction(async (manager) => {
      const user = await manager.getRepository(User).findOne({
        where: { id: createWalletRequestDto.userId },
        lock: { mode: "pessimistic_write" },
      });
      if (!user) throw new NotFoundException("User not found");
      this.assertCanManageWalletUser(
        user,
        currentUser,
        "create this wallet request",
      );

      const wallets = manager.getRepository(Wallet);
      let wallet = await wallets.findOne({ where: { userId: user.id } });
      if (!wallet) {
        wallet = await wallets.save(
          wallets.create({
            userId: user.id,
            balance: "0.00",
            createdBy: currentUser.id,
            updatedBy: currentUser.id,
          }),
        );
      }

      const requests = manager.getRepository(WalletRequest);
      const savedRequest = await requests.save(
        requests.create({
          userId: user.id,
          walletId: wallet.id,
          type,
          amount: this.fromCents(amountCents),
          status: WalletRequestStatus.PENDING,
        }),
      );

      await manager.getRepository(WalletRequestAction).save({
        requestId: savedRequest.id,
        performedBy: this.getActionActorId(currentUser),
        action: WalletRequestActionType.CREATED,
      });

      return savedRequest;
    });
  }

  async updateWalletRequest(
    requestId: number,
    changes: UpdateWalletRequestDto,
    currentUser: AuthUser,
  ): Promise<WalletRequest> {
    if (changes.amount === undefined && changes.type === undefined) {
      throw new BadRequestException(
        "Provide an amount or request type to update",
      );
    }

    const request = await this.walletRequestRepository.findOne({
      where: { id: requestId },
    });
    if (!request) {
      throw new NotFoundException("Wallet request not found");
    }

    const user = await this.userRepository.findOne({
      where: { id: request.userId },
    });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    this.assertCanManageWalletUser(
      user,
      currentUser,
      "edit this wallet request",
    );

    if (request.status !== WalletRequestStatus.PENDING) {
      throw new BadRequestException(
        "Only pending wallet requests can be edited",
      );
    }

    if (changes.amount !== undefined) {
      const amountCents = this.toCents(changes.amount, false);
      request.amount = this.fromCents(amountCents);
    }
    if (changes.type !== undefined) {
      request.type = changes.type;
    }

    return this.walletRequestRepository.save(request);
  }

  async getWalletRequest(
    requestId: number,
    currentUser: AuthUser,
  ): Promise<WalletRequest> {
    const request = await this.walletRequestRepository.findOne({
      where: { id: requestId },
    });
    if (!request) {
      throw new NotFoundException("Wallet request not found");
    }

    const user = await this.userRepository.findOne({
      where: { id: request.userId },
    });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    this.assertCanManageWalletUser(
      user,
      currentUser,
      "view this wallet request",
    );
    return request;
  }

  async deleteWalletRequest(
    requestId: number,
    currentUser: AuthUser,
  ): Promise<{ message: string }> {
    const request = await this.walletRequestRepository.findOne({
      where: { id: requestId },
    });
    if (!request) {
      throw new NotFoundException("Wallet request not found");
    }

    const user = await this.userRepository.findOne({
      where: { id: request.userId },
    });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    this.assertCanManageWalletUser(
      user,
      currentUser,
      "delete this wallet request",
    );

    if (request.status !== WalletRequestStatus.PENDING) {
      throw new BadRequestException(
        "Only pending wallet requests can be deleted",
      );
    }

    await this.walletRequestRepository.delete(request.id);
    return { message: "Wallet request deleted successfully" };
  }

  async getWalletRequestsForUser(
    userId: number,
    currentUser: AuthUser,
  ): Promise<WalletRequest[]> {
    const walletUser = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!walletUser) {
      throw new NotFoundException("User not found");
    }

    this.assertCanManageWalletUser(
      walletUser,
      currentUser,
      "view wallet requests for this user",
    );

    return this.walletRequestRepository.find({
      where: { userId },
      order: { createdAt: "DESC" },
    });
  }

  async acceptRequest(
    requestId: number,
    currentUser: AuthUser,
  ): Promise<WalletRequest & { walletBalance: string }> {
    return this.acceptWalletRequest(requestId, currentUser);
  }

  async acceptWalletRequest(
    requestId: number,
    currentUser: AuthUser,
  ): Promise<WalletRequest & { walletBalance: string }> {
    return this.processWalletRequestAcceptance(requestId, currentUser, false);
  }

  async acceptOwnWalletRequest(
    requestId: number,
    currentUser: AuthUser,
  ): Promise<WalletRequest & { walletBalance: string }> {
    return this.processWalletRequestAcceptance(requestId, currentUser, true);
  }

  async respondToOwnWalletRequest(
    requestId: number,
    action: "ACCEPT" | "REJECT",
    currentUser: AuthUser,
  ): Promise<WalletRequest & { walletBalance: string }> {
    if (action === "ACCEPT") {
      return this.acceptOwnWalletRequest(requestId, currentUser);
    }
    return this.rejectWalletRequest(requestId, currentUser);
  }

  private async processWalletRequestAcceptance(
    requestId: number,
    currentUser: AuthUser,
    creditOnAcceptance: boolean,
  ): Promise<WalletRequest & { walletBalance: string }> {
    return this.transactionRepository.manager.transaction(async (manager) => {
      const requests = manager.getRepository(WalletRequest);
      const wallets = manager.getRepository(Wallet);
      const request = await requests.findOne({
        where: { id: requestId },
        lock: { mode: "pessimistic_write" },
      });
      if (!request) throw new NotFoundException("Wallet request not found");

      await this.assertCanManageWalletRequestUser(
        request.userId,
        currentUser,
        "accept this wallet request",
      );
      if (request.status !== WalletRequestStatus.PENDING) {
        throw new BadRequestException(
          `Wallet request is already ${request.status.toLowerCase()}`,
        );
      }

      const amountCents = this.toCents(request.amount, false);
      let wallet = await wallets.findOne({
        where: { userId: request.userId },
        lock: { mode: "pessimistic_write" },
      });
      if (!wallet) {
        wallet = wallets.create({
          userId: request.userId,
          balance: "0.00",
          createdBy: currentUser.id,
          updatedBy: currentUser.id,
        });
      }

      const balanceBeforeCents = this.toCents(wallet.balance ?? "0", true);
      // The user's app confirms incoming points by accepting their pending
      // request. Administrative withdrawal processing keeps its existing debit rule.
      const isCredit =
        creditOnAcceptance || request.type === WalletRequestType.ADD_POINTS;
      const balanceAfterCents = isCredit
        ? balanceBeforeCents + amountCents
        : balanceBeforeCents - amountCents;
      if (balanceAfterCents < 0) {
        throw new BadRequestException(
          "Insufficient wallet balance for this withdrawal",
        );
      }
      this.assertDatabaseAmount(balanceAfterCents);

      wallet.updatedBy = currentUser.id;
      wallet.balance = this.fromCents(balanceAfterCents);
      wallet = await wallets.save(wallet);
      request.wallet = wallet;
      request.walletId = wallet.id;
      request.status = WalletRequestStatus.ACCEPTED;
      await requests.save(request);
      await manager.getRepository(WalletRequestAction).save({
        requestId: request.id,
        performedBy: this.getActionActorId(currentUser),
        action: WalletRequestActionType.ACCEPTED,
      });
      await manager.getRepository(Transaction).save({
        walletId: wallet.id,
        userId: request.userId,
        requestId: request.id,
        type: isCredit
          ? WalletTransactionType.CREDIT
          : WalletTransactionType.DEBIT,
        source: isCredit
          ? WalletTransactionSource.ADMIN_ADD
          : WalletTransactionSource.WITHDRAW,
        amount: this.fromCents(amountCents),
        balanceBefore: this.fromCents(balanceBeforeCents),
        balanceAfter: this.fromCents(balanceAfterCents),
        description: creditOnAcceptance
          ? `User accepted pending request ${request.id}; points credited`
          : undefined,
      });
      return Object.assign(request, { walletBalance: wallet.balance });
    });
  }

  async rejectRequest(
    requestId: number,
    currentUser: AuthUser,
  ): Promise<WalletRequest & { walletBalance: string }> {
    return this.rejectWalletRequest(requestId, currentUser);
  }

  async rejectWalletRequest(
    requestId: number,
    currentUser: AuthUser,
  ): Promise<WalletRequest & { walletBalance: string }> {
    return this.transactionRepository.manager.transaction(async (manager) => {
      const requests = manager.getRepository(WalletRequest);
      const request = await requests.findOne({
        where: { id: requestId },
        lock: { mode: "pessimistic_write" },
      });
      if (!request) throw new NotFoundException("Wallet request not found");

      await this.assertCanManageWalletRequestUser(
        request.userId,
        currentUser,
        "reject this wallet request",
      );
      if (request.status !== WalletRequestStatus.PENDING) {
        throw new BadRequestException(
          `Wallet request is already ${request.status.toLowerCase()}`,
        );
      }

      const wallet = await manager.getRepository(Wallet).findOne({
        where: { userId: request.userId },
        lock: { mode: "pessimistic_write" },
      });
      const balanceAtDecision = wallet?.balance ?? "0.00";
      request.status = WalletRequestStatus.REJECTED;
      await requests.save(request);
      await manager.getRepository(WalletRequestAction).save({
        requestId: request.id,
        performedBy: this.getActionActorId(currentUser),
        action: WalletRequestActionType.REJECTED,
        balanceBefore: balanceAtDecision,
        balanceAfter: balanceAtDecision,
      });
      return Object.assign(request, { walletBalance: balanceAtDecision });
    });
  }

  async getTransactionsByUserId(
    userId: number,
    currentUser: AuthUser,
  ): Promise<TransactionHistoryEntry[]> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    this.assertCanManageWalletUser(
      user,
      currentUser,
      "view these transactions",
    );

    const [transactions, requests] = await Promise.all([
      this.transactionRepository.find({
        where: { userId },
        order: { createdAt: "DESC" },
        relations: { wallet: true, request: true },
      }),
      this.walletRequestRepository.find({
        where: { userId, status: In(["ACCEPTED", "REJECTED"]) },
        relations: { actions: true },
        order: { updatedAt: "DESC" },
      }),
    ]);
    return combineTransactionHistory(transactions, requests);
  }

  async getWalletTransactionsByUserId(
    userId: number,
    currentUser: AuthUser,
  ): Promise<TransactionHistoryEntry[]> {
    return this.getTransactionsByUserId(userId, currentUser);
  }

  private async assertCanManageWalletRequestUser(
    userId: number,
    currentUser: AuthUser,
    action: string,
  ): Promise<void> {
    if (currentUser.type === UserType.USER) {
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) throw new NotFoundException("User not found");
      this.assertCanManageWalletUser(user, currentUser, action);
      return;
    }

    if (
      currentUser.type !== UserType.SUPERADMIN &&
      currentUser.type !== "admin" &&
      currentUser.type !== UserType.AGENT
    ) {
      throw new ForbiddenException(`You are not authorized to ${action}`);
    }

    if (
      currentUser.type === UserType.SUPERADMIN ||
      currentUser.type === "admin"
    ) {
      return;
    }

    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (user.type === UserType.AGENT && user.id === currentUser.id) {
      throw new ForbiddenException(
        "Agents cannot approve their own wallet requests",
      );
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
    const agentScopeId =
      currentUser.type === "agent" ? currentUser.id : currentUser.agentId;
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
      currentUser.type !== "admin" &&
      !isOwner &&
      !isAssignedAgent &&
      !isAgentSelf
    ) {
      throw new ForbiddenException(`You are not authorized to ${action}`);
    }
  }

  private toCents(value: string | number, allowZero: boolean): number {
    const amount = Number(value);
    if (
      !Number.isFinite(amount) ||
      amount < 0 ||
      (!allowZero && amount === 0)
    ) {
      throw new BadRequestException(
        allowZero
          ? "Amount must be a valid non-negative number"
          : "Amount must be greater than zero",
      );
    }

    const cents = Math.round(amount * 100);
    if (!Number.isSafeInteger(cents) || Math.abs(amount - cents / 100) > 1e-8) {
      throw new BadRequestException(
        "Amount must be a valid number with at most two decimal places",
      );
    }
    this.assertDatabaseAmount(cents);
    return cents;
  }

  private assertDatabaseAmount(amountCents: number): void {
    if (amountCents > 999_999_999_999_999) {
      throw new BadRequestException("Amount exceeds the wallet limit");
    }
  }

  private fromCents(amountCents: number): string {
    return (amountCents / 100).toFixed(2);
  }

  private getActionActorId(currentUser: AuthUser): number | null {
    return currentUser.id > 0 ? currentUser.id : null;
  }
}
