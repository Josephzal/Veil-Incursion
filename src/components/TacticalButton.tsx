import React, { useMemo } from 'react';
import { Platform, StyleSheet, type PressableProps } from 'react-native';
import HapticPressable from './HapticPressable';
import TerminalText from './TerminalText';
import { viewShadow } from '../utils/adaptiveStyles';
import { useResponsiveScale } from '../hooks/useResponsiveScale';
import {
  HUB_NAV_INACTIVE_BG,
  HUB_NAV_INACTIVE_BORDER,
  HUB_NAV_INACTIVE_TOP_HIGHLIGHT,
} from '../constants/hubAtmosphere';

export interface TacticalButtonProps {
  label: string;
  active: boolean;
  onPress: () => void;
  accentColor: string;
  mutedColor: string;
  /** Nav rail hardware tab (vertical stack) vs inline hub tab vs full-width CTA. */
  variant?: 'rail' | 'inline' | 'cta';
  disabled?: boolean;
  style?: PressableProps['style'];
  labelSize?: number;
  labelLineHeight?: number;
  /** Skip accent glow shadow when active (compact inline controls). */
  suppressGlow?: boolean;
}

/** Scaled terminal nav / action button — desktop web typography only. */
export default function TacticalButton({
  label,
  active,
  onPress,
  accentColor,
  mutedColor,
  variant = 'rail',
  disabled = false,
  style,
  labelSize,
  labelLineHeight,
  suppressGlow = false,
}: TacticalButtonProps): React.JSX.Element {
  const { scaleSize, scaleSpacing } = useResponsiveScale();
  const isRail = variant === 'rail';
  const isCta = variant === 'cta';

  const metrics = useMemo(
    () => ({
      minHeight: scaleSize(isCta ? 48 : isRail ? 40 : 36),
      paddingVertical: scaleSpacing(isCta ? 14 : isRail ? 10 : 8),
      paddingHorizontal: scaleSpacing(isCta ? 16 : isRail ? 6 : 12),
      minWidth: !isRail && !isCta ? scaleSize(72) : undefined,
      fontSize: isCta ? 11 : isRail ? 7 : 8,
      lineHeight: isCta ? 14 : isRail ? 10 : 12,
      letterSpacing: isCta ? 1.2 : isRail ? 1.1 : 1,
    }),
    [isCta, isRail, scaleSize, scaleSpacing],
  );

  return (
    <HapticPressable
      onPress={onPress}
      disabled={disabled}
      style={(state) => [
        isRail ? styles.railCell : isCta ? styles.ctaCell : styles.inlineCell,
        active || isCta ? styles.cellActive : styles.cellInactive,
        {
          minHeight: metrics.minHeight,
          paddingVertical: metrics.paddingVertical,
          paddingHorizontal: metrics.paddingHorizontal,
          ...(metrics.minWidth != null ? { minWidth: metrics.minWidth } : null),
        },
        active || isCta
          ? suppressGlow && !isCta
            ? {
                borderColor: accentColor,
                ...Platform.select({
                  web: { boxShadow: 'none' },
                  default: { shadowOpacity: 0, shadowRadius: 0, elevation: 0 },
                }),
              }
            : {
                borderColor: accentColor,
                backgroundColor: `${accentColor}24`,
                ...viewShadow({
                  color: accentColor,
                  opacity: 0.85,
                  radius: 12,
                  offset: { width: 0, height: 0 },
                }),
              }
          : null,
        typeof style === 'function' ? style(state) : style,
        !disabled && state.pressed
          ? suppressGlow
            ? {
                opacity: 0.72,
                backgroundColor: `${accentColor}28`,
              }
            : { opacity: 0.85 }
          : null,
      ]}
    >
      <TerminalText
        size={labelSize ?? metrics.fontSize}
        lineHeight={labelLineHeight ?? metrics.lineHeight}
        letterSpacing={metrics.letterSpacing}
        style={[
          styles.label,
          { color: active || isCta ? accentColor : `${mutedColor}bb` },
        ]}
        numberOfLines={isRail ? 3 : 1}
        adjustsFontSizeToFit={isRail}
        minimumFontScale={0.75}
      >
        {label}
      </TerminalText>
    </HapticPressable>
  );
}

const styles = StyleSheet.create({
  railCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    width: '100%',
    overflow: 'hidden',
  },
  inlineCell: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaCell: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    width: '100%',
  },
  cellInactive: {
    backgroundColor: HUB_NAV_INACTIVE_BG,
    borderWidth: 1,
    borderColor: HUB_NAV_INACTIVE_BORDER,
    borderTopWidth: 1,
    borderTopColor: HUB_NAV_INACTIVE_TOP_HIGHLIGHT,
  },
  cellActive: {
    borderWidth: 2,
    ...Platform.select({
      android: { elevation: 8 },
      default: {},
    }),
  },
  label: {
    fontWeight: '800',
    textAlign: 'center',
  },
});
