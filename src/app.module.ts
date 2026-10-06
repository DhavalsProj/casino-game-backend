import { config as loadEnv } from 'dotenv';

loadEnv();

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { WalletModule } from './wallet/wallet.module';
import { NoDbModule } from './no-db/no-db.module';
import { TranscationModule } from './transcation/transcation.module';

const databaseEnabled = process.env.DB_ENABLED === 'true';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    ...(databaseEnabled
      ? [
          TypeOrmModule.forRootAsync({
            inject: [ConfigService],

            useFactory: (config: ConfigService) => ({
              type: 'postgres' as const,

              host: config.get<string>('DB_HOST', 'localhost'),

              port: Number(config.get<string>('DB_PORT', '5432')),

              username: config.get<string>('DB_USERNAME', 'postgres'),

              password: config.get<string>('DB_PASSWORD', ''),

              database: config.get<string>('DB_NAME', 'CasinoGameDB'),

              autoLoadEntities: true,

              synchronize:
                config.get<string>('DB_SYNCHRONIZE', 'false') === 'true',
            }),
          }),

          UsersModule,
          AuthModule,
          WalletModule,
          TranscationModule,
        ]
      : [NoDbModule]),
  ],

  controllers: [AppController],

  providers: [AppService],
})
export class AppModule {}