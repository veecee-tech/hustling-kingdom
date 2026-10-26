import { Transform } from 'class-transformer';
import { IsIn, IsObject, IsString, Length, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  appearanceCatalog,
  genderOptions,
  type Appearance,
  type CharacterGender,
  type CharacterResponse,
} from '@hk/shared';

// Membership validation remains in domain rules, so invalid selections have a stable error code.
export class AppearanceDto {
  @ApiProperty({ enum: appearanceCatalog.skinTone }) skinTone!: string;
  @ApiProperty({ enum: appearanceCatalog.face }) face!: string;
  @ApiProperty({ enum: appearanceCatalog.hair }) hair!: string;
  @ApiProperty({ enum: appearanceCatalog.top }) top!: string;
  @ApiProperty({ enum: appearanceCatalog.bottom }) bottom!: string;
  @ApiProperty({ enum: appearanceCatalog.shoes }) shoes!: string;
}
export class CreateCharacterDto {
  @ApiProperty({
    minLength: 2,
    maxLength: 40,
    description:
      'Unicode name. Outer spaces trimmed; internal spaces preserved. No control/format characters.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && !/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(value)
      ? value.trim()
      : value,
  )
  @IsString()
  @Length(2, 40)
  @Matches(/^[^\p{Cc}\p{Cf}\p{Zl}\p{Zp}]+$/u)
  name!: string;
  @ApiProperty({ enum: genderOptions })
  @IsIn(genderOptions)
  gender!: CharacterGender;
  @ApiProperty({ type: AppearanceDto, additionalProperties: false })
  @IsObject()
  appearance!: Appearance;
}
export class AppearancePatchDto {
  @ApiPropertyOptional({ enum: appearanceCatalog.skinTone }) skinTone?: string;
  @ApiPropertyOptional({ enum: appearanceCatalog.face }) face?: string;
  @ApiPropertyOptional({ enum: appearanceCatalog.hair }) hair?: string;
  @ApiPropertyOptional({ enum: appearanceCatalog.top }) top?: string;
  @ApiPropertyOptional({ enum: appearanceCatalog.bottom }) bottom?: string;
  @ApiPropertyOptional({ enum: appearanceCatalog.shoes }) shoes?: string;
}
export class CharacterStatsDto {
  @ApiProperty({
    type: String,
    pattern: '^\\d+$',
    example: '0',
    description: 'Decimal string preserves BIGINT precision.',
  })
  reputation!: string;
  @ApiProperty({ minimum: 0, maximum: 100 }) heat!: number;
  @ApiProperty({ minimum: 0, maximum: 100 }) health!: number;
  @ApiProperty({ minimum: 0, maximum: 100 }) energy!: number;
  @ApiProperty({ minimum: 0, maximum: 100 }) stress!: number;
}
export class CharacterDto implements CharacterResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: genderOptions }) gender!: CharacterGender;
  @ApiProperty({ type: AppearanceDto }) appearance!: Appearance;
  @ApiProperty({ enum: ['ACTIVE'] }) status!: 'ACTIVE';
  @ApiProperty({ enum: ['Family House'] }) residence!: 'Family House';
  @ApiProperty({ type: CharacterStatsDto }) stats!: CharacterStatsDto;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}
