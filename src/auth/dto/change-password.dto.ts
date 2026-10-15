import { IsString, Matches } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @Matches(/^(?=.*[A-Z])(?=.*[a-z])(?=(?:.*\d){4})[A-Za-z\d]{6}$/, {
    message: 'Password must be exactly 6 characters: 1 uppercase letter, 1 lowercase letter, and 4 digits.',
  })
  newPassword: string;
}
