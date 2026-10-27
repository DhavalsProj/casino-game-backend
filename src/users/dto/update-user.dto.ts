import { IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength, Min } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @Matches(/^[6-9]\d{9}$/, {
    message: 'Mobile number must be exactly 10 digits and start with 6, 7, 8, or 9',
  })
  mobile?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  agentId?: number | null;
}
