import { Injectable } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class PasswordService {
  private readonly rounds = 12;
  private readonly uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  private readonly lowercase = 'abcdefghijkmnopqrstuvwxyz';
  private readonly digits = '23456789';
  private readonly symbols = '@#$%&*!?';
  private readonly alphabet = `${this.uppercase}${this.lowercase}${this.digits}${this.symbols}`;

  generateRandomPassword(length = 14): string {
    if (!Number.isInteger(length) || length < 4) {
      throw new Error('Password length must be an integer of at least 4');
    }

    const password = [
      this.pick(this.uppercase),
      this.pick(this.lowercase),
      this.pick(this.digits),
      this.pick(this.symbols),
    ];
    while (password.length < length) {
      password.push(this.pick(this.alphabet));
    }

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

  private pick(characters: string): string {
    return characters[randomInt(characters.length)];
  }
}
