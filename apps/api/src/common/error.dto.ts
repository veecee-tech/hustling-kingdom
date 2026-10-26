import { ApiProperty } from '@nestjs/swagger';

class ErrorDetailDto {
  @ApiProperty({ type: String, example: 'SERVICE_UNAVAILABLE' })
  code!: string;
  @ApiProperty({ type: String, example: 'Service unavailable.' })
  message!: string;
  @ApiProperty({ type: 'object', additionalProperties: true })
  details!: Record<string, unknown>;
  @ApiProperty({
    type: String,
    example: 'req_00000000-0000-4000-8000-000000000000',
  })
  requestId!: string;
}

export class ErrorEnvelopeDto {
  @ApiProperty({ type: ErrorDetailDto })
  error!: ErrorDetailDto;
}

export const requestIdResponseHeaders = {
  'x-request-id': {
    description: 'Trusted server-generated identifier for this request.',
    schema: { type: 'string' },
  },
};
