import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { verifyToken } from '@clerk/backend';
import { Observable } from 'rxjs';

@Injectable()
export class ClerkGuard implements CanActivate {
    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const token = request.headers.authorization?.split(' ')[1];

        if (!token) throw new UnauthorizedException();

        try {
            const payload = await verifyToken(token, {
                secretKey: process.env.CLERK_SECRET_KEY,
            });
            request.auth = payload;
            return true;
        } catch (error) {
            throw new UnauthorizedException();
        }
    }
}