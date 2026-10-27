import { IsEnum, IsInt, IsNotEmpty, IsOptional, Matches, Min } from 'class-validator';
import { UserType } from '../entities/user.entity';

export class CreateUserDto {
  @IsNotEmpty()
  name: string;

  @Matches(/^[6-9]\d{9}$/, {
    message: 'Mobile number must be exactly 10 digits and start with 6, 7, 8, or 9',
  })
  mobile: string;

  @IsOptional()
  @IsEnum(UserType)
  type?: UserType;

  @IsOptional()
  @IsInt()
  @Min(1)
  agentId?: number;
}
