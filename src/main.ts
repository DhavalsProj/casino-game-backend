import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: (
      requestOrigin: string | undefined,
      callback: (error: Error | null, allowed?: boolean) => void,
    ) => {
      const configuredOrigin = process.env.FRONTEND_URL ?? 'http://localhost:4200';
      const isDevelopmentOrigin =
        process.env.NODE_ENV !== 'production' &&
        !!requestOrigin &&
        /^https?:\/\/localhost:\d+$/.test(requestOrigin);

      if (!requestOrigin || requestOrigin === configuredOrigin || isDevelopmentOrigin) {
        callback(null, true);
        return;
      }

      callback(new Error('Origin not allowed by CORS'));
    },
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  await app.listen(Number(process.env.PORT ?? 3000));
}
bootstrap();