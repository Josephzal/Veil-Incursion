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
