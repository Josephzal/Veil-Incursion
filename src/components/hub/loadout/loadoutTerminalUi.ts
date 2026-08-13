import { VEIL } from '../../../theme/veilTerminalTokens';
import {
  HUB_META,
  HUB_TEXT_PRIMARY,
  HUB_TEXT_SECONDARY,
} from '../../../theme/hubPanelSurfaces';

/** Shared presentation tokens for the Loadout descent-prep terminal — Contract Board–aligned. */
export const TERMINAL = VEIL.mint;
export const TERMINAL_BRIGHT = VEIL.mintBright;
export const MISSING = VEIL.blood;
export const OCCULT = VEIL.occult;
export const MUTED = HUB_META;
export const TEXT_PRIMARY = HUB_TEXT_PRIMARY;
export const TEXT_SECONDARY = HUB_TEXT_SECONDARY;

export type LoadoutCategory = 'CHASSIS' | 'REQUISITION' | 'DECK' | 'CARGO';

export const CATEGORY_COPY: Record<
  LoadoutCategory,
  { eyebrow: string; title: string; description: string; manifestLabel: string; channelCode: string }
> = {
  CHASSIS: {
    eyebrow: 'WEAPON CHASSIS',
    title: 'WEAPON CHASSIS',
    description: 'Select one class weapon link for the next descent.',
    manifestLabel: 'WEAPON CHASSIS',
    channelCode: 'CH-01',
  },
  REQUISITION: {
    eyebrow: 'EXPEDITION REQUISITION',
    title: 'EXPEDITION REQUISITION',
    description: 'Choose exactly one Requisition for the next deployment.',
    manifestLabel: 'REQUISITION',
    channelCode: 'RQ-01',
  },
  DECK: {
    eyebrow: 'ABILITY DECK',
    title: 'ABILITY DECK',
    description: 'Four active combat slots. Slot 1 is the class anchor.',
    manifestLabel: 'ABILITY DECK',
    channelCode: 'DK-01',
  },
  CARGO: {
    eyebrow: 'CARGO MANIFEST',
    title: 'CARGO MANIFEST',
    description: 'Pack resources, Combat Supplies, and Field Tools into the shared 3×4 hold.',
    manifestLabel: 'CARGO',
    channelCode: 'CG-01',
  },
};
