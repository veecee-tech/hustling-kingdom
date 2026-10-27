import {
  Controller,
  Get,
  Header,
  Inject,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  AccessGuard,
  CurrentAccount,
  type Principal,
} from '../auth/auth.guards.js';
import { EmptyBodyPipe } from '../auth/empty-body.pipe.js';
import { ErrorEnvelopeDto } from '../common/error.dto.js';
import { SkillsService } from './skills.service.js';
import { SkillsDto } from './skills.dto.js';
@ApiTags('Skills')
@ApiBearerAuth()
@UseGuards(AccessGuard)
@Controller('skills')
@ApiResponse({ status: 401, type: ErrorEnvelopeDto })
@ApiResponse({ status: 400, type: ErrorEnvelopeDto })
@ApiResponse({
  status: 404,
  type: ErrorEnvelopeDto,
  description: 'CHARACTER_REQUIRED',
})
export class SkillsController {
  constructor(@Inject(SkillsService) private readonly skills: SkillsService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: SkillsDto })
  own(
    @CurrentAccount() account: Principal,
    @Query(EmptyBodyPipe) query: unknown,
  ) {
    void query;
    return this.skills.own({
      userId: account.user.id,
      familyId: account.familyId,
    });
  }
  @Get('catalog')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({
    type: SkillsDto,
    description:
      'The six definitions with own progression and current opportunities.',
  })
  catalog(
    @CurrentAccount() account: Principal,
    @Query(EmptyBodyPipe) query: unknown,
  ) {
    return this.own(account, query);
  }
}
