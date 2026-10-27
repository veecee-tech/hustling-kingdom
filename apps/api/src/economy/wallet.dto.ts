import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import type {
  WalletSummary,
  WalletEntry,
  WalletHistory,
  WalletAccount,
  WalletTransactionType,
} from '@hk/shared';
export class MoneyMoveDto {
  @ApiProperty({
    type: String,
    pattern: '^[1-9][0-9]{0,18}$',
    example: '5000',
    description:
      'Positive whole HK₦ units as a decimal string; maximum PostgreSQL BIGINT.',
  })
  @IsString()
  amount!: string;
}
export class HistoryQueryDto {
  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Opaque nextCursor returned by the previous page; scoped to your wallet.',
  })
  @IsOptional()
  @IsUUID()
  cursor?: string;
}
export class WalletDto implements WalletSummary {
  @ApiProperty({ example: '15000' }) cash!: string;
  @ApiProperty({ example: '5000' }) bank!: string;
  @ApiProperty({ example: '20000' }) total!: string;
  @ApiProperty({ description: 'Monotonic wallet version as decimal string.' })
  version!: string;
}
export class WalletEntryDto implements WalletEntry {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: ['CASH', 'BANK'] }) account!: WalletAccount;
  @ApiProperty({
    enum: [
      'STARTING_CASH',
      'STARTING_BANK',
      'CASH_DEPOSIT',
      'CASH_WITHDRAWAL',
      'SYSTEM_CREDIT',
      'SYSTEM_DEBIT',
      'JOB_SALARY',
      'HUSTLE_REWARD',
      'HUSTLE_LOSS',
    ],
  })
  transactionType!: WalletTransactionType;
  @ApiProperty({ enum: ['CREDIT', 'DEBIT'] }) direction!: 'CREDIT' | 'DEBIT';
  @ApiProperty({ type: String }) amount!: string;
  @ApiProperty({ type: String }) balanceAfter!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}
export class WalletHistoryDto implements WalletHistory {
  @ApiProperty({ type: [WalletEntryDto] }) items!: WalletEntryDto[];
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
}
