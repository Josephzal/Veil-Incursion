import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import type { VeilTone } from '../../../theme/veilTerminalTokens';
import { VEIL } from '../../../theme/veilTerminalTokens';

interface RegistrationBracketsProps {
  tone?: VeilTone;
  active?: boolean;
}

/** Corner registration brackets for selected / raised surfaces. Decorative only. */
export default function RegistrationBrackets({
  tone,
  active = false,
}: RegistrationBracketsProps): React.JSX.Element {
  const color = active ? (tone?.accent ?? VEIL.mint) : VEIL.lineStrong;
  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      {...(Platform.OS === 'web' ? ({ 'aria-hidden': true } as object) : null)}
      style={StyleSheet.absoluteFill}
    >
      <View style={[styles.bracket, styles.tl, { borderColor: color }]} />
      <View style={[styles.bracket, styles.br, { borderColor: color, opacity: active ? 0.85 : 0.4 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  bracket: {
    position: 'absolute',
    width: 10,
    height: 10,
  },
  tl: {
    top: 6,
    left: 6,
    borderTopWidth: 1,
    borderLeftWidth: 1,
  },
  br: {
    right: 6,
    bottom: 6,
    borderRightWidth: 1,
    borderBottomWidth: 1,
  },
});
