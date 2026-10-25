import { ArrayUnique, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { ResultMode } from '../entities/fun-target.entity';

export class UpdateFunTargetConfigDto {
  @IsOptional() @IsString() gameName?: string;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) minBet?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(5000) maxBet?: number;
  @IsOptional() @IsIn([ResultMode.MANUAL, ResultMode.RANDOM]) resultMode?: ResultMode;
  @IsOptional() @IsBoolean() jokerEnabled?: boolean;
  @IsOptional() @IsArray() @ArrayUnique() @IsInt({ each: true }) @IsIn([1, 5, 10, 50, 100, 500, 1000, 5000], { each: true }) denominations?: number[];
  @IsOptional() @IsInt() @Min(1) jokerMultiplier?: number;
  @IsOptional() @IsInt() @Min(1) jokerFrequency?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100) adminSharePercent?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100) winningAllocationPercent?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}
export class CreateRoundDto { @IsDateString() scheduledAt: string; }
export class ManualResultDto { @IsOptional() @IsInt() @Min(1) @Max(9) winningNumber?: number; }
export class JokerScheduleDto { @IsInt() @Min(1) roundId: number; @IsInt() @Min(1) multiplier: number; }
export class CreateBetDto {
  @IsInt() @Min(1) roundId: number;
  @IsInt() @Min(1) @Max(9) number: number;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) amount: number;
  @IsString() idempotencyKey: string;
}
