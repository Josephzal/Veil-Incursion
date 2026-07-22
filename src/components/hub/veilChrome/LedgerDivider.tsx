import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { VEIL } from '../../../theme/veilTerminalTokens';

interface LedgerDividerProps {
  tone?: 'neutral' | 'corrupt';
  inset?: boolean;
}

/** Short bureaucratic / corrupted divider. Decorative only. */
export default function LedgerDivider({
  tone = 'neutral',
  inset = true,
}: LedgerDividerProps): React.JSX.Element {
  const corrupt = tone === 'corrupt';
  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      {...(Platform.OS === 'web' ? ({ 'aria-hidden': true } as object) : null)}
      style={[styles.wrap, inset && styles.inset]}
    >
      <View
        style={[
          styles.line,
          { backgroundColor: corrupt ? VEIL.blood : VEIL.line },
          corrupt && styles.lineCorrupt,
        ]}
      />
      {corrupt ? <View style={[styles.gap, { backgroundColor: VEIL.lineFaint }]} /> : null}
      {corrupt ? (
        <View style={[styles.tick, { backgroundColor: VEIL.blood, opacity: 0.45 }]} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 8,
    gap: 4,
  },
  inset: {
    marginHorizontal: 4,
  },
  line: {
    flex: 1,
    maxWidth: 120,
    height: StyleSheet.hairlineWidth,
  },
  lineCorrupt: {
    maxWidth: 54,
  },
  gap: {
    width: 8,
    height: StyleSheet.hairlineWidth,
  },
  tick: {
    width: 14,
    height: 2,
  },
});
