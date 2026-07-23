import React from 'react';
import { StyleSheet, View } from 'react-native';
import { VEIL } from '../../theme/veilTerminalTokens';

interface ScannerCornerBracketsProps {
  color?: string;
}

/** Minimal corner registration marks — instrument frame, not glyph clutter. */
export default function ScannerCornerBrackets({
  color = VEIL.lineStrong,
}: ScannerCornerBracketsProps): React.JSX.Element {
  return (
    <View pointerEvents="none" style={styles.root}>
      <View style={[styles.corner, styles.tl, { borderColor: color }]} />
      <View style={[styles.corner, styles.tr, { borderColor: color }]} />
      <View style={[styles.corner, styles.bl, { borderColor: color }]} />
      <View style={[styles.corner, styles.br, { borderColor: color }]} />
    </View>
  );
}

const ARM = 14;

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    pointerEvents: 'none',
  },
  corner: {
    position: 'absolute',
    width: ARM,
    height: ARM,
  },
  tl: {
    top: 8,
    left: 8,
    borderTopWidth: 1,
    borderLeftWidth: 1,
  },
  tr: {
    top: 8,
    right: 8,
    borderTopWidth: 1,
    borderRightWidth: 1,
  },
  bl: {
    bottom: 8,
    left: 8,
    borderBottomWidth: 1,
    borderLeftWidth: 1,
  },
  br: {
    bottom: 8,
    right: 8,
    borderBottomWidth: 1,
    borderRightWidth: 1,
  },
});
