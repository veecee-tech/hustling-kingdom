import { ApiProperty } from '@nestjs/swagger';
import { skillCodes } from '@hk/shared';
export class SkillRequirementDto {
  @ApiProperty({ enum: skillCodes }) code!: string;
  @ApiProperty() name!: string;
  @ApiProperty() requiredLevel!: number;
  @ApiProperty() currentLevel!: number;
  @ApiProperty() met!: boolean;
}
export class SkillUnlockDto {
  @ApiProperty({ enum: ['JOB'] }) type!: 'JOB';
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() requiredLevel!: number;
}
export class SkillProgressionDto {
  @ApiProperty({ enum: skillCodes }) skill!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String }) xpAwarded!: string;
  @ApiProperty() previousLevel!: number;
  @ApiProperty() currentLevel!: number;
  @ApiProperty() leveledUp!: boolean;
}
export class SkillSummaryDto {
  @ApiProperty({ enum: skillCodes }) code!: string;
  @ApiProperty() name!: string;
  @ApiProperty() description!: string;
  @ApiProperty() maxLevel!: number;
  @ApiProperty() level!: number;
  @ApiProperty({ type: String }) xp!: string;
  @ApiProperty({ type: String }) currentLevelXp!: string;
  @ApiProperty({ type: String, nullable: true }) nextLevelXp!: string | null;
  @ApiProperty() progress!: number;
  @ApiProperty() capped!: boolean;
  @ApiProperty({ type: [String] }) sources!: string[];
  @ApiProperty({ type: SkillUnlockDto, nullable: true })
  nextUnlock!: SkillUnlockDto | null;
}
export class SkillsDto {
  @ApiProperty({ type: [SkillSummaryDto] }) skills!: SkillSummaryDto[];
}
