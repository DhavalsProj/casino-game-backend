import * as bcrypt from 'bcrypt';
import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('generates a strong random password and hashes that same value', async () => {
    const password = service.generateRandomPassword();
    const passwordHash = await service.hashPassword(password);

    expect(password).toHaveLength(14);
    expect(password).toMatch(/[A-Z]/);
    expect(password).toMatch(/[a-z]/);
    expect(password).toMatch(/[2-9]/);
    expect(password).toMatch(/[@#$%&*!?]/);
    await expect(bcrypt.compare(password, passwordHash)).resolves.toBe(true);
  });

  it('rejects a password length too short to include every character class', () => {
    expect(() => service.generateRandomPassword(3)).toThrow();
  });
});
