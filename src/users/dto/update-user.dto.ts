import { IsInt, IsMobilePhone, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength, Min } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsMobilePhone('en-IN')
  mobile?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  agentId?: number | null;
}
