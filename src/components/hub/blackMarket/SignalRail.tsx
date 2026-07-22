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
 * Decorative occult-terminal signal rail — half-width mint rule with label/code.
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
      <View style={styles.halfSpan}>
        <View style={styles.bracketTL} />
        <View style={[styles.rule, active && styles.ruleActive]} />
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
        <View style={[styles.ruleFill, active && styles.ruleFillActive]} />
      </View>
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
  /** Always occupy the left half of the Black Market header, Forge or Vendor. */
  halfSpan: {
    width: '50%',
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  bracketTL: {
    width: 7,
    height: 7,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: MUTED,
    marginRight: 8,
    flexShrink: 0,
  },
  rule: {
    width: 28,
    height: 2,
    backgroundColor: MUTED,
    flexShrink: 0,
  },
  ruleActive: {
    backgroundColor: MINT,
  },
  node: {
    width: 5,
    height: 5,
    marginHorizontal: 8,
    backgroundColor: MUTED_SOFT,
    flexShrink: 0,
  },
  nodeActive: {
    backgroundColor: MINT,
  },
  label: {
    color: '#6f8480',
    fontWeight: '700',
    marginRight: 8,
    flexShrink: 0,
  },
  code: {
    color: '#5f746f',
    fontWeight: '700',
    marginRight: 10,
    flexShrink: 0,
  },
  ruleFill: {
    flex: 1,
    minWidth: 24,
    height: 2,
    backgroundColor: MUTED_SOFT,
  },
  ruleFillActive: {
    backgroundColor: MINT,
  },
});
