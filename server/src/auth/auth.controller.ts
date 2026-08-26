import { Controller, Get, Req, UseGuards } from '@nestjs/common'
import { ClerkGuard } from './clerk.guard'

@Controller('auth')

export class AuthController {
    @Get('me')
    @UseGuards(ClerkGuard)
    getMe(@Req() req: any) {
        return req.auth
    }
}