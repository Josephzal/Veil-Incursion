import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import HapticPressable from '../HapticPressable';
import TerminalText from '../TerminalText';
import { VEIL } from '../../theme/veilTerminalTokens';
import {
  hubPrimaryActionHoverStyle,
  hubPrimaryActionStyle,
  hubPrimaryActionTextHoverStyle,
  hubPrimaryActionTextStyle,
} from '../../theme/hubPanelSurfaces';

interface HubPrimaryCtaProps {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  size?: number;
  letterSpacing?: number;
  style?: StyleProp<ViewStyle>;
  minHeight?: number;
}

/**
 * Contract Board–aligned primary CTA: mint outline at rest, inverse fill on hover/press.
 */
export default function HubPrimaryCta({
  label,
  onPress,
  disabled = false,
  accessibilityLabel,
  size = 8,
  letterSpacing = 1,
  style,
  minHeight = 50,
}: HubPrimaryCtaProps): React.JSX.Element {
  return (
    <HapticPressable
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      style={({
        pressed,
        hovered,
        focused,
      }: { pressed: boolean; hovered?: boolean; focused?: boolean }) => ([
        styles.button,
        { minHeight },
        hubPrimaryActionStyle(),
        !disabled && (hovered || pressed) ? hubPrimaryActionHoverStyle() : null,
        disabled ? styles.disabled : null,
        focused && !disabled ? styles.focus : null,
        style,
      ])}
    >
      {({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => (
        <TerminalText
          size={size}
          letterSpacing={letterSpacing}
          style={[
            hubPrimaryActionTextStyle(),
            !disabled && (hovered || pressed) ? hubPrimaryActionTextHoverStyle() : null,
            disabled ? styles.disabledText : null,
          ]}
        >
          {label}
        </TerminalText>
      )}
    </HapticPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    backgroundColor: 'rgba(185, 181, 167, 0.03)',
    borderColor: 'rgba(185, 181, 167, 0.16)',
  },
  disabledText: {
    color: 'rgba(222, 227, 223, 0.32)',
  },
  focus: {
    outlineStyle: 'solid',
    outlineWidth: 1,
    outlineColor: VEIL.mint,
    outlineOffset: 2,
  } as ViewStyle,
});
