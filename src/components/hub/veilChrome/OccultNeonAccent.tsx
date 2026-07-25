import React from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

/** Occult neon palette — deeper violet/pink; restrained bloom. */
export const OCCULT_NEON = {
  core: '#B88DD4',
  mid: '#8A55B0',
  hot: '#963A76',
  glowWeb: [
    '0 0 2px rgba(184, 141, 212, 0.62)',
    '0 0 8px rgba(150, 58, 118, 0.42)',
    '0 0 14px rgba(138, 85, 176, 0.24)',
  ].join(', '),
  glowWebRail: [
    '0 0 2px rgba(184, 141, 212, 0.62)',
    '0 0 8px rgba(150, 58, 118, 0.42)',
    '2px 0 14px rgba(138, 85, 176, 0.24)',
  ].join(', '),
  glowWebBar: [
    '0 0 2px rgba(184, 141, 212, 0.62)',
    '0 0 8px rgba(150, 58, 118, 0.42)',
    '0 -2px 14px rgba(138, 85, 176, 0.24)',
  ].join(', '),
} as const;

type OccultNeonOrientation = 'vertical' | 'horizontal';

interface OccultNeonRailProps {
  style?: StyleProp<ViewStyle>;
  orientation?: OccultNeonOrientation;
}

/**
 * Supernatural neon rail — bright core with soft violet/pink bloom.
 * Decorative only. Vertical for left accents; horizontal for nav underlines.
 */
export default function OccultNeonRail({
  style,
  orientation = 'vertical',
}: OccultNeonRailProps): React.JSX.Element {
  const horizontal = orientation === 'horizontal';
  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      {...(Platform.OS === 'web' ? ({ 'aria-hidden': true } as object) : null)}
      style={[
        styles.host,
        horizontal ? styles.hostHorizontal : styles.hostVertical,
        style,
      ]}
    >
      <View style={[styles.bloom, horizontal ? styles.bloomHorizontal : styles.bloomVertical]} />
      <View style={[styles.core, horizontal ? styles.coreHorizontal : styles.coreVertical]} />
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    zIndex: 2,
    overflow: 'visible',
  },
  hostVertical: {
    left: 0,
    width: 12,
  },
  hostHorizontal: {
    bottom: 0,
    height: 12,
  },
  bloom: {
    position: 'absolute',
  },
  bloomVertical: {
    top: 0,
    bottom: 0,
    left: 0,
    width: 10,
    ...Platform.select({
      web: {
        backgroundImage:
          'linear-gradient(90deg, rgba(150, 58, 118, 0.24), rgba(138, 85, 176, 0.1) 45%, rgba(138, 85, 176, 0) 100%)',
        filter: 'blur(0.9px)',
      } as object,
      default: {
        backgroundColor: 'rgba(150, 58, 118, 0.14)',
      },
    }),
  },
  bloomHorizontal: {
    left: 0,
    right: 0,
    bottom: 0,
    height: 10,
    ...Platform.select({
      web: {
        backgroundImage:
          'linear-gradient(0deg, rgba(150, 58, 118, 0.24), rgba(138, 85, 176, 0.1) 45%, rgba(138, 85, 176, 0) 100%)',
        filter: 'blur(0.9px)',
      } as object,
      default: {
        backgroundColor: 'rgba(150, 58, 118, 0.14)',
      },
    }),
  },
  core: {
    position: 'absolute',
  },
  coreVertical: {
    top: 0,
    bottom: 0,
    left: 0,
    width: 2,
    ...Platform.select({
      web: {
        backgroundImage: `linear-gradient(180deg, ${OCCULT_NEON.core}, ${OCCULT_NEON.mid} 42%, ${OCCULT_NEON.hot} 100%)`,
        boxShadow: OCCULT_NEON.glowWebRail,
      } as object,
      default: {
        backgroundColor: OCCULT_NEON.mid,
        shadowColor: OCCULT_NEON.hot,
        shadowOpacity: 0.42,
        shadowRadius: 6,
        shadowOffset: { width: 2, height: 0 },
      },
    }),
  },
  coreHorizontal: {
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
    ...Platform.select({
      web: {
        backgroundImage: `linear-gradient(90deg, ${OCCULT_NEON.hot}, ${OCCULT_NEON.mid} 42%, ${OCCULT_NEON.core} 100%)`,
        boxShadow: OCCULT_NEON.glowWebBar,
      } as object,
      default: {
        backgroundColor: OCCULT_NEON.mid,
        shadowColor: OCCULT_NEON.hot,
        shadowOpacity: 0.42,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: -2 },
      },
    }),
  },
});
