import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { NoDbAuthController, NoDbUsersController } from './no-db.controller';
import { NoDbAuthGuard } from './no-db-auth.guard';
import { NoDbService } from './no-db.service';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'development-secret-change-me'),
        signOptions: { expiresIn: '1h' },
      }),
    }),
  ],
  controllers: [NoDbAuthController, NoDbUsersController],
  providers: [NoDbService, NoDbAuthGuard],
})
export class NoDbModule {}
