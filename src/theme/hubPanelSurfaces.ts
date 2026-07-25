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
/** Shared left content edge for hub page headers. */
export const HUB_PAGE_HEADER_PADDING_H = 24;
export const HUB_PAGE_HEADER_PADDING_TOP = 16;
export const HUB_PAGE_HEADER_PADDING_BOTTOM = 14;
export const HUB_PAGE_HEADER_COMPACT_PADDING_H = 14;
export const HUB_PAGE_HEADER_COMPACT_PADDING_V = 10;

/**
 * Shared height for hub channel / mode / manifest slot buttons:
 * Contract Board sponsors, Black Market Forge/Vendor, Loadout Descent Manifest.
 * Width may differ per screen; height must match.
 */
export const HUB_CHANNEL_BUTTON_HEIGHT = 60;
export const HUB_CHANNEL_BUTTON_COMPACT_HEIGHT = 52;
export const HUB_CHANNEL_BUTTON_PADDING_V = 11;
export const HUB_CHANNEL_BUTTON_COMPACT_PADDING_V = 8;
export const HUB_CHANNEL_RAIL_INSET = 10;
/**
 * Shared left/right inset for channel rails + browser feed content
 * (Contract Board sponsors/feed, Black Market modes/sections, Loadout manifest/catalog).
 */
export const HUB_BROWSER_CONTENT_PADDING_H = 14;
/**
 * Shared channel-rail → section-label → items rhythm (Black Market Forge is source of truth):
 *   modes/manifest paddingBottom (6)
 *   + feed/scroll paddingTop (4)
 *   + sectionLabel marginTop (10) / marginBottom (8)
 */
export const HUB_BROWSER_FEED_PAD_TOP = 4;
export const HUB_BROWSER_SECTION_LABEL_MARGIN_TOP = 10;
export const HUB_BROWSER_SECTION_LABEL_MARGIN_BOTTOM = 8;

/** Section label above browser catalogs (PERMANENT AUGMENTS / WEAPON CHASSIS / …). */
export function hubBrowserSectionLabelStyle(): TextStyle {
  return {
    marginTop: HUB_BROWSER_SECTION_LABEL_MARGIN_TOP,
    marginBottom: HUB_BROWSER_SECTION_LABEL_MARGIN_BOTTOM,
    paddingHorizontal: HUB_BROWSER_CONTENT_PADDING_H,
    color: 'rgba(185, 181, 167, 0.88)',
    fontWeight: '700',
  };
}
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

/**
 * Right-rail inspector widths — two official variants.
 * Compact: Veil Front (map needs room). Standard: Contract / Market / Loadout.
 * CSS analogue: clamp(min, vw, max).
 */
export type HubInspectorVariant = 'compact' | 'standard';
export const HUB_INSPECTOR_COMPACT_MIN = 440;
export const HUB_INSPECTOR_COMPACT_MAX = 520;
export const HUB_INSPECTOR_COMPACT_VW = 0.25;
export const HUB_INSPECTOR_STANDARD_MIN = 500;
export const HUB_INSPECTOR_STANDARD_MAX = 640;
export const HUB_INSPECTOR_STANDARD_VW = 0.31;

/**
 * Fixed purple focus marker for right-hand inspectors.
 * List-card rails may still track card height; inspectors must not.
 */
export const HUB_INSPECTOR_FOCUS_BAR_TOP = 18;
export const HUB_INSPECTOR_FOCUS_BAR_HEIGHT = 96;

/** Section labels (OBJECTIVE, CONTRACT TERMS, etc.). */
export const HUB_DOSSIER_LABEL = 'rgba(198, 194, 180, 0.92)';

/** Primary CTA inverse text on mint fill. */
export const HUB_CTA_INVERSE_TEXT = '#06110e';

/** Resolve inspector panel content width (excludes edge pad). */
export function hubInspectorPanelWidth(
  viewportWidth: number,
  variant: HubInspectorVariant = 'standard',
): number {
  if (variant === 'compact') {
    return Math.round(Math.min(
      HUB_INSPECTOR_COMPACT_MAX,
      Math.max(HUB_INSPECTOR_COMPACT_MIN, viewportWidth * HUB_INSPECTOR_COMPACT_VW),
    ));
  }
  return Math.round(Math.min(
    HUB_INSPECTOR_STANDARD_MAX,
    Math.max(HUB_INSPECTOR_STANDARD_MIN, viewportWidth * HUB_INSPECTOR_STANDARD_VW),
  ));
}

/** Column host width including the floating-panel edge pad. */
export function hubInspectorColumnWidth(
  viewportWidth: number,
  variant: HubInspectorVariant = 'standard',
): number {
  return hubInspectorPanelWidth(viewportWidth, variant) + HUB_DOSSIER_EDGE_PAD;
}

/** Fixed-length violet focus rail for inspector headers. */
export function hubInspectorFocusBarStyle(): ViewStyle {
  return {
    top: HUB_INSPECTOR_FOCUS_BAR_TOP,
    height: HUB_INSPECTOR_FOCUS_BAR_HEIGHT,
  };
}

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

/**
 * Classic hub CTA chrome — mint outline at rest, solid mint fill on hover.
 * Used by forge hold-to-fabricate and HubPrimaryCta `variant="classic"`.
 */
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
