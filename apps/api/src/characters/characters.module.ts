import { CharacterStatsService } from './character-stats.service.js';
import { Module } from '@nestjs/common';
import { EconomyModule } from '../economy/economy.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { MeController } from '../account/me.controller.js';
import { CharacterController } from './character.controller.js';
import { CharacterService } from './character.service.js';

@Module({
  imports: [AuthModule, EconomyModule],
  controllers: [CharacterController, MeController],
  providers: [CharacterService, CharacterStatsService],
  exports: [CharacterService, CharacterStatsService],
})
export class CharactersModule {}
