import { IsIn } from 'class-validator';

export class RespondWalletRequestDto {
  @IsIn(['ACCEPT', 'REJECT'])
  action: 'ACCEPT' | 'REJECT';
}
