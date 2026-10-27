import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { hustleOutcomes, type HustleOutcome } from '@hk/shared';
import { SkillProgressionDto } from '../skills/skills.dto.js';
import { CharacterDto } from '../characters/character.dto.js';
import { WalletDto } from '../economy/wallet.dto.js';
export class AttemptIntentDto {
  @ApiProperty({
    format: 'uuid',
    description:
      'Stable opaque intent UUID. Reuse it for retries, including under a different Idempotency-Key. It selects no outcome.',
  })
  @IsUUID('4')
  attemptId!: string;
}
export class AttemptsQueryDto {
  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  cursor?: string;
}
export class HustleOpportunityDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiProperty() description!: string;
  @ApiProperty() locationLabel!: string;
  @ApiProperty() tier!: number;
  @ApiProperty({ type: String }) rewardMin!: string;
  @ApiProperty({ type: String }) rewardMax!: string;
  @ApiProperty({ type: String }) entryCost!: string;
  @ApiProperty({
    type: String,
    description: 'Maximum total Bank loss, including entry cost.',
  })
  maximumLoss!: string;
  @ApiProperty({
    type: String,
    description: 'Bank balance required before any outcome is drawn.',
  })
  bankRequired!: string;
  @ApiProperty() energyCost!: number;
  @ApiProperty() riskLabel!: string;
  @ApiProperty() requiredStreetLevel!: number;
  @ApiProperty() currentStreetLevel!: number;
  @ApiProperty() available!: boolean;
  @ApiProperty({ type: String, nullable: true }) lockCode!: string | null;
  @ApiProperty({ type: String, nullable: true }) lockReason!: string | null;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  cooldownUntil!: string | null;
}
export class HustleUnlockDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() requiredLevel!: number;
}
export class HustleAttemptDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) hustleId!: string;
  @ApiProperty() hustleName!: string;
  @ApiProperty() tier!: number;
  @ApiProperty({ enum: hustleOutcomes }) outcome!: HustleOutcome;
  @ApiProperty({ type: String }) entryCost!: string;
  @ApiProperty({ type: String }) reward!: string;
  @ApiProperty({ type: String }) loss!: string;
  @ApiProperty({ type: String, description: 'Signed reward minus total loss.' })
  net!: string;
  @ApiProperty() energySpent!: number;
  @ApiProperty({ format: 'date-time' }) startedAt!: string;
  @ApiProperty({ format: 'date-time' }) resolvedAt!: string;
  @ApiProperty({ format: 'date-time' }) cooldownUntil!: string;
  @ApiProperty({ type: SkillProgressionDto })
  skillProgress!: SkillProgressionDto;
  @ApiProperty({ type: [HustleUnlockDto] }) unlocks!: HustleUnlockDto[];
}
export class HustleCatalogDto {
  @ApiProperty({ type: [HustleOpportunityDto] }) items!: HustleOpportunityDto[];
  @ApiProperty({ format: 'date-time' }) serverNow!: string;
}
export class HustleHistoryDto {
  @ApiProperty({ type: [HustleAttemptDto] }) items!: HustleAttemptDto[];
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
  @ApiProperty({ format: 'date-time' }) serverNow!: string;
}
export class HustleResultDto {
  @ApiProperty({ type: HustleAttemptDto }) attempt!: HustleAttemptDto;
  @ApiProperty({ type: CharacterDto }) character!: CharacterDto;
  @ApiProperty({ type: WalletDto }) wallet!: WalletDto;
}
