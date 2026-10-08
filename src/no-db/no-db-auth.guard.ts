import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

@Injectable()
export class NoDbAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: unknown }>();
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) throw new UnauthorizedException('Authentication is required');
    try {
      const payload = await this.jwtService.verifyAsync<{ id?: number; sub?: number; type?: string; uniqueId?: string; agentId?: string | null } & Record<string, unknown>>(token);
      const id = payload.id ?? payload.sub;
      if (!Number.isSafeInteger(id) || !['superadmin', 'admin', 'agent', 'user'].includes(payload.type ?? '') ||
          (payload.type === 'agent' && !(payload.agentId ?? payload.uniqueId))) {
        throw new Error('Invalid authentication claims');
      }
      request.user = { ...payload, id };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
