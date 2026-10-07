import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateWalletRequestDto } from './create-wallet-request.dto';

describe('CreateWalletRequestDto', () => {
  it('accepts frontend numeric IDs and decimal amounts', async () => {
    const dto = plainToInstance(CreateWalletRequestDto, {
      userId: '42',
      amount: 10.25,
      type: 'ADD_POINTS',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto).toMatchObject({
      userId: 42,
      amount: '10.25',
      type: 'ADD_POINTS',
    });
  });

  it('rejects amounts with more than two decimal places', async () => {
    const dto = plainToInstance(CreateWalletRequestDto, {
      userId: 42,
      amount: '10.255',
    });

    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toContain('amount');
  });
});
