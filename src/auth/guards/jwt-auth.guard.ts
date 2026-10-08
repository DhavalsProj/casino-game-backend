import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import type { AuthUser } from '../auth-user';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');

    if (!token) {
      throw new UnauthorizedException('Authentication is required');
    }

    try {
      const payload = await this.jwtService.verifyAsync<AuthUser & { sub?: number }>(token);
      const id = payload.id ?? payload.sub;
      if (!Number.isSafeInteger(id) || !['superadmin', 'admin', 'agent', 'user'].includes(payload.type) ||
          (payload.type === 'agent' && !(payload.agentId ?? payload.uniqueId))) {
        throw new Error('Invalid authentication claims');
      }
      request.user = { ...payload, id: id as number };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}