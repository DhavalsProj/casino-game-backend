import { Injectable } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class PasswordService {
  private readonly rounds = 12;
  private readonly uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  private readonly lowercase = 'abcdefghijkmnopqrstuvwxyz';
  private readonly digits = '23456789';

  generateRandomPassword(length = 6): string {
    if (length !== 6) {
      throw new Error('Password length must be exactly 6 characters');
    }

    const password = [
      this.pick(this.uppercase),
      this.pick(this.lowercase),
      this.pick(this.digits),
      this.pick(this.digits),
      this.pick(this.digits),
      this.pick(this.digits),
    ];

    // Fisher-Yates with crypto.randomInt avoids biased or predictable ordering.
    for (let index = password.length - 1; index > 0; index--) {
      const swapIndex = randomInt(index + 1);
      [password[index], password[swapIndex]] = [password[swapIndex], password[index]];
    }
    return password.join('');
  }

  hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.rounds);
  }

  isValidPassword(password: string): boolean {
    return /^(?=.*[A-Z])(?=.*[a-z])(?=(?:.*\d){4})[A-Za-z\d]{6}$/.test(password);
  }

  private pick(characters: string): string {
    return characters[randomInt(characters.length)];
  }
}
