import {
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';

import { User } from '../users/entities/user.entity';
import { LoginUserDto } from './dto/login-user.dto';

@Injectable()
export class AuthService {
  constructor(
      @InjectRepository(User)
      private readonly userRepository: Repository<User>,
      private readonly jwtService: JwtService,
    ) {}

    async login(loginUserDto: LoginUserDto) {

      // Get user from database
      const user = await this.findUserByUniqueId(loginUserDto.id);

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Compare password
      const isPasswordValid = await bcrypt.compare(
        loginUserDto.password,
        user.password,
      );

      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid mobile or password');
      }

      // JWT payload
      const payload = {
          sub: user.id,
          uniqueId: user.uniqueId,
      };

      // Generate token
      const accessToken = await this.jwtService.signAsync(payload);

      return {
        accessToken,
        user: {
            id: user.id,
            mobile: user.uniqueId,
        },
      };
    }

    private async findUserByUniqueId(id: string): Promise<User | null> {
        return this.userRepository.findOne({
            where: {
                uniqueId: id,
            },
        });
    }
}
