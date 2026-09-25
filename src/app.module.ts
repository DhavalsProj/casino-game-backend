import dotenv from 'dotenv';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { NoDbModule } from './no-db/no-db.module';

dotenv.config();

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
              type: 'mssql' as const,

              host: config.get<string>('DB_HOST', 'localhost'),

              port: Number(
                config.get<string>('DB_PORT', '1433'),
              ),

              username: config.get<string>('DB_USERNAME', 'casino_app'),

              password: config.get<string>('DB_PASSWORD', ''),

              database: config.get<string>(
                'DB_NAME',
                'CasinoGameDB',
              ),

              options: {
                encrypt:
                  config.get<string>(
                    'DB_ENCRYPT',
                    'false',
                  ) === 'true',

                trustServerCertificate:
                  config.get<string>(
                    'DB_TRUST_SERVER_CERTIFICATE',
                    'true',
                  ) === 'true',
              },

              autoLoadEntities: true,

              synchronize:
                config.get<string>('DB_SYNCHRONIZE', 'false') ===
                'true',
            }),
          }),

          UsersModule,
          AuthModule,
        ]
      : [NoDbModule]),
  ],

  controllers: [AppController],

  providers: [AppService],
})
export class AppModule {}