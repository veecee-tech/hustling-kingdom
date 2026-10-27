import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CharactersModule } from '../characters/characters.module.js';
import { EconomyModule } from '../economy/economy.module.js';
import { SkillsModule } from '../skills/skills.module.js';
import { HustlesService } from './hustles.service.js';
import { HustlesController } from './hustles.controller.js';
import { HustlesRateGuard } from './hustles-rate.guard.js';
import { RandomService } from './random.service.js';
@Module({
  imports: [AuthModule, CharactersModule, EconomyModule, SkillsModule],
  providers: [HustlesService, HustlesRateGuard, RandomService],
  controllers: [HustlesController],
})
export class HustlesModule {}
