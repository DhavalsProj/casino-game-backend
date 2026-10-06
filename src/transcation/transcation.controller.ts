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
import { TranscationService } from './transcation.service';

@Controller(['transcation', 'transactions'])
export class TranscationController {
  constructor(private readonly transcationService: TranscationService) {}

  @Get(':userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superadmin', 'admin', 'agent', 'user')
  getTransactionsByUserId(
    @Param('userId', ParseIntPipe) userId: number,
    @CurrentUser() currentUser: any,
  ) {
    return this.transcationService.getTransactionsByUserId(userId);
  }
}
