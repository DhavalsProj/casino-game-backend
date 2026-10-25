import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthUser } from '../auth/auth-user';
import { TranscationService } from './transcation.service';

@Controller(['transcation', 'transactions'])
export class TranscationController {
  constructor(private readonly transcationService: TranscationService) {}

  @Get('agent/:agentId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superadmin', 'admin')
  getTransactionsByAgentId(
    @Param('agentId', ParseIntPipe) agentId: number,
    @CurrentUser() currentUser: AuthUser,
  ) {
    return this.transcationService.getTransactionsByAgentId(agentId, currentUser);
  }

  @Get(':userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superadmin', 'agent', 'user')
  getTransactionsByUserId(
    @Param('userId') userId: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    return this.transcationService.getTransactionsByAccountIdentifier(
      userId,
      currentUser,
    );
  }
}
