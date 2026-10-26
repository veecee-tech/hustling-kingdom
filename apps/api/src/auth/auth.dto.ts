import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, Matches, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export const normalizeIdentity = (value: string): string =>
  value.trim().toLowerCase();
const normalize = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? normalizeIdentity(value) : value;

export class RegisterDto {
  @ApiProperty({ type: String, maxLength: 254, format: 'email' })
  @Transform(normalize)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({
    type: String,
    minLength: 3,
    maxLength: 24,
    pattern: '^[a-z0-9_]+$',
  })
  @Transform(normalize)
  @IsString()
  @Length(3, 24)
  @Matches(/^[a-z0-9_]+$/)
  username!: string;

  @ApiProperty({
    type: String,
    minLength: 12,
    maxLength: 128,
    format: 'password',
    writeOnly: true,
  })
  @IsString()
  @Length(12, 128)
  password!: string;
}

export class LoginDto {
  @ApiProperty({ type: String, maxLength: 254 })
  @Transform(normalize)
  @IsString()
  @Length(3, 254)
  emailOrUsername!: string;

  @ApiProperty({
    type: String,
    maxLength: 128,
    format: 'password',
    writeOnly: true,
  })
  @IsString()
  @Length(1, 128)
  password!: string;
}

export class UserDto {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String, format: 'email' }) email!: string;
  @ApiProperty({ type: String }) username!: string;
  @ApiProperty({ enum: ['PLAYER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN'] })
  role!: string;
}
export class SessionDto {
  @ApiProperty({ type: UserDto }) user!: UserDto;
  @ApiProperty({ type: String }) accessToken!: string;
  @ApiProperty({
    type: Number,
    description: 'Access token lifetime in seconds.',
  })
  expiresIn!: number;
}
export class MeDto {
  @ApiProperty({ type: UserDto }) user!: UserDto;
  @ApiProperty({
    type: 'object',
    additionalProperties: false,
    nullable: true,
    example: null,
  })
  character!: null;
}
