import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { GithubModule } from '../github/github.module'
import { ReleaseNotesController } from './release-notes.controller'
import { ReleaseNotesService } from './release-notes.service'
import { ReleasesController } from './releases.controller'
import { ReleasesService } from './releases.service'

@Module({
    // AuthModule exports GithubTokenService (the user's GitHub token),
    // GithubModule exports GithubService (git context for the notes).
    imports: [AuthModule, GithubModule],
    controllers: [ReleasesController, ReleaseNotesController],
    providers: [ReleasesService, ReleaseNotesService],
})
export class ReleasesModule { }
