import {
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from '../users/entities/user.entity';
import { LoginUserDto } from './dto/login-user.dto';

@Injectable()
export class AuthService {
  constructor(
      @InjectRepository(User)
      private readonly userRepository: Repository<User>,
    ) {}

    async login(loginUserDto: LoginUserDto) {
        const user = await this.userRepository.findOne({
            where: {
                mobile: loginUserDto.mobile,
            },
        });

        if (!user) {
            throw new NotFoundException('User does not exists');
        }

        const isPasswordValid = await bcrypt.compare(
            loginUserDto.password,
            user.password,
        );

        if (!isPasswordValid) {
            throw new ConflictException('Email or password is incorrect');
        }

        return user;
    }
}
