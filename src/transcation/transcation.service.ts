import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";

import type { AuthUser } from "../auth/auth-user";
import { User, UserType } from "../users/entities/user.entity";
import {
  WalletRequest,
  WalletRequestStatus,
} from "../wallet/entities/wallet.request.entity";
import { Transaction } from "./entities/transcation.entity";
import {
  combineTransactionHistory,
  PaginatedTransactionHistory,
  TransactionHistoryEntry,
  TransactionHistoryQuery,
} from "./transaction-history";

@Injectable()
export class TranscationService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(WalletRequest)
    private readonly walletRequestRepository: Repository<WalletRequest>,
  ) {}

  async getTransactionsByUserId(
    userId: number,
    currentUser: AuthUser,
    pagination?: TransactionHistoryQuery,
  ): Promise<TransactionHistoryEntry[] | PaginatedTransactionHistory> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException("User not found");
    }
    if (
      user.type === UserType.AGENT &&
      (currentUser.type === UserType.SUPERADMIN || currentUser.type === "admin")
    ) {
      return this.getTransactionsByAgentId(userId, currentUser, pagination);
    }
    const canView =
      currentUser.type === UserType.SUPERADMIN ||
      currentUser.type === "admin" ||
      (currentUser.type === UserType.USER && currentUser.id === user.id) ||
      (currentUser.type === UserType.AGENT && currentUser.id === user.id) ||
      (currentUser.type === UserType.AGENT &&
        user.type === UserType.USER &&
        user.agentId ===
          (currentUser.type === "agent"
            ? currentUser.id
            : currentUser.agentId));
    if (!canView) {
      throw new ForbiddenException(
        "You are not authorized to view these transactions",
      );
    }

    if (pagination) {
      return this.getTransactionHistoryPage([userId], pagination);
    }

    const [transactions, requests] = await Promise.all([
      this.transactionRepository.find({
        where: { userId },
        relations: { wallet: true, request: true },
        order: { createdAt: "DESC" },
      }),
      this.walletRequestRepository.find({
        where: { userId, status: In(["ACCEPTED", "REJECTED"]) },
        relations: { actions: true },
        order: { updatedAt: "DESC" },
      }),
    ]);
    return combineTransactionHistory(transactions, requests);
  }

  async getTransactionsByAccountIdentifier(
    identifier: string,
    currentUser: AuthUser,
    pagination?: TransactionHistoryQuery,
  ): Promise<TransactionHistoryEntry[] | PaginatedTransactionHistory> {
    const numericId = /^\d+$/.test(identifier) ? Number(identifier) : null;
    const user = await this.userRepository.findOne({
      where: numericId === null ? { uniqueId: identifier } : { id: numericId },
    });
    if (!user) throw new NotFoundException("User or agent not found");
    return this.getTransactionsByUserId(user.id, currentUser, pagination);
  }

  async getTransactionsByAgentId(
    agentId: number,
    currentUser: AuthUser,
    pagination?: TransactionHistoryQuery,
  ): Promise<TransactionHistoryEntry[] | PaginatedTransactionHistory> {
    if (
      currentUser.type !== UserType.SUPERADMIN &&
      currentUser.type !== "admin"
    ) {
      throw new ForbiddenException(
        "Only administrators can view an agent transaction history",
      );
    }

    const agent = await this.userRepository.findOne({
      where: { id: agentId, type: UserType.AGENT },
    });
    if (!agent) throw new NotFoundException("Agent not found");

    const assignedUsers = await this.userRepository.find({
      where: { agentId, type: UserType.USER },
      select: { id: true, name: true, uniqueId: true, type: true },
    });
    if (!assignedUsers.length) {
      return pagination
        ? { data: [], page: pagination.page, limit: pagination.limit, total: 0 }
        : [];
    }

    const userIds = assignedUsers.map((user) => user.id);
    if (pagination) {
      const result = await this.getTransactionHistoryPage(userIds, pagination);
      const userById = new Map(assignedUsers.map((user) => [user.id, user]));
      result.data = result.data.map((entry) => ({
        ...entry,
        user: userById.get(entry.userId),
      }));
      return result;
    }

    const [transactions, requests] = await Promise.all([
      this.transactionRepository.find({
        where: { userId: In(userIds) },
        relations: { wallet: true, request: true },
        order: { createdAt: "DESC" },
      }),
      this.walletRequestRepository.find({
        where: { userId: In(userIds), status: In(["ACCEPTED", "REJECTED"]) },
        relations: { actions: true },
        order: { updatedAt: "DESC" },
      }),
    ]);

    const userById = new Map(assignedUsers.map((user) => [user.id, user]));
    return combineTransactionHistory(transactions, requests).map((entry) => ({
      ...entry,
      user: userById.get(Number(entry.userId)),
    }));
  }

  private async getTransactionHistoryPage(
    userIds: number[],
    pagination: TransactionHistoryQuery,
  ): Promise<PaginatedTransactionHistory> {
    const { page, limit, search, type } = pagination;
    const rowsToRead = page * limit;

    const transactionsQuery = this.transactionRepository
      .createQueryBuilder("transaction")
      .leftJoinAndSelect("transaction.wallet", "wallet")
      .leftJoinAndSelect("transaction.request", "request")
      .leftJoin("transaction.user", "user")
      .addSelect(["user.id", "user.name", "user.uniqueId", "user.type"])
      .where("transaction.userId IN (:...userIds)", { userIds });

    if (type) {
      transactionsQuery.andWhere("transaction.type = :type", { type });
    }
    if (search) {
      const searchPattern = `%${search}%`;
      transactionsQuery.andWhere(
        `(
          CAST(transaction.id AS text) ILIKE :search OR
          CAST(transaction.userId AS text) ILIKE :search OR
          CAST(transaction.requestId AS text) ILIKE :search OR
          CAST(transaction.type AS text) ILIKE :search OR
          CAST(transaction.source AS text) ILIKE :search OR
          CAST(transaction.amount AS text) ILIKE :search OR
          CAST(transaction.balanceBefore AS text) ILIKE :search OR
          CAST(transaction.balanceAfter AS text) ILIKE :search OR
          CAST(transaction.createdAt AS text) ILIKE :search OR
          COALESCE(transaction.description, '') ILIKE :search OR
          COALESCE(user.name, '') ILIKE :search OR
          COALESCE(user.uniqueId, '') ILIKE :search OR
          CAST(COALESCE(request.status, 'COMPLETED') AS text) ILIKE :search
        )`,
        { search: searchPattern },
      );
    }

    const requestsQuery = this.walletRequestRepository
      .createQueryBuilder("walletRequest")
      .leftJoinAndSelect("walletRequest.actions", "action")
      .innerJoin("walletRequest.user", "requestUser")
      .addSelect([
        "requestUser.id",
        "requestUser.name",
        "requestUser.uniqueId",
        "requestUser.type",
      ])
      .where("walletRequest.userId IN (:...userIds)", { userIds })
      .andWhere("walletRequest.status IN (:...statuses)", {
        statuses: [WalletRequestStatus.ACCEPTED, WalletRequestStatus.REJECTED],
      })
      .andWhere(
        "NOT EXISTS (SELECT 1 FROM transactions historyTransaction WHERE historyTransaction.request_id = walletRequest.id)",
      );

    if (type) {
      requestsQuery.andWhere("walletRequest.type = :requestType", {
        requestType: type === "CREDIT" ? "ADD_POINTS" : "WITHDRAW",
      });
    }
    if (search) {
      const searchPattern = `%${search}%`;
      requestsQuery.andWhere(
        `(
          CAST(walletRequest.id AS text) ILIKE :search OR
          CAST(walletRequest.userId AS text) ILIKE :search OR
          CAST(walletRequest.type AS text) ILIKE :search OR
          CAST(walletRequest.amount AS text) ILIKE :search OR
          CAST(walletRequest.status AS text) ILIKE :search OR
          CAST(walletRequest.createdAt AS text) ILIKE :search OR
          CAST(walletRequest.updatedAt AS text) ILIKE :search OR
          COALESCE(requestUser.name, '') ILIKE :search OR
          COALESCE(requestUser.uniqueId, '') ILIKE :search OR
          CAST(action.balanceBefore AS text) ILIKE :search OR
          CAST(action.balanceAfter AS text) ILIKE :search
        )`,
        { search: searchPattern },
      );
    }

    const [[transactions, transactionCount], [requests, requestCount]] =
      await Promise.all([
        transactionsQuery
          .orderBy("transaction.createdAt", "DESC")
          .addOrderBy("transaction.id", "DESC")
          .take(rowsToRead)
          .getManyAndCount(),
        requestsQuery
          .orderBy("walletRequest.updatedAt", "DESC")
          .addOrderBy("walletRequest.id", "DESC")
          .take(rowsToRead)
          .getManyAndCount(),
      ]);

    const data = combineTransactionHistory(transactions, requests).slice(
      (page - 1) * limit,
      page * limit,
    );
    return {
      data,
      page,
      limit,
      total: transactionCount + requestCount,
    };
  }

  async getTransactionById(id: number): Promise<Transaction | null> {
    return this.transactionRepository.findOne({
      where: { id },
      relations: { wallet: true, request: true },
    });
  }
}
