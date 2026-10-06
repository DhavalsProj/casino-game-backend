import { IsEnum, IsNotEmpty, IsNumberString, IsOptional } from 'class-validator';
import { WalletRequestType } from '../entities/wallet.request.entity';

export class CreateWalletRequestDto {
  @IsNotEmpty()
  userId: number;

  @IsNotEmpty()
  @IsNumberString()
  amount: string;

  @IsOptional()
  @IsEnum(WalletRequestType)
  type?: WalletRequestType;
}
