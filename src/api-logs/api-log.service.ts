import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiLog } from './entities/api-log.entity';
import { limitLogPayload } from './api-log-sanitizer';

export interface NewApiLog {
  requestId: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  userId: number | null;
  userType: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  requestHeaders: Record<string, string>;
  requestQuery: Record<string, unknown>;
  requestBody: unknown;
  responseBody: unknown;
}

export interface ApiLogFilters {
  page: number;
  limit: number;
  statusCode?: number;
  method?: string;
  userId?: number;
  search?: string;
}

@Injectable()
export class ApiLogService {
  private readonly logger = new Logger(ApiLogService.name);

  constructor(
    @InjectRepository(ApiLog)
    private readonly repository: Repository<ApiLog>,
  ) {}

  async record(entry: NewApiLog): Promise<void> {
    try {
      await this.repository.save(
        this.repository.create({
          ...entry,
          requestBody: limitLogPayload(entry.requestBody),
          responseBody: limitLogPayload(entry.responseBody),
          requestQuery: limitLogPayload(entry.requestQuery) as Record<string, unknown>,
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Could not persist API log ${entry.requestId}: ${message}`);
    }
  }

  async list(filters: ApiLogFilters) {
    const query = this.repository.createQueryBuilder('log');
    if (filters.statusCode !== undefined) {
      query.andWhere('log.statusCode = :statusCode', { statusCode: filters.statusCode });
    }
    if (filters.method) {
      query.andWhere('log.method = :method', { method: filters.method.toUpperCase() });
    }
    if (filters.userId !== undefined) {
      query.andWhere('log.userId = :userId', { userId: filters.userId });
    }
    if (filters.search) {
      query.andWhere(
        '(log.path ILIKE :search OR log.requestId ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    const [data, total] = await query
      .orderBy('log.createdAt', 'DESC')
      .addOrderBy('log.id', 'DESC')
      .skip((filters.page - 1) * filters.limit)
      .take(filters.limit)
      .getManyAndCount();

    return { data, page: filters.page, limit: filters.limit, total };
  }

  async getById(id: string): Promise<ApiLog> {
    const log = await this.repository.findOne({ where: { id } });
    if (!log) throw new NotFoundException('API log not found');
    return log;
  }
}
