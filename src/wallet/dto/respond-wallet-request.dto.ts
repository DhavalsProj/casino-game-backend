import { IsIn } from 'class-validator';

export class RespondWalletRequestDto {
  @IsIn(['ACCEPTED', 'REJECTED'])
  action: 'ACCEPTED' | 'REJECTED';
}
