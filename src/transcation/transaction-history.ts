import type { User } from "../users/entities/user.entity";
import type { Wallet } from "../wallet/entities/wallet.entity";
import {
  WalletRequest,
  WalletRequestStatus,
  WalletRequestType,
} from "../wallet/entities/wallet.request.entity";
import {
  Transaction,
  WalletBalanceBucket,
  WalletTransactionSource,
  WalletTransactionType,
} from "./entities/transcation.entity";

export interface TransactionHistoryEntry {
  id: number | string;
  userId: number;
  walletId: number;
  requestId: number | null;
  type: WalletTransactionType | WalletRequestType;
  source: WalletTransactionSource | "WALLET_REQUEST";
  balanceBucket?: WalletBalanceBucket;
  amount: string;
  balanceBefore: string | null;
  balanceAfter: string | null;
  description?: string | null;
  createdAt: Date;
  status: WalletRequestStatus | "COMPLETED";
  recordType: "WALLET_TRANSACTION" | "WALLET_REQUEST";
  submittedAt?: Date;
  request?: WalletRequest | null;
  wallet?: Wallet | null;
  user?: Pick<User, "id" | "name" | "uniqueId" | "type">;
}

export interface PaginatedTransactionHistory {
  data: TransactionHistoryEntry[];
  page: number;
  limit: number;
  total: number;
}

export interface TransactionHistoryQuery {
  page: number;
  limit: number;
  search?: string;
  type?: "CREDIT" | "DEBIT";
}

/** Combines wallet movements with resolved requests without inventing a balance movement. */
export function combineTransactionHistory(
  transactions: Transaction[],
  requests: WalletRequest[],
): TransactionHistoryEntry[] {
  const requestById = new Map(requests.map((request) => [request.id, request]));
  const entries: TransactionHistoryEntry[] = transactions.map((transaction) => {
    const request = transaction.requestId
      ? (requestById.get(transaction.requestId) ?? transaction.request)
      : transaction.request;
    return {
      ...transaction,
      recordType: "WALLET_TRANSACTION",
      status: request?.status ?? "COMPLETED",
      request,
    };
  });

  const representedRequestIds = new Set(
    transactions
      .map((transaction) => transaction.requestId)
      .filter((id): id is number => id !== null),
  );
  for (const request of requests) {
    if (representedRequestIds.has(request.id)) continue;
    entries.push({
      id: `request-${request.id}`,
      requestId: request.id,
      userId: request.userId,
      walletId: request.walletId,
      type: request.type,
      source: "WALLET_REQUEST",
      amount: request.amount,
      balanceBefore:
        request.actions?.find((action) => action.action === "REJECTED")
          ?.balanceBefore ?? null,
      balanceAfter:
        request.actions?.find((action) => action.action === "REJECTED")
          ?.balanceAfter ?? null,
      status: request.status,
      recordType: "WALLET_REQUEST",
      createdAt: request.updatedAt,
      submittedAt: request.createdAt,
      request,
    });
  }

  return entries.sort((a, b) => {
    const dateDifference =
      new Date(String(b.createdAt)).getTime() -
      new Date(String(a.createdAt)).getTime();
    return (
      dateDifference ||
      String(b.id).localeCompare(String(a.id), undefined, { numeric: true })
    );
  });
}
