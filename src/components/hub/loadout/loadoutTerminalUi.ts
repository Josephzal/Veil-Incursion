/** Shared presentation tokens for the Loadout descent-prep terminal. */
export const TERMINAL = '#69c8ad';
export const TERMINAL_BRIGHT = '#8edfc6';
export const MISSING = '#d88984';
export const OCCULT = '#9988b3';
export const MUTED = '#84958f';
export const TEXT_PRIMARY = '#e0e7e4';
export const TEXT_SECONDARY = '#a1b0ac';

export type LoadoutCategory = 'CHASSIS' | 'RELIC' | 'DECK' | 'FIELD_KIT' | 'CARGO';

export const CATEGORY_COPY: Record<
  LoadoutCategory,
  { eyebrow: string; title: string; description: string; manifestLabel: string }
> = {
  CHASSIS: {
    eyebrow: 'WEAPON CHASSIS',
    title: 'WEAPON CHASSIS',
    description: 'Select one class weapon link for the next descent.',
    manifestLabel: 'WEAPON CHASSIS',
  },
  RELIC: {
    eyebrow: 'EXPEDITION RELIC',
    title: 'EXPEDITION RELIC',
    description: 'Choose one relic that changes route planning, cargo pressure, or extraction.',
    manifestLabel: 'RELIC',
  },
  DECK: {
    eyebrow: 'ABILITY DECK',
    title: 'ABILITY DECK',
    description: 'Four active combat slots. Slot 1 is the class anchor.',
    manifestLabel: 'ABILITY DECK',
  },
  FIELD_KIT: {
    eyebrow: 'FIELD KIT',
    title: 'FIELD KIT',
    description: 'One-use combat consumables and field tools prepared for descent.',
    manifestLabel: 'FIELD KIT',
  },
  CARGO: {
    eyebrow: 'CARGO MANIFEST',
    title: 'CARGO MANIFEST',
    description: 'Review staged cargo and available capacity before descent.',
    manifestLabel: 'CARGO',
  },
};
