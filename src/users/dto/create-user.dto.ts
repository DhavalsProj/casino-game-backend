import {IsNotEmpty, IsMobilePhone, ValidateIf, IsString } from 'class-validator';

export class CreateUserDto {
  @IsNotEmpty()
  name: string;

  @IsMobilePhone('en-IN')
  mobile: string;

  @IsNotEmpty()
  type: string;

  @ValidateIf((o) => o.type === 'user')
  @IsString()
  @IsNotEmpty()
  agentId?: string;
}