import React from 'react';
import { Platform, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import HapticPressable from '../HapticPressable';
import TerminalText from '../TerminalText';
import { HUB_CTA_INVERSE_TEXT } from '../../theme/hubPanelSurfaces';
import { VEIL } from '../../theme/veilTerminalTokens';
import { viewShadow } from '../../utils/adaptiveStyles';
import { readPressableHover } from '../../utils/terminalHoverStyle';

export type HubPrimaryCtaVariant = 'glow' | 'danger' | 'classic';

interface HubPrimaryCtaProps {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  /**
   * `glow` — Accept Contract: muted rest tint + mint cyber glow (default).
   * `danger` — same treatment in blood red (Abort / Abandon / Cancel).
   * `classic` — mint outline at rest, solid mint fill + inverse label on hover.
   */
  variant?: HubPrimaryCtaVariant;
  /** Accent override for the glow variant only. */
  accentColor?: string;
  size?: number;
  letterSpacing?: number;
  style?: StyleProp<ViewStyle>;
  minHeight?: number;
}

function withAlpha(color: string, alphaHex: string): string {
  if (color.startsWith('#') && color.length === 7) {
    return `${color}${alphaHex}`;
  }
  if (color.startsWith('rgb(')) {
    return color.replace('rgb(', 'rgba(').replace(')', `, ${Number.parseInt(alphaHex, 16) / 255})`);
  }
  return color;
}

const DANGER = VEIL.blood;
const DANGER_BRIGHT = '#D48A93';

/**
 * Shared hub / encounter primary CTA.
 * Default matches Accept Contract (mint glow).
 */
export default function HubPrimaryCta({
  label,
  onPress,
  disabled = false,
  accessibilityLabel,
  variant = 'glow',
  accentColor = VEIL.mint,
  size = 8,
  letterSpacing = 1,
  style,
  minHeight = 50,
}: HubPrimaryCtaProps): React.JSX.Element {
  const inactive = disabled || !onPress;
  const isDanger = variant === 'danger';
  const glowAccent = isDanger ? DANGER : accentColor;
  const glowBright = isDanger ? DANGER_BRIGHT : accentColor;

  if (variant === 'classic') {
    return (
      <HapticPressable
        onPress={onPress}
        disabled={inactive}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled: inactive }}
        style={({
          pressed,
          hovered,
          focused,
        }: { pressed: boolean; hovered?: boolean; focused?: boolean }) => ([
          styles.button,
          { minHeight },
          styles.classicRest,
          !inactive && (hovered || pressed) ? styles.classicHover : null,
          inactive ? styles.classicDisabled : null,
          focused && !inactive ? styles.focus : null,
          Platform.OS === 'web'
            ? ({ cursor: inactive ? 'not-allowed' : 'pointer' } as object)
            : null,
          style,
        ])}
      >
        {({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => (
          <TerminalText
            size={size}
            letterSpacing={letterSpacing}
            style={[
              styles.label,
              styles.classicLabel,
              !inactive && (hovered || pressed) ? styles.classicLabelHover : null,
              inactive ? styles.classicLabelDisabled : null,
            ]}
          >
            {label}
          </TerminalText>
        )}
      </HapticPressable>
    );
  }

  return (
    <HapticPressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive }}
      style={(state: { pressed: boolean; hovered?: boolean; focused?: boolean }) => {
        const { pressed, focused } = state;
        const hovered = readPressableHover(state);
        const awake = !inactive && (hovered || pressed || Boolean(focused));
        return [
          styles.button,
          {
            minHeight,
            backgroundColor: awake
              ? withAlpha(glowAccent, '33')
              : withAlpha(glowAccent, inactive ? '10' : '18'),
            borderColor: awake
              ? glowBright
              : withAlpha(glowAccent, inactive ? '55' : '88'),
            borderWidth: 2,
            ...viewShadow({
              color: glowAccent,
              opacity: inactive ? 0.42 : awake ? 0.95 : 0.72,
              radius: inactive ? 10 : awake ? 16 : 12,
              offset: { width: 0, height: 0 },
            }),
            opacity: inactive ? 0.72 : pressed ? 0.9 : 1,
          },
          focused && !inactive
            ? (isDanger ? styles.focusDanger : styles.focus)
            : null,
          Platform.OS === 'web'
            ? ({ cursor: inactive ? 'not-allowed' : 'pointer' } as object)
            : null,
          style,
        ];
      }}
    >
      {({ pressed, hovered, focused }: { pressed: boolean; hovered?: boolean; focused?: boolean }) => {
        const awake = !inactive && (hovered || pressed || focused);
        return (
          <TerminalText
            size={size}
            letterSpacing={letterSpacing}
            style={[
              styles.label,
              {
                color: inactive
                  ? withAlpha(glowAccent, '66')
                  : awake
                    ? glowBright
                    : withAlpha(glowAccent, '99'),
              },
            ]}
          >
            {label}
          </TerminalText>
        );
      }}
    </HapticPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 0,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
        transitionProperty: 'background-color, border-color, opacity, box-shadow',
        transitionDuration: '140ms',
        transitionTimingFunction: 'ease-out',
      } as object,
      default: {},
    }),
  },
  classicRest: {
    backgroundColor: VEIL.surface3,
    borderWidth: 1,
    borderColor: VEIL.mint,
  },
  classicHover: {
    backgroundColor: VEIL.mint,
    borderColor: VEIL.mintBright,
  },
  classicDisabled: {
    backgroundColor: 'rgba(185, 181, 167, 0.03)',
    borderColor: 'rgba(185, 181, 167, 0.16)',
  },
  classicLabel: {
    color: VEIL.mintBright,
  },
  classicLabelHover: {
    color: HUB_CTA_INVERSE_TEXT,
  },
  classicLabelDisabled: {
    color: 'rgba(222, 227, 223, 0.32)',
  },
  label: {
    fontWeight: '800',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  focus: {
    outlineStyle: 'solid',
    outlineWidth: 1,
    outlineColor: VEIL.mintBright,
    outlineOffset: 2,
  } as ViewStyle,
  focusDanger: {
    outlineStyle: 'solid',
    outlineWidth: 1,
    outlineColor: DANGER_BRIGHT,
    outlineOffset: 2,
  } as ViewStyle,
});
