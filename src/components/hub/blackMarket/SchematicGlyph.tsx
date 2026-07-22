import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import type { CraftingRecipeKind } from '../../../data/craftingRegistry';

export type SchematicGlyphFamily =
  | 'ward'
  | 'blood'
  | 'pocket'
  | 'battery'
  | 'tracker'
  | 'consumable'
  | 'run'
  | 'sealed'
  | 'generic';

const STROKE = 'rgba(142, 223, 198, 0.72)';
const STROKE_DIM = 'rgba(137, 170, 163, 0.38)';
const UV = 'rgba(153, 136, 179, 0.55)';

/** Deterministic classification stamp for dossier chrome. */
export function schematicClassificationCode(recipeId: string): string {
  let hash = 0;
  for (let i = 0; i < recipeId.length; i += 1) {
    hash = (hash * 31 + recipeId.charCodeAt(i)) >>> 0;
  }
  return `CLR-${String((hash % 90) + 1).padStart(2, '0')}`;
}

/** Map recipe identity to a reusable occult seal family. */
export function resolveSchematicGlyphFamily(
  recipeId: string,
  kind: CraftingRecipeKind,
  sealed = false,
): SchematicGlyphFamily {
  if (sealed) return 'sealed';
  const id = recipeId.toLowerCase();
  if (id.includes('chalk') || id.includes('ward')) return 'ward';
  if (id.includes('blood') || id.includes('adrenaline')) return 'blood';
  if (id.includes('smuggler') || id.includes('pocket')) return 'pocket';
  if (id.includes('kinetic') || id.includes('battery')) return 'battery';
  if (id.includes('dead') || id.includes('tracker') || id.includes('drop')) return 'tracker';
  if (kind === 'CONSUMABLE') return 'consumable';
  return 'generic';
}

function GlyphPaths({
  family,
  accent,
}: {
  family: SchematicGlyphFamily;
  accent: string;
}): React.JSX.Element {
  const dim = family === 'sealed' ? UV : STROKE_DIM;
  const bright = family === 'sealed' ? UV : accent;

  switch (family) {
    case 'ward':
      return (
        <>
          <Circle cx="48" cy="48" r="34" stroke={dim} strokeWidth="1" fill="none" />
          <Circle cx="48" cy="48" r="22" stroke={bright} strokeWidth="1.2" fill="none" />
          <Path d="M48 18 L62 48 L48 78 L34 48 Z" stroke={bright} strokeWidth="1.1" fill="none" />
          <Line x1="48" y1="24" x2="48" y2="72" stroke={dim} strokeWidth="0.8" />
          <Line x1="26" y1="48" x2="70" y2="48" stroke={dim} strokeWidth="0.8" />
        </>
      );
    case 'blood':
      return (
        <>
          <Circle cx="48" cy="48" r="30" stroke={dim} strokeWidth="1" fill="none" />
          <Path
            d="M48 22 C58 34 66 42 66 52 C66 62 58 70 48 70 C38 70 30 62 30 52 C30 42 38 34 48 22 Z"
            stroke={bright}
            strokeWidth="1.2"
            fill="none"
          />
          <Circle cx="48" cy="52" r="6" stroke={bright} strokeWidth="1" fill="none" />
        </>
      );
    case 'pocket':
      return (
        <>
          <Rect x="24" y="28" width="48" height="40" rx="3" stroke={bright} strokeWidth="1.2" fill="none" />
          <Path d="M24 40 H72" stroke={dim} strokeWidth="0.9" />
          <Path d="M36 40 V68 M60 40 V68" stroke={dim} strokeWidth="0.9" />
          <Circle cx="48" cy="34" r="3" stroke={bright} strokeWidth="1" fill="none" />
        </>
      );
    case 'battery':
      return (
        <>
          <Rect x="30" y="26" width="36" height="48" rx="2" stroke={bright} strokeWidth="1.2" fill="none" />
          <Rect x="40" y="20" width="16" height="8" stroke={dim} strokeWidth="1" fill="none" />
          <Line x1="38" y1="40" x2="58" y2="40" stroke={bright} strokeWidth="1.1" />
          <Line x1="38" y1="50" x2="58" y2="50" stroke={dim} strokeWidth="1" />
          <Line x1="38" y1="60" x2="52" y2="60" stroke={dim} strokeWidth="1" />
        </>
      );
    case 'tracker':
      return (
        <>
          <Circle cx="48" cy="48" r="28" stroke={dim} strokeWidth="1" fill="none" />
          <Circle cx="48" cy="48" r="12" stroke={bright} strokeWidth="1.2" fill="none" />
          <Circle cx="48" cy="48" r="3" fill={bright} />
          <Line x1="48" y1="14" x2="48" y2="28" stroke={bright} strokeWidth="1" />
          <Line x1="48" y1="68" x2="48" y2="82" stroke={dim} strokeWidth="1" />
          <Line x1="14" y1="48" x2="28" y2="48" stroke={dim} strokeWidth="1" />
          <Line x1="68" y1="48" x2="82" y2="48" stroke={bright} strokeWidth="1" />
        </>
      );
    case 'consumable':
      return (
        <>
          <Path d="M38 22 H58 V34 L66 70 H30 L38 34 Z" stroke={bright} strokeWidth="1.2" fill="none" />
          <Line x1="34" y1="52" x2="62" y2="52" stroke={dim} strokeWidth="0.9" />
          <Circle cx="48" cy="60" r="4" stroke={bright} strokeWidth="1" fill="none" />
        </>
      );
    case 'run':
      return (
        <>
          <Circle cx="48" cy="48" r="30" stroke={dim} strokeWidth="1" fill="none" />
          <Path d="M48 22 L68 58 H28 Z" stroke={bright} strokeWidth="1.2" fill="none" />
          <Line x1="48" y1="38" x2="48" y2="52" stroke={bright} strokeWidth="1.1" />
          <Circle cx="48" cy="58" r="2.5" fill={bright} />
        </>
      );
    case 'sealed':
      return (
        <>
          <Circle cx="48" cy="48" r="32" stroke={UV} strokeWidth="1" fill="none" />
          <Circle cx="48" cy="48" r="18" stroke={UV} strokeWidth="1.1" fill="none" strokeDasharray="3 4" />
          <Path d="M36 48 H60 M48 36 V60" stroke={UV} strokeWidth="1" />
          <Path d="M40 40 L56 56 M56 40 L40 56" stroke="rgba(153,136,179,0.35)" strokeWidth="0.8" />
        </>
      );
    default:
      return (
        <>
          <Circle cx="48" cy="48" r="32" stroke={dim} strokeWidth="1" fill="none" />
          <Circle cx="48" cy="48" r="16" stroke={bright} strokeWidth="1.15" fill="none" />
          <Path d="M48 26 L58 48 L48 70 L38 48 Z" stroke={bright} strokeWidth="1.1" fill="none" />
        </>
      );
  }
}

interface SchematicGlyphProps {
  family: SchematicGlyphFamily;
  size?: number;
  compact?: boolean;
  sealed?: boolean;
  animate?: boolean;
  classification?: string;
}

/** Reusable occult/technical seal — line art built from shared SVG primitives. */
export default function SchematicGlyph({
  family,
  size = 96,
  compact = false,
  sealed = false,
  animate = true,
  classification,
}: SchematicGlyphProps): React.JSX.Element {
  const scan = useRef(new Animated.Value(0)).current;
  const reduceMotion = Platform.OS === 'web'
    && typeof window !== 'undefined'
    && !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

  useEffect(() => {
    if (!animate || reduceMotion || compact) return undefined;
    const loop = Animated.loop(
      Animated.timing(scan, {
        toValue: 1,
        duration: 4200,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => {
      loop.stop();
      scan.setValue(0);
    };
  }, [animate, compact, reduceMotion, scan]);

  const accent = sealed || family === 'sealed' ? UV : STROKE;
  const scanStyle = {
    opacity: scan.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.15, 0.45, 0.15] }),
    transform: [{
      translateY: scan.interpolate({ inputRange: [0, 1], outputRange: [0, size * 0.72] }),
    }],
  };

  return (
    <View style={[styles.root, { width: size, height: size }]}>
      {/* Registration marks */}
      <View style={[styles.mark, styles.markTL]} />
      <View style={[styles.mark, styles.markTR]} />
      <View style={[styles.mark, styles.markBL]} />
      <View style={[styles.mark, styles.markBR]} />

      <Svg width={size} height={size} viewBox="0 0 96 96">
        <Circle cx="48" cy="48" r="44" stroke="rgba(137,170,163,0.12)" strokeWidth="0.8" fill="none" />
        <Line x1="8" y1="48" x2="18" y2="48" stroke="rgba(137,170,163,0.28)" strokeWidth="0.8" />
        <Line x1="78" y1="48" x2="88" y2="48" stroke="rgba(137,170,163,0.28)" strokeWidth="0.8" />
        <Line x1="48" y1="8" x2="48" y2="18" stroke="rgba(137,170,163,0.28)" strokeWidth="0.8" />
        <Line x1="48" y1="78" x2="48" y2="88" stroke="rgba(137,170,163,0.28)" strokeWidth="0.8" />
        <GlyphPaths family={family} accent={accent} />
      </Svg>

      {!compact && !reduceMotion ? (
        <Animated.View pointerEvents="none" style={[styles.scanLine, scanStyle]} />
      ) : null}

      {classification ? (
        <View style={styles.classBadge} pointerEvents="none">
          {/* rendered by parent as TerminalText when needed — keep SVG-only here */}
        </View>
      ) : null}
    </View>
  );
}

/** Compact monochrome mark for feed rows. */
export function SchematicGlyphMark({
  family,
  size = 28,
  sealed = false,
}: {
  family: SchematicGlyphFamily;
  size?: number;
  sealed?: boolean;
}): React.JSX.Element {
  const accent = sealed || family === 'sealed' ? UV : STROKE;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 96 96">
        <GlyphPaths family={family} accent={accent} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  mark: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderColor: 'rgba(137, 170, 163, 0.35)',
  },
  markTL: { top: 2, left: 2, borderTopWidth: 1, borderLeftWidth: 1 },
  markTR: { top: 2, right: 2, borderTopWidth: 1, borderRightWidth: 1 },
  markBL: { bottom: 2, left: 2, borderBottomWidth: 1, borderLeftWidth: 1 },
  markBR: { bottom: 2, right: 2, borderBottomWidth: 1, borderRightWidth: 1 },
  scanLine: {
    position: 'absolute',
    left: '12%',
    right: '12%',
    height: 1,
    backgroundColor: 'rgba(117, 212, 179, 0.35)',
  },
  classBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
});
