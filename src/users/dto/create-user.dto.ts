import { IsEnum, IsMobilePhone, IsNotEmpty, IsOptional, IsString } from 'class-validator';
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
  @IsString()
  @IsNotEmpty()
  agentId?: string;
}