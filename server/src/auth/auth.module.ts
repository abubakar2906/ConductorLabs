import { Module } from '@nestjs/common'
import { AuthController } from './auth.controller'
import { GithubTokenService } from './github-token.service'

@Module({
    controllers: [AuthController],
    providers: [GithubTokenService],
    exports: [GithubTokenService],
})

export class AuthModule { }
