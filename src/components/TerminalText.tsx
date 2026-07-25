import React, { useMemo } from 'react';
import { StyleSheet, Text, type StyleProp, type TextProps, type TextStyle } from 'react-native';
import { HUB_LINE_HEIGHT, HUB_TYPE, type HubTypeToken } from '../constants/hubTypography';
import { useHubLayout } from '../context/HubLayoutContext';

export interface TerminalTextProps extends TextProps {
  style?: StyleProp<TextStyle>;
  /** Base font size before desktop scaling. Overrides `variant`. */
  size?: number;
  /** Base line height before desktop scaling. */
  lineHeight?: number;
  /** Base letter spacing before desktop scaling. */
  letterSpacing?: number;
  /** Semantic hub type token — used when `size` is omitted. */
  variant?: HubTypeToken;
  /** @deprecated Use `variant="body"` or `variant="caption"`. */
  tier?: 'body' | 'caption';
}

/** Monospace terminal copy — scales typography on web desktop only. */
export default function TerminalText({
  style,
  size,
  lineHeight,
  letterSpacing,
  variant,
  tier,
  ...rest
}: TerminalTextProps): React.JSX.Element {
  const { scaleFont, scaleSpacing } = useHubLayout();

  const scaledStyle = useMemo(() => {
    const flat = StyleSheet.flatten(style) ?? {};
    const tierToken: HubTypeToken | undefined = tier === 'caption'
      ? 'caption'
      : tier === 'body'
        ? 'body'
        : undefined;
    const token = variant ?? tierToken;
    const baseSize = size
      ?? (token != null ? HUB_TYPE[token] : undefined)
      ?? (typeof flat.fontSize === 'number' ? flat.fontSize : undefined);
    const baseLineHeight = lineHeight
      ?? (token != null ? HUB_LINE_HEIGHT[token] : undefined)
      ?? (typeof flat.lineHeight === 'number' ? flat.lineHeight : undefined);
    const baseLetterSpacing = letterSpacing
      ?? (typeof flat.letterSpacing === 'number' ? flat.letterSpacing : undefined);

    // Preserve CSS clamp()/string sizes from style (web harvest polish, etc.).
    const styleHasCssFontSize = typeof flat.fontSize === 'string';
    const styleHasCssLineHeight = typeof flat.lineHeight === 'string';
    const styleHasCssLetterSpacing = typeof flat.letterSpacing === 'string';

    return {
      ...(baseSize != null && !styleHasCssFontSize ? { fontSize: scaleFont(baseSize) } : null),
      ...(baseLineHeight != null && !styleHasCssLineHeight
        ? { lineHeight: scaleFont(baseLineHeight) }
        : null),
      ...(baseLetterSpacing != null && !styleHasCssLetterSpacing
        ? { letterSpacing: scaleSpacing(baseLetterSpacing) }
        : null),
    };
  }, [letterSpacing, lineHeight, scaleFont, scaleSpacing, size, style, tier, variant]);

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
