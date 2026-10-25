import * as bcrypt from 'bcrypt';
import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('generates a six-character password with exactly four digits and hashes that value', async () => {
    const password = service.generateRandomPassword();
    const passwordHash = await service.hashPassword(password);

    expect(password).toHaveLength(6);
    expect(password).toMatch(/^(?=(?:.*\d){4})[A-Za-z\d]{6}$/);
    expect((password.match(/[0-9]/g) ?? []).length).toBe(4);
    expect((password.match(/[A-Z]/g) ?? []).length).toBe(1);
    expect((password.match(/[a-z]/g) ?? []).length).toBe(1);
    await expect(bcrypt.compare(password, passwordHash)).resolves.toBe(true);
  });

  it('rejects a password length too short to include every character class', () => {
    expect(() => service.generateRandomPassword(3)).toThrow();
  });
});
