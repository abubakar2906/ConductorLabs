import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { GithubModule } from './github/github.module';
import { ReleasesModule } from './releases/releases.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot(),
    AuthModule,
    GithubModule,
    ReleasesModule,
    WebhooksModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }