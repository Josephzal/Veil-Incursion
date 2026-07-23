import type { ViewStyle } from 'react-native';
import { VEIL } from '../theme/veilTerminalTokens';

/**
 * Dossier / hub surface chrome — aliases Contract Board VEIL tokens.
 * Prefer importing VEIL directly for new work; these keep existing call sites stable.
 */

/** Dossier card chrome — matches Contract Board raised surface. */
export const DOSSIER_BG = VEIL.surfaceRaised;
export const DOSSIER_BORDER = VEIL.line;

/** Opaque surface for foreground UI — blocks scanline texture bleed-through. */
export const DOSSIER_FOREGROUND = VEIL.surface2;

/** Unfilled meter track — visible against dossier background. */
export const DOSSIER_METER_TRACK = VEIL.surface1;

/** CTA fill on dossier surfaces — lighter than background so buttons read clearly. */
export const DOSSIER_CTA_BG = VEIL.surface3;

/** Item row bars on dossier panels — distinct from textured shell background. */
export const DOSSIER_ROW_BG = VEIL.surface3;

/** Near-black dossier card fill — use instead of blue slate tints. */
export const CARD_BLACK = VEIL.bgSoft;

/** Slightly brighter charcoal for card hover/press. */
export const CARD_BLACK_HOVER = VEIL.surface3;

/**
 * Live / active / focus accent — mint reserved for system activity (Contract Board rule).
 */
export const SELECT_ACCENT = VEIL.mint;

/** Dim mint — inactive accents / subtle strokes. */
export const SELECT_ACCENT_DIM = '#3A8F7C';

/** Mint glow (rgba) — pulses / shadows. */
export const SELECT_ACCENT_GLOW = 'rgba(98, 205, 181, 0.22)';

/** Muted red — locked / danger / betrayal / missing requirement. */
export const DANGER_RED = VEIL.blood;

/** Bone — neutral highlight (rewards, headlines). */
export const BONE_WHITE = VEIL.bone;

/**
 * @deprecated Selection color is now mint. Kept as an alias so older
 * imports keep working; prefer SELECT_ACCENT.
 */
export const SELECT_AMBER = SELECT_ACCENT;

/** Hover border — pale steel mapped to VEIL soft text. */
export const HOVER_STEEL = VEIL.textSoft;

export function dossierForegroundSurface(): ViewStyle {
  return { backgroundColor: DOSSIER_FOREGROUND };
}

/** CTA on dossier surfaces — solid fill, accent border (no semi-transparent tint). */
export function dossierOpaqueCtaStyle(accentColor: string): ViewStyle {
  return {
    backgroundColor: DOSSIER_CTA_BG,
    borderColor: accentColor,
    borderWidth: 1,
  };
}
