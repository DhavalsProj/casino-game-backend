import { Transaction } from './entities/transcation.entity';
import { WalletRequest } from '../wallet/entities/wallet.request.entity';

export type TransactionHistoryEntry = Record<string, unknown>;

/** Combines wallet movements with resolved requests without inventing a balance movement. */
export function combineTransactionHistory(
  transactions: Transaction[],
  requests: WalletRequest[],
): TransactionHistoryEntry[] {
  const requestById = new Map(requests.map((request) => [request.id, request]));
  const entries: TransactionHistoryEntry[] = transactions.map((transaction) => {
    const request = transaction.requestId
      ? requestById.get(transaction.requestId) ?? transaction.request
      : transaction.request;
    return {
      ...transaction,
      recordType: 'WALLET_TRANSACTION',
      status: request?.status ?? 'COMPLETED',
      request,
    };
  });

  const representedRequestIds = new Set(
    transactions.map((transaction) => transaction.requestId).filter((id): id is number => id !== null),
  );
  for (const request of requests) {
    if (representedRequestIds.has(request.id)) continue;
    entries.push({
      id: `request-${request.id}`,
      requestId: request.id,
      userId: request.userId,
      walletId: request.walletId,
      type: request.type,
      source: 'WALLET_REQUEST',
      amount: request.amount,
      balanceBefore: request.actions?.find((action) => action.action === 'REJECTED')?.balanceBefore ?? null,
      balanceAfter: request.actions?.find((action) => action.action === 'REJECTED')?.balanceAfter ?? null,
      status: request.status,
      recordType: 'WALLET_REQUEST',
      createdAt: request.updatedAt,
      submittedAt: request.createdAt,
      request,
    });
  }

  return entries.sort(
    (a, b) => new Date(String(b.createdAt)).getTime() - new Date(String(a.createdAt)).getTime(),
  );
}
