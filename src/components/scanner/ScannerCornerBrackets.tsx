import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface ScannerCornerBracketsProps {
  color: string;
}

export default function ScannerCornerBrackets({
  color,
}: ScannerCornerBracketsProps): React.JSX.Element {
  return (
    <View style={styles.root} pointerEvents="none">
      <Text style={[styles.bracket, styles.tl, { color }]}>{'┌'}</Text>
      <Text style={[styles.bracket, styles.tr, { color }]}>{'┐'}</Text>
      <Text style={[styles.bracket, styles.bl, { color }]}>{'└'}</Text>
      <Text style={[styles.bracket, styles.br, { color }]}>{'┘'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
  },
  bracket: {
    position: 'absolute',
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: '700',
    opacity: 0.72,
  },
  tl: { top: 4, left: 6 },
  tr: { top: 4, right: 6 },
  bl: { bottom: 4, left: 6 },
  br: { bottom: 4, right: 6 },
});
