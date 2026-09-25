import { IsEnum, IsMobilePhone, IsNotEmpty, IsString, ValidateIf } from 'class-validator';
import { UserType } from '../entities/user.entity';

export class CreateUserDto {
  @IsNotEmpty()
  name: string;

  @IsMobilePhone('en-IN')
  mobile: string;

  @IsEnum(UserType)
  type: UserType;

  @ValidateIf((o) => o.type === UserType.USER)
  @IsString()
  @IsNotEmpty()
  agentId?: string;
}