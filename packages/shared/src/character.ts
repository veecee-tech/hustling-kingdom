// Public cosmetic configuration only; no game balance or server configuration.
export const appearanceCatalog = {
  skinTone: ['ebony', 'umber', 'bronze', 'golden'],
  face: ['oval', 'round', 'angular'],
  hair: ['low-cut', 'braids', 'afro'],
  top: ['ankara', 'tee', 'kaftan'],
  bottom: ['trousers', 'jeans', 'skirt'],
  shoes: ['sneakers', 'sandals', 'loafers'],
} as const;
export type AppearanceCategory = keyof typeof appearanceCatalog;
export type Appearance = {
  [K in AppearanceCategory]: (typeof appearanceCatalog)[K][number];
};
export const appearanceCategories = Object.keys(
  appearanceCatalog,
) as AppearanceCategory[];
export const defaultAppearance: Appearance = {
  skinTone: 'umber',
  face: 'oval',
  hair: 'low-cut',
  top: 'ankara',
  bottom: 'trousers',
  shoes: 'sneakers',
};
export const genderOptions = ['MALE', 'FEMALE', 'NON_BINARY'] as const;
export type CharacterGender = (typeof genderOptions)[number];
export interface CreateCharacterInput {
  name: string;
  gender: CharacterGender;
  appearance: Appearance;
}
export interface CharacterResponse extends CreateCharacterInput {
  id: string;
  slug: string;
  status: 'ACTIVE';
  residence: 'Family House';
  stats: {
    reputation: string;
    heat: number;
    health: number;
    energy: number;
    stress: number;
  };
  createdAt: string;
  updatedAt: string;
}
export function validCharacterName(value: string): boolean {
  const length = [...value.trim()].length;
  return (
    length >= 2 && length <= 40 && !/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(value)
  );
}
