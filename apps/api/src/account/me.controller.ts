import { Controller, Get, Inject, Res, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import {
  AccessGuard,
  CurrentAccount,
  type Principal,
} from '../auth/auth.guards.js';
import { MeDto } from '../auth/auth.dto.js';
import { ErrorEnvelopeDto } from '../common/error.dto.js';
import { CharacterService } from '../characters/character.service.js';

@ApiTags('Account')
@ApiBearerAuth()
@ApiResponse({
  status: 401,
  type: ErrorEnvelopeDto,
  description: 'UNAUTHORIZED',
})
@Controller('me')
@UseGuards(AccessGuard)
export class MeController {
  constructor(
    @Inject(CharacterService) private readonly characters: CharacterService,
  ) {}
  @Get()
  @ApiOkResponse({ type: MeDto })
  async me(
    @CurrentAccount() principal: Principal,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MeDto> {
    res.setHeader('Cache-Control', 'no-store');
    return {
      user: principal.user,
      character: await this.characters.find(principal.user.id),
    };
  }
}
