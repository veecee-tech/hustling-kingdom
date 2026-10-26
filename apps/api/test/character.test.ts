import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { defaultAppearance, validCharacterName } from '@hk/shared';
import {
  characterResponse,
  initialStats,
  validateAppearance,
} from '../src/characters/character.rules.js';
import { CreateCharacterDto } from '../src/characters/character.dto.js';

describe('character identity and cosmetic rules', () => {
  it.each(['Adé Ọlá', '  Nneka  Okafor  ', 'محمد', '李明'])(
    'accepts Unicode display names: %s',
    async (name) => {
      expect(validCharacterName(name)).toBe(true);
      const dto = plainToInstance(CreateCharacterDto, {
        name,
        gender: 'NON_BINARY',
        appearance: defaultAppearance,
      });
      expect(await validate(dto)).toHaveLength(0);
      expect(dto.name).toBe(name.trim());
    },
  );
  it.each([
    'a',
    ' '.repeat(8),
    'n'.repeat(41),
    'Bad\u0000Name',
    'Bad\nName',
    'Bad\u202eName',
    '\nName',
    'Name\t',
  ])('rejects invalid names: %#', async (name) => {
    expect(validCharacterName(name)).toBe(false);
    const dto = plainToInstance(CreateCharacterDto, {
      name,
      gender: 'MALE',
      appearance: defaultAppearance,
    });
    expect((await validate(dto)).length).toBeGreaterThan(0);
  });
  it('validates full cosmetics and safe partial merges', () => {
    expect(validateAppearance(defaultAppearance)).toEqual(defaultAppearance);
    const patch = validateAppearance({ hair: 'braids' }, true);
    expect(validateAppearance({ ...defaultAppearance, ...patch })).toEqual({
      ...defaultAppearance,
      hair: 'braids',
    });
    for (const invalid of [
      null,
      [],
      {},
      { hair: null },
      { hair: 'https://evil.test' },
      { ...defaultAppearance, heat: 0 },
      { hair: 'afro' },
    ])
      expect(() => validateAppearance(invalid)).toThrow();
    for (const invalid of [
      {},
      { __proto__: null, nope: 'afro' },
      { hair: 1 },
      { hair: 'unknown' },
    ])
      expect(() => validateAppearance(invalid, true)).toThrow();
  });
  it('sets approved stats and maps only explicit public fields with lossless reputation', () => {
    expect(initialStats()).toEqual({
      reputation: 0n,
      heat: 0,
      health: 100,
      energy: 100,
      stress: 10,
    });
    const now = new Date();
    const result = characterResponse({
      id: 'id',
      userId: 'private-user',
      name: 'Nneka',
      slug: 'public-slug',
      gender: 'FEMALE',
      status: 'ACTIVE',
      appearance: defaultAppearance,
      createdAt: now,
      updatedAt: now,
      creationKey: 'private-key',
      creationHash: 'private-hash',
      creationResponse: null,
      stats: {
        ...initialStats(),
        reputation: 9007199254740993n,
        characterId: 'id',
        highestNetWorth: 0n,
        createdAt: now,
        updatedAt: now,
      },
    });
    expect(result.stats.reputation).toBe('9007199254740993');
    expect(result.residence).toBe('Family House');
    expect(JSON.stringify(result)).not.toMatch(
      /private|highestNetWorth|wallet|balance/,
    );
  });
});
