import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { VEIL, type VeilTone } from '../../../theme/veilTerminalTokens';

interface CabalMarkProps {
  tone: VeilTone;
  selected?: boolean;
  size?: 'sm' | 'md';
}

/**
 * Abstract Cabal identity mark — shape differs by stable Cabal ID mapping.
 * Decorative only.
 */
export default function CabalMark({
  tone,
  selected = false,
  size = 'md',
}: CabalMarkProps): React.JSX.Element {
  const color = selected ? tone.accent : VEIL.lineStrong;
  const opacity = selected ? 0.95 : 0.55;
  const h = size === 'sm' ? 12 : 16;

  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      {...(Platform.OS === 'web' ? ({ 'aria-hidden': true } as object) : null)}
      style={[styles.wrap, { height: h, opacity }]}
    >
      {tone.mark === 'stamp' ? (
        <>
          <View style={[styles.stamp, { borderColor: color, height: h }]} />
          <View style={[styles.stampInner, { backgroundColor: color, height: h - 4 }]} />
        </>
      ) : tone.mark === 'arc' ? (
        <View
          style={[
            styles.arc,
            {
              width: h,
              height: h,
              borderColor: color,
            },
          ]}
        />
      ) : tone.mark === 'fracture' ? (
        <>
          <View style={[styles.bar, { backgroundColor: color, height: h * 0.55 }]} />
          <View style={[styles.barOffset, { backgroundColor: color, height: h * 0.4 }]} />
        </>
      ) : (
        <View style={[styles.bar, { backgroundColor: color, height: h }]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    flexShrink: 0,
    gap: 2,
  },
  bar: {
    width: 2,
  },
  barOffset: {
    width: 2,
    marginTop: 4,
    opacity: 0.55,
  },
  stamp: {
    width: 8,
    borderWidth: 1,
  },
  stampInner: {
    position: 'absolute',
    left: 3,
    width: 2,
  },
  arc: {
    borderWidth: 1,
    borderRadius: 99,
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
    transform: [{ rotate: '-18deg' }],
  },
});
