import type { ViewStyle } from 'react-native';

/** Dossier card chrome — matches deployment ID badge. */
export const DOSSIER_BG = 'rgba(9, 9, 11, 0.9)';
export const DOSSIER_BORDER = '#334155';

/** Opaque surface for foreground UI — blocks scanline texture bleed-through. */
export const DOSSIER_FOREGROUND = '#09090b';

/** Unfilled meter track — visible against dossier background. */
export const DOSSIER_METER_TRACK = '#27272a';

/** CTA fill on dossier surfaces — lighter than background so buttons read clearly. */
export const DOSSIER_CTA_BG = '#1e293b';

/** Item row bars on dossier panels — distinct from textured shell background. */
export const DOSSIER_ROW_BG = '#1a1c1e';

/** Near-black dossier card fill — use instead of blue slate tints. */
export const CARD_BLACK = 'rgba(9, 9, 11, 0.92)';

/** Slightly brighter charcoal for card hover/press. */
export const CARD_BLACK_HOVER = '#161619';

/**
 * Universal selection / active / actionable color across hub screens.
 * Spectral green — corrupted-terminal / ghost-scanner accent for the Veil.
 */
export const SELECT_ACCENT = '#58DFA8';

/** Dim spectral green — inactive accents / subtle strokes. */
export const SELECT_ACCENT_DIM = '#2F8F70';

/** Spectral green glow (rgba) — pulses / shadows. */
export const SELECT_ACCENT_GLOW = 'rgba(88, 223, 168, 0.25)';

/** Muted red — locked / danger / betrayal / missing requirement. */
export const DANGER_RED = '#f87171';

/** Bone white — neutral highlight (rewards, headlines). */
export const BONE_WHITE = '#f5f3ee';

/**
 * @deprecated Selection color is now spectral green. Kept as an alias so older
 * imports keep working; prefer SELECT_ACCENT.
 */
export const SELECT_AMBER = SELECT_ACCENT;

/** Hover border — pale steel. */
export const HOVER_STEEL = '#94a3b8';

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
