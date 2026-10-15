import { IsEnum, IsInt, IsMobilePhone, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { UserType } from '../entities/user.entity';

export class CreateUserDto {
  @IsNotEmpty()
  name: string;

  @IsMobilePhone('en-IN')
  mobile: string;

  @IsOptional()
  @IsEnum(UserType)
  type?: UserType;

  @IsOptional()
  @IsInt()
  @Min(1)
  agentId?: number;
}
