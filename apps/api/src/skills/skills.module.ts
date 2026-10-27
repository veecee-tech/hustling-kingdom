import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { EconomyModule } from '../economy/economy.module.js';
import { SkillsService } from './skills.service.js';
import { SkillsController } from './skills.controller.js';
@Module({
  imports: [AuthModule, EconomyModule],
  providers: [SkillsService],
  controllers: [SkillsController],
  exports: [SkillsService],
})
export class SkillsModule {}
