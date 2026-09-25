import { IsMobilePhone, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LoginUserDto {
  @IsOptional()
  @IsMobilePhone('en-IN')
  mobile?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  identifier?: string;

  @IsNotEmpty()
  password: string;
}