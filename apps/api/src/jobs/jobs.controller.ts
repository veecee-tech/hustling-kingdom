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
  ApiBody,
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
import { JobsService } from './jobs.service.js';
import { JobsRateGuard } from './jobs-rate.guard.js';
import {
  ActiveJobDto,
  AssignmentDto,
  CatalogDto,
  CompletionDto,
  DashboardDto,
} from './jobs.dto.js';
const actor = (account: Principal) => ({
  userId: account.user.id,
  familyId: account.familyId,
});
@ApiTags('Jobs')
@ApiBearerAuth()
@ApiResponse({
  status: 400,
  type: ErrorEnvelopeDto,
  description:
    'VALIDATION_ERROR: empty body/query, UUID and Idempotency-Key required.',
})
@ApiResponse({
  status: 401,
  type: ErrorEnvelopeDto,
  description: 'UNAUTHORIZED',
})
@ApiResponse({
  status: 404,
  type: ErrorEnvelopeDto,
  description: 'CHARACTER_REQUIRED, JOB_NOT_FOUND or JOB_ASSIGNMENT_NOT_FOUND',
})
@ApiResponse({
  status: 409,
  type: ErrorEnvelopeDto,
  description:
    'JOB_ALREADY_ACTIVE, JOB_REQUIREMENTS_NOT_MET, JOB_DISABLED, REPUTATION_REQUIRED, INSUFFICIENT_ENERGY, JOB_NOT_READY, JOB_NOT_ACTIVE or IDEMPOTENCY_CONFLICT',
})
@ApiResponse({
  status: 429,
  type: ErrorEnvelopeDto,
  description: 'RATE_LIMITED: 60 work mutations/account/minute.',
})
@ApiResponse({
  status: 503,
  type: ErrorEnvelopeDto,
  description: 'SERVICE_UNAVAILABLE',
})
@UseGuards(AccessGuard)
@Controller()
export class JobsController {
  constructor(@Inject(JobsService) private readonly jobs: JobsService) {}
  @Get('jobs')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: CatalogDto })
  catalog(
    @CurrentAccount() account: Principal,
    @Query(EmptyBodyPipe) _query: unknown,
  ) {
    void _query;
    return this.jobs.catalog(actor(account));
  }
  @Get('jobs/active')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: ActiveJobDto })
  active(
    @CurrentAccount() account: Principal,
    @Query(EmptyBodyPipe) _query: unknown,
  ) {
    void _query;
    return this.jobs.active(actor(account));
  }
  @Get('dashboard')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({
    type: DashboardDto,
    description: 'Phase 4 aggregate: character, wallet and work state only.',
  })
  dashboard(
    @CurrentAccount() account: Principal,
    @Query(EmptyBodyPipe) _query: unknown,
  ) {
    void _query;
    return this.jobs.dashboard(actor(account));
  }
  @Post('jobs/:jobId/start')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @UseGuards(JobsRateGuard)
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', pattern: '^[A-Za-z0-9_-]{8,128}$' },
  })
  @ApiBody({
    schema: { type: 'object', additionalProperties: false, properties: {} },
    required: false,
  })
  @ApiOkResponse({ type: AssignmentDto })
  start(
    @CurrentAccount() account: Principal,
    @Param('jobId', new ParseUUIDPipe()) id: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body(EmptyBodyPipe) _body: unknown,
    @Query(EmptyBodyPipe) _query: unknown,
  ) {
    void _body;
    void _query;
    return this.jobs.start(actor(account), id, key);
  }
  @Post('jobs/assignments/:assignmentId/complete')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @UseGuards(JobsRateGuard)
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', pattern: '^[A-Za-z0-9_-]{8,128}$' },
  })
  @ApiBody({
    schema: { type: 'object', additionalProperties: false, properties: {} },
    required: false,
  })
  @ApiOkResponse({
    type: CompletionDto,
    description:
      'Atomic salary and energy result. Retries return original completion.',
  })
  complete(
    @CurrentAccount() account: Principal,
    @Param('assignmentId', new ParseUUIDPipe()) id: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body(EmptyBodyPipe) _body: unknown,
    @Query(EmptyBodyPipe) _query: unknown,
  ) {
    void _body;
    void _query;
    return this.jobs.complete(actor(account), id, key);
  }
}
