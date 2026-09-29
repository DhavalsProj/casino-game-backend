import { Body, Controller, Get, Post, Param } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { CreateWalletDto } from './dto/create-wallet.dto';

@Controller('wallet')
export class WalletController {
    constructor(private readonly walletService: WalletService) {}

    @Post('create')
    create(@Body() createWalletDto: CreateWalletDto) {
        return this.walletService.create(createWalletDto);
    }

    @Get('wallet/:userId')
    getWalletByUserId(@Param('userId') userId: number) {
        return this.walletService.getWalletByUserId(userId);
    }
}
