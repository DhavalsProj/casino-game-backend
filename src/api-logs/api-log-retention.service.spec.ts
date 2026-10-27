import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { jest } from '@jest/globals';
import { ApiLogRetentionService } from './api-log-retention.service';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('ApiLogRetentionService', () => {
  let service: ApiLogRetentionService;
  let query: jest.Mock;
  let release: jest.Mock;
  let logs: Record<string, Array<{ id: string; createdAt: Date }>>;

  async function createService(retentionDays?: string): Promise<void> {
    const now = new Date('2026-10-27T12:00:00.000Z').getTime();
    logs = {
      api_logs: [],
      '"LoginAudit"': [],
    };
    query = jest.fn(async (sql: string, parameters: unknown[] = []) => {
      if (sql.includes('pg_try_advisory_lock')) return [{ locked: true }];
      if (sql.includes('pg_advisory_unlock')) return [{ unlocked: true }];

      const table = sql.includes('FROM api_logs') ? 'api_logs' : '"LoginAudit"';
      const cutoff = now - Number(parameters[0]) * DAY_MS;
      const batchSize = Number(parameters[1]);
      const expired = logs[table]
        .filter((record) => record.createdAt.getTime() < cutoff)
        .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
        .slice(0, batchSize);
      const expiredIds = new Set(expired.map((record) => record.id));
      logs[table] = logs[table].filter((record) => !expiredIds.has(record.id));
      return expired.map(({ id }) => ({ id }));
    });
    release = jest.fn(async () => undefined);
    const runner = {
      connect: jest.fn(async () => undefined),
      query,
      release,
    };
    const dataSource = {
      createQueryRunner: jest.fn(() => runner),
    };
    const config = {
      get: jest.fn(() => retentionDays),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiLogRetentionService,
        { provide: DataSource, useValue: dataSource },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    service = module.get(ApiLogRetentionService);
  }

  it('removes expired API and login logs in batches and retains the 15-day boundary', async () => {
    await createService();
    const now = new Date('2026-10-27T12:00:00.000Z').getTime();
    logs.api_logs = Array.from({ length: 1001 }, (_, index) => ({
      id: `old-${index}`,
      createdAt: new Date(now - 16 * DAY_MS),
    }));
    logs.api_logs.push(
      { id: 'boundary', createdAt: new Date(now - 15 * DAY_MS) },
      { id: 'recent', createdAt: new Date(now - 14 * DAY_MS) },
    );
    logs['"LoginAudit"'] = [
      { id: 'old-login', createdAt: new Date(now - 20 * DAY_MS) },
      { id: 'recent-login', createdAt: new Date(now - 2 * DAY_MS) },
    ];

    await service.cleanupExpiredLogs();

    expect(logs.api_logs.map(({ id }) => id)).toEqual(['boundary', 'recent']);
    expect(logs['"LoginAudit"'].map(({ id }) => id)).toEqual(['recent-login']);
    const deletionQueries = query.mock.calls.filter(([sql]) =>
      String(sql).includes('WITH expired AS'),
    );
    expect(deletionQueries).toHaveLength(3);
    expect(deletionQueries.every(([, parameters]) => parameters[0] === 15)).toBe(true);
    expect(deletionQueries.every(([sql]) => String(sql).includes('created_at < CURRENT_TIMESTAMP'))).toBe(true);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('uses the configured retention period', async () => {
    await createService('30');

    await service.cleanupExpiredLogs();

    const deletionQueries = query.mock.calls.filter(([sql]) =>
      String(sql).includes('WITH expired AS'),
    );
    expect(deletionQueries).toHaveLength(2);
    expect(deletionQueries.every(([, parameters]) => parameters[0] === 30)).toBe(true);
  });

  it('does not delete logs when another instance holds the advisory lock', async () => {
    await createService();
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('pg_try_advisory_lock')) return [{ locked: false }];
      return [];
    });

    await service.cleanupExpiredLogs();

    expect(query.mock.calls.some(([sql]) => String(sql).includes('WITH expired AS'))).toBe(false);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('rejects a non-positive or invalid retention period', async () => {
    await expect(createService('0')).rejects.toThrow(
      'API_LOG_RETENTION_DAYS must be a positive integer',
    );
  });
});
