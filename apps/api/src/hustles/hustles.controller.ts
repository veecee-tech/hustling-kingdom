import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
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
import { HustlesService } from './hustles.service.js';
import { HustlesRateGuard } from './hustles-rate.guard.js';
import {
  AttemptIntentDto,
  AttemptsQueryDto,
  HustleCatalogDto,
  HustleHistoryDto,
  HustleAttemptDto,
  HustleResultDto,
} from './hustles.dto.js';
const actor = (a: Principal) => ({ userId: a.user.id, familyId: a.familyId });
@ApiTags('Hustles')
@ApiBearerAuth()
@UseGuards(AccessGuard)
@Controller('hustles')
@ApiResponse({
  status: 400,
  type: ErrorEnvelopeDto,
  description: 'VALIDATION_ERROR',
})
@ApiResponse({ status: 401, type: ErrorEnvelopeDto })
@ApiResponse({
  status: 404,
  type: ErrorEnvelopeDto,
  description: 'CHARACTER_REQUIRED, HUSTLE_NOT_FOUND, HUSTLE_ATTEMPT_NOT_FOUND',
})
@ApiResponse({
  status: 409,
  type: ErrorEnvelopeDto,
  description:
    'HUSTLE_DISABLED, HUSTLE_REQUIREMENTS_NOT_MET, HUSTLE_NOT_READY, INSUFFICIENT_ENERGY, INSUFFICIENT_FUNDS, IDEMPOTENCY_CONFLICT',
})
@ApiResponse({ status: 429, type: ErrorEnvelopeDto })
@ApiResponse({ status: 503, type: ErrorEnvelopeDto })
export class HustlesController {
  constructor(
    @Inject(HustlesService) private readonly hustles: HustlesService,
  ) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: HustleCatalogDto })
  catalog(@CurrentAccount() a: Principal, @Query(EmptyBodyPipe) q: unknown) {
    void q;
    return this.hustles.catalog(actor(a));
  }
  @Get('history')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: HustleHistoryDto })
  history(@CurrentAccount() a: Principal, @Query() q: AttemptsQueryDto) {
    return this.hustles.history(actor(a), q.limit, q.cursor);
  }
  @Get('attempts/:id')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: HustleAttemptDto })
  own(
    @CurrentAccount() a: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query(EmptyBodyPipe) q: unknown,
  ) {
    void q;
    return this.hustles.ownAttempt(actor(a), id);
  }
  @Post(':id/attempt')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @UseGuards(HustlesRateGuard)
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', pattern: '^[A-Za-z0-9_-]{8,128}$' },
  })
  @ApiOkResponse({
    type: HustleResultDto,
    description:
      'Immediate atomic resolution. Retries return the original result; no separate resolve action exists.',
  })
  attempt(
    @CurrentAccount() a: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() intent: AttemptIntentDto,
    @Headers('idempotency-key') key: string | undefined,
    @Query(EmptyBodyPipe) q: unknown,
  ) {
    void q;
    return this.hustles.attempt(actor(a), id, intent.attemptId, key);
  }
}
