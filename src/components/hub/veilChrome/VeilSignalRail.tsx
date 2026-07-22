import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import TerminalText from '../../TerminalText';
import StatusNode from './StatusNode';
import { VEIL, type VeilTone } from '../../../theme/veilTerminalTokens';

interface VeilSignalRailProps {
  tone?: VeilTone;
  active?: boolean;
  interrupted?: boolean;
  density?: 'compact' | 'default';
  label?: string;
  code?: string;
  broken?: boolean;
  halfWidth?: boolean;
}

/**
 * Interrupted terminal signal rail for section anchors and channel chrome.
 * Decorative only.
 */
export default function VeilSignalRail({
  tone,
  active = false,
  interrupted = true,
  density = 'default',
  label,
  code,
  broken = false,
  halfWidth = false,
}: VeilSignalRailProps): React.JSX.Element {
  const accent = active ? (tone?.accent ?? VEIL.mint) : VEIL.lineStrong;
  const dim = VEIL.line;

  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      {...(Platform.OS === 'web' ? ({ 'aria-hidden': true } as object) : null)}
      style={[
        styles.rail,
        density === 'compact' && styles.railCompact,
        halfWidth && styles.halfWidth,
      ]}
    >
      <View style={[styles.bracket, { borderColor: dim }]} />
      <View style={[styles.segShort, { backgroundColor: active ? accent : dim }]} />
      <StatusNode
        tone={tone}
        state={active ? 'active' : 'idle'}
        size={density === 'compact' ? 4 : 5}
        glow={false}
      />
      {label ? (
        <TerminalText size={6} letterSpacing={0.85} style={styles.label}>
          {label}
        </TerminalText>
      ) : null}
      {code ? (
        <TerminalText size={6} letterSpacing={0.7} style={[styles.code, active && { color: accent }]}>
          {code}
        </TerminalText>
      ) : null}
      <View style={[styles.segMid, { backgroundColor: dim }]} />
      {interrupted ? <View style={styles.gap} /> : null}
      <View
        style={[
          styles.segActive,
          broken && styles.segActiveBroken,
          { backgroundColor: accent, opacity: active ? 0.9 : 0.35 },
        ]}
      />
      {broken ? (
        <>
          <View style={styles.gapSm} />
          <View style={[styles.segTick, { backgroundColor: dim }]} />
          <View style={styles.gapSm} />
          <View style={[styles.segTick, { backgroundColor: accent, opacity: 0.45 }]} />
        </>
      ) : (
        <View style={[styles.segTail, { backgroundColor: dim }]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 16,
    gap: 5,
    overflow: 'hidden',
  },
  railCompact: {
    minHeight: 12,
    gap: 4,
  },
  halfWidth: {
    width: '50%',
    maxWidth: '50%',
  },
  bracket: {
    width: 6,
    height: 6,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    flexShrink: 0,
  },
  segShort: {
    width: 22,
    height: 2,
    flexShrink: 0,
  },
  label: {
    color: VEIL.textDim,
    fontWeight: '700',
    flexShrink: 0,
  },
  code: {
    color: VEIL.textDim,
    fontWeight: '700',
    flexShrink: 0,
  },
  segMid: {
    flexGrow: 1,
    flexBasis: 36,
    maxWidth: 96,
    height: StyleSheet.hairlineWidth,
  },
  gap: {
    width: 7,
  },
  gapSm: {
    width: 4,
  },
  segActive: {
    width: 42,
    height: 2,
    flexShrink: 0,
  },
  segActiveBroken: {
    width: 18,
  },
  segTick: {
    width: 10,
    height: 2,
    flexShrink: 0,
  },
  segTail: {
    flexGrow: 1,
    flexBasis: 24,
    minWidth: 16,
    height: StyleSheet.hairlineWidth,
  },
});
