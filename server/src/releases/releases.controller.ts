import {
    Body,
    Controller,
    Get,
    NotFoundException,
    Param,
    Post,
    Req,
    UseGuards,
} from '@nestjs/common'
import { ClerkGuard } from '../auth/clerk.guard'
import { ReleasesService, type CreateReleaseInput } from './releases.service'

// Every route here requires a logged-in user (ClerkGuard on the whole controller).
@Controller('releases')
@UseGuards(ClerkGuard)
export class ReleasesController {
    constructor(private readonly releases: ReleasesService) { }

    // GET /releases → this user's saved releases.
    @Get()
    list(@Req() req: any) {
        return this.releases.listForUser(req.auth.sub)
    }

    // GET /releases/:id → one release (404 if it isn't this user's).
    @Get(':id')
    async getOne(@Req() req: any, @Param('id') id: string) {
        const release = await this.releases.getByIdForUser(req.auth.sub, id)
        if (!release) throw new NotFoundException('Release not found')
        return release
    }

    // POST /releases → save a new release for this user.
    @Post()
    create(@Req() req: any, @Body() body: CreateReleaseInput) {
        return this.releases.create(req.auth.sub, body)
    }
}
