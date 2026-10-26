import { expect, it } from 'vitest';
import * as rules from '../src/index.js';

it('loads the rules package without prebuilding gameplay or causing side effects', () => {
  expect(Object.keys(rules)).toEqual([]);
});
