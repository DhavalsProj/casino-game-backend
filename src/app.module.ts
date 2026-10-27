import { config as loadEnv } from "dotenv";

loadEnv();

import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";

import { UsersModule } from "./users/users.module";
import { AuthModule } from "./auth/auth.module";
import { WalletModule } from "./wallet/wallet.module";
import { NoDbModule } from "./no-db/no-db.module";
import { TranscationModule } from "./transcation/transcation.module";
import { FunTargetModule } from "./fun-target/fun-target.module";
import { ApiLogsModule } from "./api-logs/api-logs.module";

const databaseEnabled = process.env.DB_ENABLED === "true";

if (process.env.NODE_ENV === "production" && !databaseEnabled) {
  throw new Error(
    "DB_ENABLED=true is required in production; the in-memory fallback is for local development only.",
  );
}

if (
  process.env.NODE_ENV === "production" &&
  process.env.DB_SYNCHRONIZE === "true"
) {
  throw new Error(
    "DB_SYNCHRONIZE must be disabled in production; apply database migrations explicitly.",
  );
}

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
              type: "postgres" as const,

              host: config.get<string>("DB_HOST", "localhost"),

              port: Number(config.get<string>("DB_PORT", "5432")),

              username: config.get<string>("DB_USERNAME", "postgres"),

              password: config.get<string>("DB_PASSWORD", ""),

              database: config.get<string>("DB_NAME", "CasinoGameDB"),

              autoLoadEntities: true,

              synchronize:
                config.get<string>("DB_SYNCHRONIZE", "false") === "true",
            }),
          }),

          UsersModule,
          AuthModule,
          WalletModule,
          TranscationModule,
          FunTargetModule,
          ApiLogsModule,
        ]
      : [NoDbModule]),
  ],

  controllers: [AppController],

  providers: [AppService],
})
export class AppModule {}
