import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { SystemCredential } from '../auth/entities/system-credential.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, SystemCredential]), AuthModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
