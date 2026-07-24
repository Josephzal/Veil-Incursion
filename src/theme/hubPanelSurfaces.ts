import { Platform, type TextStyle, type ViewStyle } from 'react-native';
import { VEIL } from './veilTerminalTokens';

/**
 * Shared hub panel surfaces — Contract Board is the visual source of truth.
 * Presentation only. Import these instead of duplicating local rgba/hex ladders.
 */

/** Functional meta / secondary grey (readable on dark cards). */
export const HUB_META = '#9CA7A0';
export const HUB_TEXT_PRIMARY = '#C4CBC6';
export const HUB_TEXT_SECONDARY = HUB_META;

/** Page header hierarchy — mirrors ContractBoardPanel header metrics. */
export const HUB_PAGE_HEADER_MIN_HEIGHT = 92;
export const HUB_PAGE_HEADER_COMPACT_MIN_HEIGHT = 74;
export const HUB_PAGE_HEADER_PADDING_H = 22;
export const HUB_PAGE_HEADER_PADDING_TOP = 16;
export const HUB_PAGE_HEADER_PADDING_BOTTOM = 14;
export const HUB_PAGE_HEADER_COMPACT_PADDING_H = 14;
export const HUB_PAGE_HEADER_COMPACT_PADDING_V = 10;
export const HUB_PAGE_TITLE = VEIL.text;
export const HUB_PAGE_EYEBROW = VEIL.textDim;
export const HUB_DOSSIER_TITLE = '#F2F4F1';

/** List / catalog card surfaces. */
export const HUB_CARD_SURFACE = 'rgba(8, 13, 13, 0.78)';
export const HUB_CARD_SURFACE_HOVER = 'rgba(12, 18, 18, 0.88)';
export const HUB_CARD_BORDER = 'rgba(105, 190, 165, 0.16)';
export const HUB_CARD_BORDER_HOVER = 'rgba(105, 190, 165, 0.28)';
export const HUB_CARD_BORDER_SELECTED = 'rgba(105, 190, 165, 0.42)';

/** Selected row / channel fill (cool mint, not brown). */
export const HUB_SELECT_SURFACE = 'rgba(12, 28, 24, 0.88)';

/** Right-rail dossier document panel. */
export const HUB_DOSSIER_SURFACE = 'rgba(8, 15, 18, 0.88)';
export const HUB_DOSSIER_BORDER = 'rgba(105, 190, 165, 0.24)';
export const HUB_DOSSIER_FOOTER_BG = 'rgba(6, 12, 14, 0.92)';
export const HUB_DOSSIER_FOOTER_RULE = 'rgba(105, 190, 165, 0.18)';
/** Inset around floating hub dossiers — matches Veil Front sector briefing. */
export const HUB_DOSSIER_EDGE_PAD = 12;

/** Section labels (OBJECTIVE, CONTRACT TERMS, etc.). */
export const HUB_DOSSIER_LABEL = 'rgba(198, 194, 180, 0.92)';

/** Primary CTA inverse text on mint fill. */
export const HUB_CTA_INVERSE_TEXT = '#06110e';

export function hubCardSurfaceStyle(opts?: {
  selected?: boolean;
  hovered?: boolean;
}): ViewStyle {
  if (opts?.selected) {
    return {
      backgroundColor: HUB_SELECT_SURFACE,
      borderWidth: 1,
      borderColor: HUB_CARD_BORDER_SELECTED,
    };
  }
  if (opts?.hovered) {
    return {
      backgroundColor: HUB_CARD_SURFACE_HOVER,
      borderWidth: 1,
      borderColor: HUB_CARD_BORDER_HOVER,
    };
  }
  return {
    backgroundColor: HUB_CARD_SURFACE,
    borderWidth: 1,
    borderColor: HUB_CARD_BORDER,
  };
}

/** Top-right clip matching Contract Board dossier. */
export const HUB_DOSSIER_CLIP_PATH =
  'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 0 100%)';

/**
 * Right-rail column host — fills the hub shell height (flex row / grid stretch).
 * Avoid percentage height alone; it collapses to content inside auto-sized grid rows.
 */
export function hubDossierColumnStyle(): ViewStyle {
  return {
    minWidth: 0,
    minHeight: 0,
    alignSelf: 'stretch',
    flexGrow: 1,
    flexShrink: 0,
    flexBasis: 0,
    paddingTop: HUB_DOSSIER_EDGE_PAD,
    paddingBottom: HUB_DOSSIER_EDGE_PAD,
    paddingRight: HUB_DOSSIER_EDGE_PAD,
    ...Platform.select({
      web: {
        display: 'flex',
        flexDirection: 'column',
        alignSelf: 'stretch',
        height: '100%',
      } as object,
      default: {
        alignSelf: 'stretch',
      },
    }),
  };
}

/**
 * Floating dossier document shell.
 * Fills the column; header/footer stay put and the body absorbs spare space.
 */
export function hubDossierShellStyle(): ViewStyle {
  return {
    position: 'relative',
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    alignSelf: 'stretch',
    width: '100%',
    minWidth: 0,
    minHeight: 0,
    maxWidth: '100%',
    overflow: 'hidden',
    backgroundColor: HUB_DOSSIER_SURFACE,
    borderWidth: 1,
    borderColor: HUB_DOSSIER_BORDER,
    zIndex: 2,
    ...Platform.select({
      web: {
        display: 'flex',
        flexDirection: 'column',
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: 0,
        height: '100%',
        minHeight: 0,
        clipPath: HUB_DOSSIER_CLIP_PATH,
      } as object,
      default: {
        flex: 1,
      },
    }),
  };
}

/** Rest outline CTA — mint border / mintBright label. */
export function hubPrimaryActionStyle(): ViewStyle {
  return {
    backgroundColor: VEIL.surface3,
    borderWidth: 1,
    borderColor: VEIL.mint,
    ...Platform.select({
      web: {
        transitionProperty: 'background-color, border-color',
        transitionDuration: '120ms',
        transitionTimingFunction: 'ease-out',
      } as object,
      default: {},
    }),
  };
}

export function hubPrimaryActionHoverStyle(): ViewStyle {
  return {
    backgroundColor: VEIL.mint,
    borderColor: VEIL.mintBright,
  };
}

export function hubPrimaryActionTextStyle(): TextStyle {
  return {
    color: VEIL.mintBright,
    fontWeight: '800',
  };
}

export function hubPrimaryActionTextHoverStyle(): TextStyle {
  return {
    color: HUB_CTA_INVERSE_TEXT,
  };
}

export function hubPageEyebrowStyle(): TextStyle {
  return {
    color: HUB_PAGE_EYEBROW,
    fontWeight: '700',
  };
}

export function hubPageTitleStyle(): TextStyle {
  return {
    color: HUB_PAGE_TITLE,
    fontWeight: '700',
  };
}

export function hubPageSubtitleStyle(): TextStyle {
  return {
    marginTop: 5,
    color: HUB_PAGE_EYEBROW,
    fontWeight: '700',
  };
}
