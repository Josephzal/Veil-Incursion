import React from 'react';
import {
  Image,
  StyleSheet,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import HapticPressable from '../HapticPressable';
import TerminalText from '../TerminalText';
import TacticalButton from '../TacticalButton';
import DossierCardShell from './DossierCardShell';
import {
  DOSSIER_BORDER,
  DOSSIER_CTA_BG,
  DOSSIER_ROW_BG,
  dossierOpaqueCtaStyle,
  SELECT_ACCENT,
} from '../../constants/dossierSurface';
import { useTerminal } from '../../context/TerminalContext';
import { resolveCargoItemIcon } from '../../utils/cargoItemIcon';
import type { CargoItemId } from '../../types/cargoGrid';
import { readPressableHover, terminalHoverStyle } from '../../utils/terminalHoverStyle';
import {
  LOADOUT_LABEL_TO_CARD_GAP,
  LOADOUT_SECTION_HEADER_COLOR,
  LOADOUT_SUBTITLE_COLOR,
  LoadoutSectionHeader,
} from './loadoutTabUi';

/** Shared Black Market Forge / Vendor layout tokens. */
export const MARKET_LEFT_FLEX = 0.36;
export const MARKET_RIGHT_FLEX = 0.64;
export const MARKET_GRID_GAP = 20;
export const MARKET_SECTION_GAP = LOADOUT_LABEL_TO_CARD_GAP;
export const MARKET_PANEL_GAP = 6;
export const MARKET_CONTENT_BOTTOM_PAD = 96;
export const MARKET_FOOTER_HEIGHT = 54;

export const MARKET_TAB_WIDTH = 118;
export const MARKET_TAB_HEIGHT = 52;
export const MARKET_TAB_GAP = 14;

export const MARKET_IMAGE_CELL_WIDTH = 124;
export const MARKET_IMAGE_MAX = 86;
export const MARKET_ROW_MIN_HEIGHT = 64;
export const MARKET_PRIMARY_BTN_HEIGHT = 66;
export const MARKET_STEPPER_BTN_HEIGHT = 40;
export const MARKET_DISABLED_OPACITY = 0.32;

/** @deprecated Prefer LOADOUT_SECTION_HEADER_COLOR — kept for existing imports. */
export const MARKET_SECTION_HEADER_COLOR = LOADOUT_SECTION_HEADER_COLOR;
/** @deprecated Prefer LOADOUT_SUBTITLE_COLOR — kept for existing imports. */
export const MARKET_MUTED_LINE = LOADOUT_SUBTITLE_COLOR;
export const MARKET_IMAGE_CELL_BG = '#0a0b0f';

function withAlpha(hex: string, alphaHex: string): string {
  return `${hex}${alphaHex}`;
}

interface MarketContentGridProps {
  left: React.ReactNode;
  right: React.ReactNode;
  /** Stack columns on narrow layouts. */
  stacked?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Shared two-column market layout — 36% / 64% with a fixed 20px gap. */
export function MarketContentGrid({
  left,
  right,
  stacked = false,
  style,
}: MarketContentGridProps): React.JSX.Element {
  return (
    <View
      style={[
        styles.grid,
        stacked ? styles.gridStacked : styles.gridRow,
        { gap: MARKET_GRID_GAP },
        style,
      ]}
    >
      <View style={[styles.gridColumn, stacked ? styles.gridLeftStacked : styles.gridLeft]}>
        {left}
      </View>
      <View style={[styles.gridColumn, stacked ? styles.gridRightStacked : styles.gridRight]}>
        {right}
      </View>
    </View>
  );
}

interface MarketSectionHeaderProps {
  label: string;
}

/** Section titles — same caption chrome as loadout (CURRENTLY EQUIPPED / DESCENT KIT). */
export function MarketSectionHeader({ label }: MarketSectionHeaderProps): React.JSX.Element {
  return <LoadoutSectionHeader label={label} />;
}

interface MarketPanelProps {
  label: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  padding?: number;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

/** Section header + dossier card with optional pinned footer (e.g. BUY). */
export function MarketPanel({
  label,
  subtitle,
  children,
  footer,
  padding = 10,
  style,
  contentStyle,
}: MarketPanelProps): React.JSX.Element {
  return (
    <View style={[styles.panelHost, style]}>
      <MarketSectionHeader label={label} />
      <DossierCardShell
        fillHeight
        padding={padding}
        contentStyle={[styles.panelBody, contentStyle]}
      >
        {subtitle ? <View style={styles.panelSubtitle}>{subtitle}</View> : null}
        <View style={styles.panelMain}>{children}</View>
        {footer ? <View style={styles.panelFooter}>{footer}</View> : null}
      </DossierCardShell>
    </View>
  );
}

interface MarketTabsProps<T extends string> {
  items: ReadonlyArray<{ key: T; label: string }>;
  activeKey: T;
  onChange: (key: T) => void;
}

/** Fixed-size FORGE / VENDOR tabs — same active chrome as loadout category tabs. */
export function MarketTabs<T extends string>({
  items,
  activeKey,
  onChange,
}: MarketTabsProps<T>): React.JSX.Element {
  const { theme } = useTerminal();

  return (
    <View style={styles.tabRow}>
      {items.map((item) => {
        const active = activeKey === item.key;
        return (
          <HapticPressable
            key={item.key}
            onPress={() => onChange(item.key)}
            style={(state) => [
              styles.tab,
              {
                borderColor: active ? SELECT_ACCENT : theme.borderColor,
                backgroundColor: active ? withAlpha(SELECT_ACCENT, '18') : 'rgba(0, 0, 0, 0.35)',
              },
              terminalHoverStyle(readPressableHover(state), state.pressed),
            ]}
          >
            <TerminalText
              variant="body"
              letterSpacing={0.8}
              style={{
                color: active ? SELECT_ACCENT : theme.mutedColor,
                fontWeight: '700',
              }}
            >
              {item.label}
            </TerminalText>
          </HapticPressable>
        );
      })}
    </View>
  );
}

interface MarketImageCellProps {
  itemId?: CargoItemId;
  source?: ImageSourcePropType;
  borderColor?: string;
}

/** Shared right-rail image cell — 124px wide, centered art, blue-gray divider. */
export function MarketImageCell({
  itemId,
  source,
  borderColor = DOSSIER_BORDER,
}: MarketImageCellProps): React.JSX.Element {
  const resolved = source ?? (itemId ? resolveCargoItemIcon(itemId) : null);
  return (
    <View style={[styles.imageCell, { borderLeftColor: borderColor }]}>
      {resolved ? (
        <Image
          source={resolved}
          resizeMode="contain"
          style={styles.imageArt}
        />
      ) : null}
    </View>
  );
}

interface MarketRowProps {
  title: string;
  subtitle?: string;
  /** Green value line (price / stash count) — same slot as Vendor CR. */
  valueLine?: string;
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  borderColor: string;
  textColor: string;
  mutedColor: string;
  accentColor?: string;
  imageItemId?: CargoItemId;
  imageSource?: ImageSourcePropType;
  actions?: React.ReactNode;
  showImage?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Shared market listing / ledger / fence row construction. */
export function MarketRow({
  title,
  subtitle,
  valueLine,
  selected = false,
  disabled = false,
  onPress,
  borderColor,
  textColor,
  mutedColor,
  accentColor = SELECT_ACCENT,
  imageItemId,
  imageSource,
  actions,
  showImage = true,
  style,
}: MarketRowProps): React.JSX.Element {
  const rowStyle = [
    styles.row,
    {
      borderColor: selected ? accentColor : borderColor,
      backgroundColor: DOSSIER_ROW_BG,
      opacity: disabled ? 0.55 : 1,
    },
    selected ? styles.rowSelected : null,
    style,
  ];

  const content = (
    <>
      <View style={styles.rowCopy}>
        <TerminalText
          variant="body"
          style={{ color: selected ? accentColor : textColor, fontWeight: '700' }}
          numberOfLines={1}
        >
          {title}
        </TerminalText>
        {subtitle ? (
          <TerminalText variant="caption" style={{ color: mutedColor }} numberOfLines={2}>
            {subtitle}
          </TerminalText>
        ) : null}
        {valueLine ? (
          <TerminalText variant="body" style={styles.valueLine}>
            {valueLine}
          </TerminalText>
        ) : null}
      </View>
      {actions ? <View style={styles.rowActions}>{actions}</View> : null}
      {showImage ? (
        <MarketImageCell
          itemId={imageItemId}
          source={imageSource}
          borderColor={mutedColor}
        />
      ) : null}
    </>
  );

  if (!onPress) {
    return <View style={rowStyle}>{content}</View>;
  }

  return (
    <HapticPressable
      onPress={onPress}
      style={(state) => [
        ...rowStyle,
        terminalHoverStyle(readPressableHover(state), state.pressed),
      ]}
    >
      {content}
    </HapticPressable>
  );
}


type MarketActionVariant = 'primary' | 'disabled' | 'stepper';

interface MarketActionButtonProps {
  label: string;
  onPress: () => void;
  accentColor?: string;
  mutedColor?: string;
  disabled?: boolean;
  variant?: MarketActionVariant;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Shared BUY / SELL / FABRICATE (+/−) action chrome. */
export function MarketActionButton({
  label,
  onPress,
  accentColor = SELECT_ACCENT,
  mutedColor = MARKET_MUTED_LINE,
  disabled = false,
  variant = 'primary',
  fullWidth = false,
  style,
}: MarketActionButtonProps): React.JSX.Element {
  const isStepper = variant === 'stepper';
  const isDisabled = disabled || variant === 'disabled';
  const height = isStepper ? MARKET_STEPPER_BTN_HEIGHT : MARKET_PRIMARY_BTN_HEIGHT;

  return (
    <TacticalButton
      label={label}
      active={!isDisabled}
      onPress={onPress}
      accentColor={accentColor}
      mutedColor={mutedColor}
      variant={fullWidth ? 'cta' : 'inline'}
      disabled={isDisabled}
      suppressGlow
      labelSize={isStepper ? 10 : undefined}
      labelLineHeight={isStepper ? 14 : undefined}
      style={[
        dossierOpaqueCtaStyle(accentColor),
        {
          minHeight: height,
          height,
          paddingVertical: 0,
          paddingHorizontal: isStepper ? 10 : 14,
          justifyContent: 'center',
          backgroundColor: DOSSIER_CTA_BG,
          borderWidth: 1,
          opacity: isDisabled ? MARKET_DISABLED_OPACITY : 1,
        },
        fullWidth ? styles.fullWidthBtn : null,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  grid: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  gridStacked: {
    flexDirection: 'column',
  },
  gridColumn: {
    minWidth: 0,
    minHeight: 0,
  },
  gridLeft: {
    flex: MARKET_LEFT_FLEX,
  },
  gridRight: {
    flex: MARKET_RIGHT_FLEX,
  },
  gridLeftStacked: {
    flexGrow: 0,
    flexShrink: 0,
    maxHeight: 300,
  },
  gridRightStacked: {
    flex: 1,
  },
  panelHost: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    gap: MARKET_SECTION_GAP,
  },
  panelBody: {
    flex: 1,
    minHeight: 0,
    flexDirection: 'column',
    gap: 8,
  },
  panelSubtitle: {
    flexShrink: 0,
    gap: 4,
  },
  panelMain: {
    flex: 1,
    minHeight: 0,
  },
  panelFooter: {
    flexShrink: 0,
  },
  tabRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: MARKET_TAB_GAP,
  },
  tab: {
    width: MARKET_TAB_WIDTH,
    height: MARKET_TAB_HEIGHT,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageCell: {
    width: MARKET_IMAGE_CELL_WIDTH,
    alignSelf: 'stretch',
    borderLeftWidth: 1,
    backgroundColor: MARKET_IMAGE_CELL_BG,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  imageArt: {
    width: MARKET_IMAGE_MAX,
    height: MARKET_IMAGE_MAX,
  },
  row: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'stretch',
    borderWidth: 1,
    minHeight: MARKET_ROW_MIN_HEIGHT,
    overflow: 'hidden',
  },
  rowSelected: {
    shadowColor: SELECT_ACCENT,
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  valueLine: {
    color: SELECT_ACCENT,
    fontWeight: '700',
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  fullWidthBtn: {
    width: '100%',
    alignSelf: 'stretch',
  },
});
