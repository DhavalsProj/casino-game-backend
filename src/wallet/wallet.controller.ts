import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthUser } from '../auth/auth-user';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { CreateWalletRequestDto } from './dto/create-wallet-request.dto';
import { WalletService } from './wallet.service';

@Controller(['wallet', 'wallets'])
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Post('create')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superadmin', 'admin', 'agent')
  create(
    @Body() createWalletDto: CreateWalletDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    return this.walletService.create(createWalletDto, currentUser);
  }

  @Post('request')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superadmin', 'admin', 'agent', 'user')
  createWalletRequest(
    @Body() createWalletRequestDto: CreateWalletRequestDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    return this.walletService.createWalletRequest(createWalletRequestDto, currentUser);
  }

  @Get('requests/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superadmin', 'admin', 'agent', 'user')
  getWalletRequestsForUser(
    @Param('userId', ParseIntPipe) userId: number,
    @CurrentUser() currentUser: AuthUser,
  ) {
    return this.walletService.getWalletRequestsForUser(userId, currentUser);
  }

  @Patch('requests/:requestId/accept')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superadmin', 'admin', 'agent', 'user')
  acceptWalletRequest(
    @Param('requestId', ParseIntPipe) requestId: number,
    @CurrentUser() currentUser: AuthUser,
  ) {
    return this.walletService.acceptWalletRequest(requestId, currentUser);
  }

  @Patch('requests/:requestId/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superadmin', 'admin', 'agent', 'user')
  rejectWalletRequest(
    @Param('requestId', ParseIntPipe) requestId: number,
    @CurrentUser() currentUser: AuthUser,
  ) {
    return this.walletService.rejectWalletRequest(requestId, currentUser);
  }

  @Get('wallet/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superadmin', 'admin', 'agent', 'user')
  getWalletByUserIdLegacy(
    @Param('userId', ParseIntPipe) userId: number,
    @CurrentUser() currentUser: AuthUser,
  ) {
    return this.walletService.getWalletByUserId(userId, currentUser);
  }

  @Get(':userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superadmin', 'admin', 'agent', 'user')
  getWalletByUserId(
    @Param('userId', ParseIntPipe) userId: number,
    @CurrentUser() currentUser: AuthUser,
  ) {
    return this.walletService.getWalletByUserId(userId, currentUser);
  }

  @Get(':userId/transactions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superadmin', 'admin', 'agent', 'user')
  getTransactionsByUserId(
    @Param('userId', ParseIntPipe) userId: number,
    @CurrentUser() currentUser: AuthUser,
  ) {
    return this.walletService.getTransactionsByUserId(userId, currentUser);
  }
}
