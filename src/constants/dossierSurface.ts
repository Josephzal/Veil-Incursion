import type { ViewStyle } from 'react-native';
import { VEIL } from '../theme/veilTerminalTokens';
import {
  HUB_CARD_SURFACE,
  HUB_CARD_SURFACE_HOVER,
  HUB_DOSSIER_BORDER,
  HUB_DOSSIER_SURFACE,
  HUB_SELECT_SURFACE,
  hubPrimaryActionStyle,
} from '../theme/hubPanelSurfaces';

/**
 * Dossier / hub surface chrome — Contract Board–aligned translucent surfaces.
 * Prefer `hubPanelSurfaces` for new work; these aliases keep older call sites stable.
 */

/** Dossier card chrome — matches Contract Board dossier panel. */
export const DOSSIER_BG = HUB_DOSSIER_SURFACE;
export const DOSSIER_BORDER = HUB_DOSSIER_BORDER;

/** Opaque surface for foreground UI — blocks scanline texture bleed-through. */
export const DOSSIER_FOREGROUND = VEIL.surface2;

/** Unfilled meter track — visible against dossier background. */
export const DOSSIER_METER_TRACK = VEIL.surface1;

/** CTA fill on dossier surfaces — outline rest state (board primary). */
export const DOSSIER_CTA_BG = VEIL.surface3;

/** Item row bars on dossier panels — selected cool mint fill. */
export const DOSSIER_ROW_BG = HUB_SELECT_SURFACE;

/** Near-black dossier card fill — board card surface. */
export const CARD_BLACK = HUB_CARD_SURFACE;

/** Slightly brighter charcoal for card hover/press. */
export const CARD_BLACK_HOVER = HUB_CARD_SURFACE_HOVER;

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

/** CTA on dossier surfaces — board outline primary (no semi-transparent tint). */
export function dossierOpaqueCtaStyle(accentColor: string): ViewStyle {
  return {
    ...hubPrimaryActionStyle(),
    borderColor: accentColor,
  };
}
