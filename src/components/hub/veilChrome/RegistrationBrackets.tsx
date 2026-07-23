import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import type { VeilTone } from '../../../theme/veilTerminalTokens';
import { VEIL } from '../../../theme/veilTerminalTokens';

interface RegistrationBracketsProps {
  tone?: VeilTone;
  active?: boolean;
  /** `diagonal` = TL + BR (default). `all` also includes TR + BL. */
  corners?: 'diagonal' | 'all';
}

/** Corner registration brackets for selected / raised surfaces. Decorative only. */
export default function RegistrationBrackets({
  tone,
  active = false,
  corners = 'diagonal',
}: RegistrationBracketsProps): React.JSX.Element {
  const color = active ? (tone?.accent ?? VEIL.mint) : VEIL.lineStrong;
  const activeOpacity = active ? 0.85 : 0.4;
  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      {...(Platform.OS === 'web' ? ({ 'aria-hidden': true } as object) : null)}
      style={StyleSheet.absoluteFill}
    >
      <View style={[styles.bracket, styles.tl, { borderColor: color }]} />
      <View style={[styles.bracket, styles.br, { borderColor: color, opacity: activeOpacity }]} />
      {corners === 'all' ? (
        <>
          <View style={[styles.bracket, styles.tr, { borderColor: color, opacity: activeOpacity }]} />
          <View style={[styles.bracket, styles.bl, { borderColor: color, opacity: activeOpacity }]} />
        </>
      ) : null}
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
  tr: {
    top: 6,
    right: 6,
    borderTopWidth: 1,
    borderRightWidth: 1,
  },
  bl: {
    left: 6,
    bottom: 6,
    borderBottomWidth: 1,
    borderLeftWidth: 1,
  },
  br: {
    right: 6,
    bottom: 6,
    borderRightWidth: 1,
    borderBottomWidth: 1,
  },
});
