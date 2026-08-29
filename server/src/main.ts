import { setDefaultResultOrder } from 'node:dns';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

// Node 18+ changed the default DNS resolution order, which on Windows
// often tries IPv6 first and causes EAI_AGAIN errors. Force IPv4 first.
setDefaultResultOrder('ipv4first');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Let the Next.js client (a different origin) call this API from the browser.
  // Without this, the browser blocks every request from localhost:3000.
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
