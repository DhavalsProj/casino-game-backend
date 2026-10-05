import {IsNotEmpty, IsEnum } from 'class-validator';
import { UserType } from '../../users/entities/user.entity';

export class CreateWalletDto {
  @IsNotEmpty()
  points: string;

  @IsNotEmpty()
  userId: number;
}