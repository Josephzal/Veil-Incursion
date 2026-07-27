/**
 * In-run field interface tokens — scoped to Veil contact surfaces.
 * Do NOT apply these globally; scanners and hub use separate token families
 * except where the scanner outer header/dossier intentionally mirrors this system.
 *
 * Hub = stable Cabal terminal. Run field = equipment surviving Veil contact.
 */
export const RUN_FIELD = {
  /** Root scope marker for selectors / future web CSS. */
  scopeAttr: 'data-run-field',
  scopeValue: '1',

  black: 'rgb(5, 9, 10)',
  panelStrong: 'rgba(6, 11, 12, 0.92)',
  panel: 'rgba(7, 14, 15, 0.80)',
  panelLight: 'rgba(10, 18, 18, 0.68)',
  panelWash: 'rgba(7, 14, 15, 0.48)',

  text: 'rgb(231, 238, 234)',
  textSecondary: 'rgb(139, 154, 148)',
  textDim: 'rgba(139, 154, 148, 0.72)',

  line: 'rgba(129, 160, 150, 0.18)',
  lineStrong: 'rgba(129, 160, 150, 0.34)',
  innerHighlight: 'rgba(231, 238, 234, 0.06)',

  mint: 'rgb(99, 226, 177)',
  mintDim: 'rgb(55, 121, 99)',
  mintSoft: 'rgba(99, 226, 177, 0.14)',
  mintBorder: 'rgba(99, 226, 177, 0.42)',
  mintBorderHot: 'rgba(99, 226, 177, 0.78)',

  occult: 'rgb(190, 82, 164)',
  occultSoft: 'rgba(190, 82, 164, 0.16)',
  occultBorder: 'rgba(190, 82, 164, 0.4)',

  danger: 'rgb(205, 76, 90)',
  dangerSoft: 'rgba(205, 76, 90, 0.14)',
  dangerBorder: 'rgba(205, 76, 90, 0.5)',

  /** Preferred immersive scrim — keeps ~40–55% environment readable. */
  environmentScrim: 0.42,
  environmentScrimLight: 0.18,
  environmentScrimDense: 0.55,

  mono: 'monospace',

  /**
   * Authoritative in-run type scale.
   * Screen titles: clamp(30px, 1.8vw, 38px) on web; display fallback on native.
   */
  type: {
    display: 34,
    displayMin: 30,
    displayMax: 38,
    title: 22,
    section: 16,
    body: 15,
    secondary: 14,
    metric: 17,
    button: 14,
    eyebrow: 11,
    micro: 11,
    offerName: 24,
    offerNameMin: 20,
    offerNameMax: 26,
    offerEffect: 16,
    offerDescriptor: 14,
  },

  header: {
    gap: 10,
    copyGap: 4,
    utilityPadH: 10,
    utilityPadV: 7,
    titleWeight: '700' as const,
    titleLetterSpacing: 1.1,
    titleLineHeight: 1,
  },

  bracket: {
    size: 10,
    inset: 4,
    stroke: 1.25,
  },

  motion: {
    plateMs: 260,
    hoverMs: 130,
    selectMs: 200,
    ritualMs: 420,
  },

  /** Local commit CTAs attached to a panel. */
  ctaWidth: 280,
  /** Quiet secondary / compact CTAs. */
  ctaWidthCompact: 240,
  /** Screen-level lower-right progression rail. */
  ctaWidthScreen: 280,
} as const;

export type RunFieldTone = 'neutral' | 'mint' | 'occult' | 'danger';

export function runFieldToneBorder(tone: RunFieldTone, hot = false): string {
  switch (tone) {
    case 'mint':
      return hot ? RUN_FIELD.mintBorderHot : RUN_FIELD.mintBorder;
    case 'occult':
      return RUN_FIELD.occultBorder;
    case 'danger':
      return RUN_FIELD.dangerBorder;
    default:
      return hot ? RUN_FIELD.lineStrong : RUN_FIELD.line;
  }
}
