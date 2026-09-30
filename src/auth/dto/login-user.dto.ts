import {
  IsMobilePhone,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class LoginUserDto {
  // Existing mobile-based login
  @IsOptional()
  @IsMobilePhone('en-IN')
  mobile?: string;

  // Existing identifier-based login
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  identifier?: string;

  // Teammate's login ID
  @IsOptional()
  @IsString()
  id?: string;

  // Common password field
  @IsNotEmpty()
  @IsString()
  password: string;
}