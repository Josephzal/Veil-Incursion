import React, { useMemo } from 'react';
import { StyleSheet, Text, type StyleProp, type TextProps, type TextStyle } from 'react-native';
import { useResponsiveScale } from '../hooks/useResponsiveScale';

export interface TerminalTextProps extends TextProps {
  style?: StyleProp<TextStyle>;
  /** Base font size before desktop scaling. */
  size?: number;
  /** Base line height before desktop scaling. */
  lineHeight?: number;
  /** Base letter spacing before desktop scaling. */
  letterSpacing?: number;
  /** Secondary/body tier — extra ~1.35× on desktop. */
  tier?: 'body' | 'caption';
}

/** Monospace terminal copy — scales typography on web desktop only. */
export default function TerminalText({
  style,
  size,
  lineHeight,
  letterSpacing,
  tier,
  ...rest
}: TerminalTextProps): React.JSX.Element {
  const { isDesktop, scaleSize, scaleSpacing } = useResponsiveScale();

  const scaledStyle = useMemo(() => {
    const flat = StyleSheet.flatten(style) ?? {};
    const tierMul = tier === 'caption' ? 1.5 : tier === 'body' ? 1.35 : 1;
    const desktopMul = isDesktop ? tierMul : 1;
    const baseSize = size ?? (typeof flat.fontSize === 'number' ? flat.fontSize : undefined);
    const baseLineHeight = lineHeight ?? (typeof flat.lineHeight === 'number' ? flat.lineHeight : undefined);
    const baseLetterSpacing = letterSpacing
      ?? (typeof flat.letterSpacing === 'number' ? flat.letterSpacing : undefined);

    return {
      ...(baseSize != null ? { fontSize: scaleSize(baseSize * desktopMul) } : null),
      ...(baseLineHeight != null ? { lineHeight: scaleSize(baseLineHeight * desktopMul) } : null),
      ...(baseLetterSpacing != null ? { letterSpacing: scaleSpacing(baseLetterSpacing) } : null),
    };
  }, [isDesktop, letterSpacing, lineHeight, scaleSize, scaleSpacing, size, style, tier]);

  return (
    <Text
      {...rest}
      style={[styles.base, style, scaledStyle]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    fontFamily: 'monospace',
  },
});
