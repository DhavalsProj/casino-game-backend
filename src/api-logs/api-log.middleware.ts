import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { ApiLogService } from './api-log.service';
import { limitLogPayload } from './api-log-sanitizer';

type AuthenticatedRequest = Request & {
  user?: { id?: number; type?: string };
};

@Injectable()
export class ApiLogMiddleware implements NestMiddleware {
  private readonly logger = new Logger(ApiLogMiddleware.name);

  constructor(private readonly apiLogService: ApiLogService) {}

  use(request: AuthenticatedRequest, response: Response, next: NextFunction): void {
    const suppliedId = request.header('x-request-id');
    const requestId = suppliedId && /^[a-zA-Z0-9._:-]{1,64}$/.test(suppliedId)
      ? suppliedId
      : randomUUID();
    response.setHeader('x-request-id', requestId);

    const startedAt = Date.now();
    let responseBody: unknown = null;
    const originalJson = response.json.bind(response);
    const originalSend = response.send.bind(response);

    response.json = ((body: unknown) => {
      responseBody = body;
      return originalJson(body);
    }) as Response['json'];

    response.send = ((body?: unknown) => {
      if (responseBody === null || responseBody === undefined) {
        responseBody = this.parseResponseBody(body, response.getHeader('content-type'));
      }
      return originalSend(body as never);
    }) as Response['send'];

    response.once('finish', () => {
      const authUser = request.user;
      const safeHeaders: Record<string, string> = {};
      for (const name of ['content-type', 'user-agent', 'origin', 'x-request-id']) {
        const value = request.header(name);
        if (value) safeHeaders[name] = value;
      }

      void this.apiLogService.record({
        requestId,
        method: request.method,
        path: request.path,
        statusCode: response.statusCode,
        durationMs: Math.max(0, Date.now() - startedAt),
        userId: typeof authUser?.id === 'number' ? authUser.id : null,
        userType: authUser?.type ?? null,
        ipAddress: request.ip?.slice(0, 45) ?? null,
        userAgent: request.header('user-agent')?.slice(0, 500) ?? null,
        requestHeaders: safeHeaders,
        requestQuery: limitLogPayload(request.query) as Record<string, unknown>,
        requestBody: request.body ?? null,
        responseBody,
      }).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Could not record request ${requestId}: ${message}`);
      });
    });

    next();
  }

  private parseResponseBody(body: unknown, contentType: string | number | string[] | undefined): unknown {
    if (typeof body !== 'string') return body ?? null;
    const contentTypeValue = Array.isArray(contentType) ? contentType[0] : contentType;
    if (typeof contentTypeValue === 'string' && contentTypeValue.includes('application/json')) {
      try {
        return JSON.parse(body) as unknown;
      } catch {
        return body;
      }
    }
    return body;
  }
}
