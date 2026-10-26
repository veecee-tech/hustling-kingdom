import {
  Body,
  Controller,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiHeader,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiResponse,
  ApiTags,
  ApiBody,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { parseCookie } from 'cookie';
import { AppConfig } from '../config/config.module.js';
import { ErrorEnvelopeDto } from '../common/error.dto.js';
import { PublicHttpError } from '../common/error.filter.js';
import { AuthService } from './auth.service.js';
import {
  AccessGuard,
  AuthCsrfGuard,
  AuthRateGuard,
  CurrentAccount,
  type Principal,
} from './auth.guards.js';
import { LoginDto, RegisterDto, SessionDto } from './auth.dto.js';
import { EmptyBodyPipe } from './empty-body.pipe.js';

export const REFRESH_COOKIE = 'hk_refresh';
const cookiePath = '/api/v1/auth';
const refreshCookie = (req: Request): string | undefined =>
  parseCookie(req.headers.cookie ?? '')[REFRESH_COOKIE];

@ApiTags('Authentication')
@ApiHeader({
  name: 'X-HK-Client',
  required: true,
  schema: { type: 'string', enum: ['web'] },
  description:
    'CSRF defense: browser requests also require the configured Origin.',
})
@ApiResponse({
  status: 400,
  type: ErrorEnvelopeDto,
  description: 'VALIDATION_ERROR',
})
@ApiResponse({
  status: 401,
  type: ErrorEnvelopeDto,
  description: 'Invalid credentials, session or access token.',
})
@ApiResponse({
  status: 403,
  type: ErrorEnvelopeDto,
  description: 'FORBIDDEN origin.',
})
@ApiResponse({
  status: 429,
  type: ErrorEnvelopeDto,
  description: 'RATE_LIMITED',
})
@Controller('auth')
@UseGuards(AuthCsrfGuard, AuthRateGuard)
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(AppConfig) private readonly config: AppConfig,
  ) {}
  private cookieOptions() {
    return {
      httpOnly: true,
      secure: this.config.values.nodeEnv === 'production',
      sameSite: 'strict' as const,
      path: cookiePath,
    };
  }
  private respond(
    res: Response,
    result: Awaited<ReturnType<AuthService['register']>>,
  ): SessionDto {
    res.setHeader('Cache-Control', 'no-store');
    res.cookie(REFRESH_COOKIE, result.refreshToken, {
      ...this.cookieOptions(),
      expires: result.refreshExpiresAt,
    });
    return {
      user: result.user,
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
    };
  }
  private clear(res: Response): void {
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
    res.setHeader('Cache-Control', 'no-store');
  }

  @Post('register')
  @ApiCreatedResponse({
    type: SessionDto,
    description:
      'Account only. Sets HttpOnly refresh cookie; no character or wallet is created.',
  })
  @ApiResponse({
    status: 409,
    type: ErrorEnvelopeDto,
    description: 'EMAIL_ALREADY_EXISTS or USERNAME_ALREADY_EXISTS',
  })
  async register(
    @Body() input: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionDto> {
    return this.respond(res, await this.auth.register(input));
  }

  @Post('login')
  @HttpCode(200)
  @ApiOkResponse({ type: SessionDto })
  async login(
    @Body() input: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionDto> {
    return this.respond(res, await this.auth.login(input));
  }

  @Post('refresh')
  @ApiBody({
    required: false,
    schema: { type: 'object', additionalProperties: false },
  })
  @HttpCode(200)
  @ApiCookieAuth()
  @ApiOkResponse({
    type: SessionDto,
    description:
      'Rotates the refresh cookie. Reuse revokes its session family.',
  })
  async refresh(
    @Body(new EmptyBodyPipe()) _input: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionDto> {
    try {
      return this.respond(res, await this.auth.refresh(refreshCookie(req)));
    } catch (error) {
      if (error instanceof PublicHttpError && error.getStatus() === 401)
        this.clear(res);
      throw error;
    }
  }

  @Post('logout')
  @ApiBody({
    required: false,
    schema: { type: 'object', additionalProperties: false },
  })
  @HttpCode(204)
  @ApiCookieAuth()
  @ApiNoContentResponse({
    description: 'Current session revoked; cookie cleared. Idempotent.',
  })
  async logout(
    @Body(new EmptyBodyPipe()) _input: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logout(refreshCookie(req));
    this.clear(res);
  }

  @Post('logout-all')
  @ApiBody({
    required: false,
    schema: { type: 'object', additionalProperties: false },
  })
  @HttpCode(204)
  @ApiBearerAuth()
  @UseGuards(AccessGuard)
  @ApiNoContentResponse({
    description: 'All sessions for the authenticated account revoked.',
  })
  async logoutAll(
    @Body(new EmptyBodyPipe()) _input: unknown,
    @CurrentAccount() principal: Principal,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logoutAll(principal.user.id);
    this.clear(res);
  }
}
