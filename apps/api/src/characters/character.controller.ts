import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiHeader,
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
import { ErrorEnvelopeDto } from '../common/error.dto.js';
import { CharacterService } from './character.service.js';
import {
  AppearancePatchDto,
  CharacterDto,
  CreateCharacterDto,
} from './character.dto.js';

@ApiTags('Characters')
@ApiBearerAuth()
@ApiResponse({
  status: 400,
  type: ErrorEnvelopeDto,
  description: 'VALIDATION_ERROR or INVALID_APPEARANCE',
})
@ApiResponse({
  status: 401,
  type: ErrorEnvelopeDto,
  description: 'UNAUTHORIZED',
})
@ApiResponse({
  status: 404,
  type: ErrorEnvelopeDto,
  description: 'CHARACTER_REQUIRED',
})
@UseGuards(AccessGuard)
@Controller('characters')
export class CharacterController {
  constructor(
    @Inject(CharacterService) private readonly characters: CharacterService,
  ) {}

  @Post()
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', pattern: '^[A-Za-z0-9_-]{8,128}$' },
  })
  @ApiCreatedResponse({
    type: CharacterDto,
    description:
      'Creates identity and stats only. Exact retries return the original creation result.',
  })
  @ApiResponse({
    status: 409,
    type: ErrorEnvelopeDto,
    description: 'CHARACTER_ALREADY_EXISTS or IDEMPOTENCY_CONFLICT',
  })
  create(
    @CurrentAccount() account: Principal,
    @Headers('idempotency-key') key: string | undefined,
    @Body() input: CreateCharacterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CharacterDto> {
    res.setHeader('Cache-Control', 'no-store');
    return this.characters.create(
      account.user.id,
      account.familyId,
      key,
      input,
    );
  }

  @Get('me')
  @ApiOkResponse({ type: CharacterDto })
  own(
    @CurrentAccount() account: Principal,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CharacterDto> {
    res.setHeader('Cache-Control', 'no-store');
    return this.characters.own(account.user.id);
  }

  @Patch('me/appearance')
  @ApiBody({
    type: AppearancePatchDto,
    description:
      'Nonempty partial cosmetic object; omitted categories are preserved. Unknown keys and null values rejected.',
  })
  @ApiOkResponse({ type: CharacterDto })
  appearance(
    @CurrentAccount() account: Principal,
    @Body() input: unknown,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CharacterDto> {
    res.setHeader('Cache-Control', 'no-store');
    return this.characters.updateAppearance(
      account.user.id,
      account.familyId,
      input,
    );
  }
}
