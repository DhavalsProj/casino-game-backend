import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';
import { WalletRequestType } from '../entities/wallet.request.entity';

export class CreateWalletRequestDto {
  @Type(() => Number)
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  userId: number;

  @Type(() => String)
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d+(?:\.\d{1,2})?$/)
  amount: string;

  @IsOptional()
  @IsEnum(WalletRequestType)
  type?: WalletRequestType;
}
