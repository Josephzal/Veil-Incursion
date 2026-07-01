import type { ViewStyle } from 'react-native';

/** Dossier card chrome — matches deployment ID badge. */
export const DOSSIER_BG = 'rgba(9, 9, 11, 0.9)';
export const DOSSIER_BORDER = '#334155';

/** Opaque surface for foreground UI — blocks scanline texture bleed-through. */
export const DOSSIER_FOREGROUND = '#09090b';

export function dossierForegroundSurface(): ViewStyle {
  return { backgroundColor: DOSSIER_FOREGROUND };
}

/** CTA on dossier surfaces — solid fill, accent border (no semi-transparent tint). */
export function dossierOpaqueCtaStyle(accentColor: string): ViewStyle {
  return {
    backgroundColor: DOSSIER_FOREGROUND,
    borderColor: accentColor,
    borderWidth: 1,
  };
}
