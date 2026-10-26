import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
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
import { EconomyService } from './economy.service.js';
import { requireKey } from './economy.rules.js';
import {
  HistoryQueryDto,
  MoneyMoveDto,
  WalletDto,
  WalletHistoryDto,
} from './wallet.dto.js';
import { WalletRateGuard } from './wallet-rate.guard.js';
@ApiTags('Wallet')
@ApiBearerAuth()
@ApiResponse({
  status: 400,
  type: ErrorEnvelopeDto,
  description:
    'VALIDATION_ERROR or INVALID_AMOUNT. Money is a positive decimal string.',
})
@ApiResponse({
  status: 401,
  type: ErrorEnvelopeDto,
  description: 'UNAUTHORIZED',
})
@ApiResponse({
  status: 404,
  type: ErrorEnvelopeDto,
  description: 'CHARACTER_REQUIRED or WALLET_REQUIRED',
})
@ApiResponse({
  status: 409,
  type: ErrorEnvelopeDto,
  description:
    'INSUFFICIENT_FUNDS, IDEMPOTENCY_CONFLICT or TRANSACTION_CONFLICT',
})
@Controller('wallet')
@UseGuards(AccessGuard)
export class WalletController {
  constructor(
    @Inject(EconomyService) private readonly economy: EconomyService,
  ) {}
  @Get()
  @ApiOkResponse({ type: WalletDto })
  get(
    @CurrentAccount() account: Principal,
    @Res({ passthrough: true }) res: Response,
  ): Promise<WalletDto> {
    res.setHeader('Cache-Control', 'no-store');
    return this.economy.getWallet(account.user.id);
  }
  @Get('transactions')
  @ApiOkResponse({ type: WalletHistoryDto })
  history(
    @CurrentAccount() account: Principal,
    @Query() query: HistoryQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<WalletHistoryDto> {
    res.setHeader('Cache-Control', 'no-store');
    return this.economy.getTransactions(
      account.user.id,
      query.limit,
      query.cursor,
    );
  }
  private move(
    account: Principal,
    input: MoneyMoveDto,
    key: string | undefined,
    direction: 'deposit' | 'withdraw',
    res: Response,
  ): Promise<WalletDto> {
    res.setHeader('Cache-Control', 'no-store');
    return this.economy.transfer(
      { userId: account.user.id, familyId: account.familyId },
      input.amount,
      direction,
      requireKey(key),
    );
  }
  @Post('deposit')
  @HttpCode(200)
  @UseGuards(WalletRateGuard)
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', pattern: '^[A-Za-z0-9_-]{8,128}$' },
  })
  @ApiOkResponse({
    type: WalletDto,
    description:
      'Fictional cash → bank. Exact retries return the original result.',
  })
  @ApiResponse({
    status: 429,
    type: ErrorEnvelopeDto,
    description: 'RATE_LIMITED: 30 mutations/account/minute.',
  })
  deposit(
    @CurrentAccount() account: Principal,
    @Body() input: MoneyMoveDto,
    @Headers('idempotency-key') key: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<WalletDto> {
    return this.move(account, input, key, 'deposit', res);
  }
  @Post('withdraw')
  @HttpCode(200)
  @UseGuards(WalletRateGuard)
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', pattern: '^[A-Za-z0-9_-]{8,128}$' },
  })
  @ApiOkResponse({
    type: WalletDto,
    description: 'Fictional bank → cash. No real-money payout.',
  })
  @ApiResponse({
    status: 429,
    type: ErrorEnvelopeDto,
    description: 'RATE_LIMITED: 30 mutations/account/minute.',
  })
  withdraw(
    @CurrentAccount() account: Principal,
    @Body() input: MoneyMoveDto,
    @Headers('idempotency-key') key: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<WalletDto> {
    return this.move(account, input, key, 'withdraw', res);
  }
}
