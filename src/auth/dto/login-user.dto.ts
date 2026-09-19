import { IsNotEmpty, IsMobilePhone } from 'class-validator';

export class LoginUserDto {
  @IsMobilePhone('en-IN')
  id: string;

  @IsNotEmpty()
  password: string;
}