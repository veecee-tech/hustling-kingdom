import { Injectable, PipeTransform } from '@nestjs/common';
import { PublicHttpError } from '../common/error.filter.js';

@Injectable()
export class EmptyBodyPipe implements PipeTransform {
  transform(value: unknown): unknown {
    if (value === undefined) return {};
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      Object.keys(value).length
    )
      throw new PublicHttpError(
        400,
        'VALIDATION_ERROR',
        'Request validation failed.',
      );
    return value;
  }
}
