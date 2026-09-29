import {IsNotEmpty } from 'class-validator';

export class CreateWalletDto {
  @IsNotEmpty()
  points: string;

  @IsNotEmpty()
  userId: number;
}