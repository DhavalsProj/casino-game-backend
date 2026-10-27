import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ApiLog } from './entities/api-log.entity';
import { ApiLogService } from './api-log.service';
import { ApiLogMiddleware } from './api-log.middleware';
import { ApiLogsController } from './api-logs.controller';
import { ApiLogRetentionService } from './api-log-retention.service';

@Module({
  imports: [TypeOrmModule.forFeature([ApiLog]), AuthModule],
  controllers: [ApiLogsController],
  providers: [ApiLogService, ApiLogMiddleware, ApiLogRetentionService],
})
export class ApiLogsModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(ApiLogMiddleware).forRoutes('*');
  }
}
