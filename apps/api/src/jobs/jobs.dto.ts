import { ApiProperty } from '@nestjs/swagger';
import { CharacterDto } from '../characters/character.dto.js';
import { WalletDto } from '../economy/wallet.dto.js';
export class JobViewDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiProperty() description!: string;
  @ApiProperty() locationLabel!: string;
  @ApiProperty({ type: String }) baseReward!: string;
  @ApiProperty() energyCost!: number;
  @ApiProperty() durationSeconds!: number;
  @ApiProperty() available!: boolean;
  @ApiProperty({ type: String, nullable: true }) lockCode!: string | null;
  @ApiProperty({ type: String, nullable: true }) lockReason!: string | null;
}
export class AssignmentDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) jobId!: string;
  @ApiProperty() jobName!: string;
  @ApiProperty() locationLabel!: string;
  @ApiProperty({ enum: ['ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED'] })
  status!: string;
  @ApiProperty({ format: 'date-time' }) startedAt!: string;
  @ApiProperty({ format: 'date-time' }) completesAt!: string;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  completedAt!: string | null;
  @ApiProperty({ type: String }) pay!: string;
  @ApiProperty() energyCost!: number;
  @ApiProperty({ type: String, nullable: true }) rewardAmount!: string | null;
}
export class CatalogDto {
  @ApiProperty({ type: [JobViewDto] }) items!: JobViewDto[];
  @ApiProperty({ format: 'date-time' }) serverNow!: string;
}
export class ActiveJobDto {
  @ApiProperty({ type: AssignmentDto, nullable: true })
  assignment!: AssignmentDto | null;
  @ApiProperty({ format: 'date-time' }) serverNow!: string;
}
export class DashboardDto {
  @ApiProperty({ type: CharacterDto }) character!: CharacterDto;
  @ApiProperty({ type: WalletDto }) wallet!: WalletDto;
  @ApiProperty({ type: AssignmentDto, nullable: true })
  activeJob!: AssignmentDto | null;
  @ApiProperty({ type: AssignmentDto, nullable: true })
  lastCompletedJob!: AssignmentDto | null;
  @ApiProperty() hasWorked!: boolean;
  @ApiProperty({ format: 'date-time' }) serverNow!: string;
}
export class WorkResultDto {
  @ApiProperty({ type: String, example: '8000' }) salary!: string;
  @ApiProperty({ example: 10 }) energySpent!: number;
  @ApiProperty({ enum: ['BANK'] }) account!: 'BANK';
}
export class CompletionDto {
  @ApiProperty({ type: AssignmentDto }) assignment!: AssignmentDto;
  @ApiProperty({ type: WorkResultDto }) result!: WorkResultDto;
  @ApiProperty({ type: CharacterDto }) character!: CharacterDto;
  @ApiProperty({ type: WalletDto }) wallet!: WalletDto;
}
