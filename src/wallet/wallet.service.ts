import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Wallet } from './entities/wallet.entity';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { AuthUser } from '../auth/auth-user';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
  ) {}

  async create(
  walletDto: CreateWalletDto,
  currentUser: AuthUser,
): Promise<Wallet> {
  const existingWallet = await this.walletRepository.findOne({
    where: {
      userId: walletDto.userId,
    },
  });

  if (existingWallet) {
    var balance = Number(existingWallet.balance) + Number(walletDto.points);

    existingWallet.balance = balance.toString();
    existingWallet.updatedBy = currentUser.id;

    return this.walletRepository.save(existingWallet);
  }

  const wallet = this.walletRepository.create({
    userId: walletDto.userId,
    balance: walletDto.points,
    createdBy: currentUser.id,
    updatedBy: currentUser.id,
  });

  return this.walletRepository.save(wallet);
}

  async getWalletByUserId(userId: number): Promise<Wallet | null> {
    return this.walletRepository.findOne({
      where: { userId },
    });
  }
}