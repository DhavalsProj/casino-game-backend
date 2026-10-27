import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

const RETENTION_TABLES = ['api_logs', '"LoginAudit"'] as const;
const RETENTION_DAYS_CONFIG = 'API_LOG_RETENTION_DAYS';
const DEFAULT_RETENTION_DAYS = 15;
const DELETE_BATCH_SIZE = 1000;
const CLEANUP_LOCK_ID = '74302856452015';
const DAILY_CLEANUP_HOUR_UTC = 2;

@Injectable()
export class ApiLogRetentionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ApiLogRetentionService.name);
  private readonly retentionDays: number;
  private cleanupTimer?: NodeJS.Timeout;
  private cleanupRunning = false;

  constructor(
    private readonly dataSource: DataSource,
    config: ConfigService,
  ) {
    const configuredDays = config.get<string>(RETENTION_DAYS_CONFIG);
    if (configuredDays === undefined) {
      this.retentionDays = DEFAULT_RETENTION_DAYS;
    } else if (/^[1-9]\d*$/.test(configuredDays)) {
      this.retentionDays = Number(configuredDays);
      if (!Number.isSafeInteger(this.retentionDays)) {
        throw new Error(`${RETENTION_DAYS_CONFIG} must be a positive integer`);
      }
    } else {
      throw new Error(`${RETENTION_DAYS_CONFIG} must be a positive integer`);
    }
  }

  onModuleInit(): void {
    this.scheduleNextCleanup();
    void this.cleanupAndLog();
  }

  onModuleDestroy(): void {
    if (this.cleanupTimer) clearTimeout(this.cleanupTimer);
  }

  async cleanupExpiredLogs(): Promise<void> {
    if (this.cleanupRunning) return;
    this.cleanupRunning = true;

    let connectionEstablished = false;
    let lockAcquired = false;
    const runner = this.dataSource.createQueryRunner();

    try {
      await runner.connect();
      connectionEstablished = true;

      const lockRows = (await runner.query(
        'SELECT pg_try_advisory_lock($1::bigint) AS locked',
        [CLEANUP_LOCK_ID],
      )) as Array<{ locked: boolean }>;
      lockAcquired = lockRows[0]?.locked === true;
      if (!lockAcquired) return;

      let totalDeleted = 0;
      for (const table of RETENTION_TABLES) {
        let deletedInBatch: number;
        do {
          const deletedRows = (await runner.query(
            `WITH expired AS (
               SELECT id
               FROM ${table}
               WHERE created_at < CURRENT_TIMESTAMP - ($1 * INTERVAL '1 day')
               ORDER BY created_at ASC, id ASC
               LIMIT $2
               FOR UPDATE SKIP LOCKED
             )
             DELETE FROM ${table} AS log
             USING expired
             WHERE log.id = expired.id
             RETURNING log.id`,
            [this.retentionDays, DELETE_BATCH_SIZE],
          )) as Array<{ id: string }>;
          deletedInBatch = deletedRows.length;
          totalDeleted += deletedInBatch;
        } while (deletedInBatch === DELETE_BATCH_SIZE);
      }

      if (totalDeleted > 0) {
        this.logger.log(
          `Deleted ${totalDeleted} application log record(s) older than ${this.retentionDays} days`,
        );
      }
    } finally {
      try {
        if (connectionEstablished) {
          try {
            if (lockAcquired) {
              await runner.query(
                'SELECT pg_advisory_unlock($1::bigint)',
                [CLEANUP_LOCK_ID],
              );
            }
          } finally {
            await runner.release();
          }
        }
      } finally {
        this.cleanupRunning = false;
      }
    }
  }

  private async runScheduledCleanup(): Promise<void> {
    try {
      await this.cleanupAndLog();
    } finally {
      this.scheduleNextCleanup();
    }
  }

  private async cleanupAndLog(): Promise<void> {
    try {
      await this.cleanupExpiredLogs();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Application log cleanup failed: ${message}`, stack);
    }
  }

  private scheduleNextCleanup(): void {
    const now = new Date();
    const nextRun = new Date(now);
    nextRun.setUTCHours(DAILY_CLEANUP_HOUR_UTC, 0, 0, 0);
    if (nextRun.getTime() <= now.getTime()) {
      nextRun.setUTCDate(nextRun.getUTCDate() + 1);
    }

    this.cleanupTimer = setTimeout(
      () => void this.runScheduledCleanup(),
      nextRun.getTime() - now.getTime(),
    );
    this.cleanupTimer.unref();
  }
}
