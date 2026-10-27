import { Module } from '@nestjs/common';
import { SkillsModule } from '../skills/skills.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { CharactersModule } from '../characters/characters.module.js';
import { EconomyModule } from '../economy/economy.module.js';
import { JobsController } from './jobs.controller.js';
import { JobsService } from './jobs.service.js';
import { JobsRateGuard } from './jobs-rate.guard.js';
@Module({
  imports: [AuthModule, CharactersModule, EconomyModule, SkillsModule],
  controllers: [JobsController],
  providers: [JobsService, JobsRateGuard],
})
export class JobsModule {}
