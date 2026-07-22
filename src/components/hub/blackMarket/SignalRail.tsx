import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import TerminalText from '../../TerminalText';

interface SignalRailProps {
  label?: string;
  code?: string;
  active?: boolean;
  compact?: boolean;
}

/**
 * Decorative occult-terminal signal rail — short segments, nodes, brackets.
 * Purely presentational; never participates in hit-testing or focus.
 */
export default function SignalRail({
  label,
  code,
  active = false,
  compact = false,
}: SignalRailProps): React.JSX.Element {
  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      {...(Platform.OS === 'web' ? ({ 'aria-hidden': true } as object) : null)}
      style={[styles.rail, compact && styles.railCompact]}
    >
      <View style={styles.bracketTL} />
      <View style={[styles.shortRule, active && styles.shortRuleActive]} />
      <View style={[styles.node, active && styles.nodeActive]} />
      {label ? (
        <TerminalText size={6} letterSpacing={0.9} style={styles.label}>
          {label}
        </TerminalText>
      ) : null}
      {code ? (
        <TerminalText size={6} letterSpacing={0.7} style={styles.code}>
          {code}
        </TerminalText>
      ) : null}
      <View style={styles.gap} />
      <View style={styles.segA} />
      <View style={styles.gapSm} />
      <View style={styles.segB} />
      <View style={styles.gapSm} />
      <View style={[styles.segActive, !active && styles.segActiveDim]} />
      <View style={styles.gap} />
      <View style={styles.step} />
      <View style={styles.regMark} />
      <View style={styles.bracketBR} />
    </View>
  );
}

const MUTED = 'rgba(127, 166, 157, 0.19)';
const MUTED_SOFT = 'rgba(127, 166, 157, 0.12)';
const MINT = 'rgba(105, 200, 173, 0.45)';

const styles = StyleSheet.create({
  rail: {
    position: 'relative',
    height: 18,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    overflow: 'hidden',
    flexShrink: 0,
  },
  railCompact: {
    height: 14,
    paddingHorizontal: 14,
  },
  bracketTL: {
    width: 7,
    height: 7,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: MUTED,
    marginRight: 8,
  },
  shortRule: {
    width: 72,
    maxWidth: '12%',
    height: StyleSheet.hairlineWidth,
    backgroundColor: MUTED,
  },
  shortRuleActive: {
    backgroundColor: 'rgba(105, 200, 173, 0.35)',
  },
  node: {
    width: 5,
    height: 5,
    marginHorizontal: 8,
    backgroundColor: MUTED_SOFT,
  },
  nodeActive: {
    backgroundColor: MINT,
  },
  label: {
    color: '#6f8480',
    fontWeight: '700',
    marginRight: 8,
  },
  code: {
    color: '#5f746f',
    fontWeight: '700',
    marginRight: 10,
  },
  gap: {
    width: 10,
  },
  gapSm: {
    width: 6,
  },
  segA: {
    flexGrow: 1,
    flexBasis: 40,
    maxWidth: 120,
    height: StyleSheet.hairlineWidth,
    backgroundColor: MUTED_SOFT,
  },
  segB: {
    flexGrow: 2,
    flexBasis: 80,
    maxWidth: 220,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(127, 166, 157, 0.1)',
  },
  segActive: {
    width: 48,
    height: 2,
    backgroundColor: MINT,
  },
  segActiveDim: {
    backgroundColor: MUTED_SOFT,
    height: StyleSheet.hairlineWidth,
  },
  step: {
    width: 10,
    height: 10,
    marginLeft: 6,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: MUTED_SOFT,
    transform: [{ rotate: '45deg' }],
  },
  regMark: {
    width: 8,
    height: 8,
    marginLeft: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(127, 166, 157, 0.16)',
    ...Platform.select({
      web: {
        backgroundImage:
          'linear-gradient(rgba(127,166,157,0.25), rgba(127,166,157,0.25)), linear-gradient(rgba(127,166,157,0.25), rgba(127,166,157,0.25))',
        backgroundSize: '100% 1px, 1px 100%',
        backgroundPosition: 'center, center',
        backgroundRepeat: 'no-repeat',
      } as object,
      default: {},
    }),
  },
  bracketBR: {
    marginLeft: 'auto',
    width: 7,
    height: 7,
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderColor: MUTED,
  },
});
