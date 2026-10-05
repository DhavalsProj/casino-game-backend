import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

import { WalletService } from './wallet.service';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Post('create')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superadmin', 'admin', 'agent')
  create(@Body() createWalletDto: CreateWalletDto, @CurrentUser() currentUser: any) {
    return this.walletService.create(createWalletDto, currentUser);
  }

  @Get('wallet/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superadmin', 'admin', 'agent')
  getWalletByUserId(
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.walletService.getWalletByUserId(userId);
  }
}