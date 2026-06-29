import React, { useMemo } from 'react';
import { Platform, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
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
  /** Nav rail hardware tab (vertical stack) vs inline hub tab. */
  variant?: 'rail' | 'inline';
  style?: StyleProp<ViewStyle>;
}

/** Scaled terminal nav / action button — desktop web typography only. */
export default function TacticalButton({
  label,
  active,
  onPress,
  accentColor,
  mutedColor,
  variant = 'rail',
  style,
}: TacticalButtonProps): React.JSX.Element {
  const { scaleSize, scaleSpacing } = useResponsiveScale();
  const isRail = variant === 'rail';

  const metrics = useMemo(
    () => ({
      minHeight: scaleSize(isRail ? 40 : 36),
      paddingVertical: scaleSpacing(isRail ? 10 : 8),
      paddingHorizontal: scaleSpacing(isRail ? 6 : 12),
      minWidth: isRail ? undefined : scaleSize(72),
    }),
    [isRail, scaleSize, scaleSpacing],
  );

  return (
    <HapticPressable
      onPress={onPress}
      style={[
        isRail ? styles.railCell : styles.inlineCell,
        active ? styles.cellActive : styles.cellInactive,
        {
          minHeight: metrics.minHeight,
          paddingVertical: metrics.paddingVertical,
          paddingHorizontal: metrics.paddingHorizontal,
          minWidth: metrics.minWidth,
        },
        active
          ? {
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
        style,
      ]}
    >
      <TerminalText
        size={isRail ? 7 : 8}
        lineHeight={isRail ? 10 : 12}
        letterSpacing={isRail ? 1.1 : 1}
        style={[
          styles.label,
          { color: active ? accentColor : `${mutedColor}bb` },
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
