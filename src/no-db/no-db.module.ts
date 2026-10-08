import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { NoDbAuthController, NoDbUsersController } from './no-db.controller';
import { NoDbAuthGuard } from './no-db-auth.guard';
import { NoDbService } from './no-db.service';
import { PasswordService } from '../auth/password.service';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: (() => {
          const secret = config.get<string>('JWT_SECRET');
          if (process.env.NODE_ENV === 'production' && !secret) {
            throw new Error('JWT_SECRET is required in production');
          }
          return secret ?? 'development-secret-change-me';
        })(),
        signOptions: { expiresIn: '1h' },
      }),
    }),
  ],
  controllers: [NoDbAuthController, NoDbUsersController],
  providers: [NoDbService, NoDbAuthGuard, PasswordService],
})
export class NoDbModule {}
