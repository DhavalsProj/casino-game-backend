import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Wallet } from './entities/wallet.entity';
import { CreateWalletDto } from './dto/create-wallet.dto';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
  ) {}

  async create(walletDto: CreateWalletDto): Promise<Wallet> {
    const wallet = this.walletRepository.create({
      userId: walletDto.userId,
      balance: walletDto.points,
    });

    return this.walletRepository.save(wallet);
  }

  async getWalletByUserId(userId: number): Promise<Wallet | null> {
    return this.walletRepository.findOne({
      where: { userId },
    });
  }
}