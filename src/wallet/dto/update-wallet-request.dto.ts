import { Type } from 'class-transformer';
import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { WalletRequestType } from '../entities/wallet.request.entity';

export class UpdateWalletRequestDto {
  @IsOptional()
  @Type(() => String)
  @IsString()
  @Matches(/^\d+(?:\.\d{1,2})?$/)
  amount?: string;

  @IsOptional()
  @IsEnum(WalletRequestType)
  type?: WalletRequestType;
}
