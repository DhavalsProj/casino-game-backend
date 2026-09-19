import { IsNotEmpty, IsMobilePhone } from 'class-validator';

export class LoginUserDto {
  @IsMobilePhone('en-IN')
  mobile: string;

  @IsNotEmpty()
  password: string;
}