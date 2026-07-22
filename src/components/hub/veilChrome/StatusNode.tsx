import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { VEIL, type VeilTone } from '../../../theme/veilTerminalTokens';

interface StatusNodeProps {
  tone?: VeilTone;
  state?: 'idle' | 'active' | 'unstable';
  size?: number;
  /** Soft glow — reserved for genuinely live signals. Default off. */
  glow?: boolean;
}

/** Decorative signal node — never interactive or announced. */
export default function StatusNode({
  tone,
  state = 'idle',
  size = 5,
  glow = false,
}: StatusNodeProps): React.JSX.Element {
  const color = state === 'idle'
    ? VEIL.textDim
    : state === 'unstable'
      ? (tone?.accent ?? VEIL.occultUnstable)
      : (tone?.accent ?? VEIL.mint);

  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      {...(Platform.OS === 'web' ? ({ 'aria-hidden': true } as object) : null)}
      style={[
        styles.node,
        {
          width: size,
          height: size,
          backgroundColor: color,
          opacity: state === 'idle' ? 0.45 : 0.95,
        },
        glow && state !== 'idle' && Platform.OS === 'web'
          ? ({ boxShadow: `0 0 7px rgba(${tone?.rgb ?? '104, 214, 188'}, 0.28)` } as object)
          : null,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  node: {
    flexShrink: 0,
  },
});
