import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, Matches, Min } from 'class-validator';

export class CreateWalletDto {
  @Type(() => String)
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d+(?:\.\d{1,2})?$/)
  points: string;

  @Type(() => Number)
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  userId: number;
}