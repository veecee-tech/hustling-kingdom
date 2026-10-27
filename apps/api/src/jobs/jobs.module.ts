import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CharactersModule } from '../characters/characters.module.js';
import { EconomyModule } from '../economy/economy.module.js';
import { JobsController } from './jobs.controller.js';
import { JobsService } from './jobs.service.js';
import { JobsRateGuard } from './jobs-rate.guard.js';
@Module({
  imports: [AuthModule, CharactersModule, EconomyModule],
  controllers: [JobsController],
  providers: [JobsService, JobsRateGuard],
})
export class JobsModule {}
