import { createApiClient } from './client';
import { readPublicConfig } from '../config';

export const api = createApiClient(
  readPublicConfig(import.meta.env).apiBaseUrl,
);
