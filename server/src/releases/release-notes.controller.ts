import {
    BadRequestException,
    Body,
    Controller,
    NotFoundException,
    Param,
    Post,
    Put,
    Req,
    UseGuards,
} from '@nestjs/common'
import { ClerkGuard } from '../auth/clerk.guard'
import { ReleaseNotesService } from './release-notes.service'

// AI release-notes routes, mounted under /releases/:id/release-notes.
// ClerkGuard on the whole controller; the service re-checks ownership.
@UseGuards(ClerkGuard)
@Controller('releases')
export class ReleaseNotesController {
    constructor(private readonly notes: ReleaseNotesService) { }

    // POST /releases/:id/release-notes → generate (or reuse cached) notes.
    // Body: { force?: boolean } — force skips the tip cache and rewrites.
    @Post(':id/release-notes')
    generate(@Req() req: any, @Param('id') id: string, @Body() body: { force?: boolean }) {
        return this.notes.generate(req.auth.sub, id, body?.force === true)
    }

    // PUT /releases/:id/release-notes → save a hand-edited Markdown draft.
    // Body: { markdown: string }
    @Put(':id/release-notes')
    save(@Req() req: any, @Param('id') id: string, @Body() body: { markdown?: string }) {
        const markdown = typeof body?.markdown === 'string' ? body.markdown.trim() : ''
        if (!markdown) throw new BadRequestException('markdown is required')
        return this.notes.saveEdited(req.auth.sub, id, markdown)
    }
}
