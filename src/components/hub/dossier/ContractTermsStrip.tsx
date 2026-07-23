import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import TerminalText from '../../TerminalText';
import { VEIL } from '../../../theme/veilTerminalTokens';

export interface ContractTermsStripProps {
  riskLabel: string;
  riskColor: string;
  paymentLabel: string;
  reputationLabel: string;
  reputationColor: string;
  paymentHeading?: string;
  reputationHeading?: string;
}

/** Compact horizontal Risk / Payment / Reputation terms strip. */
export default function ContractTermsStrip({
  riskLabel,
  riskColor,
  paymentLabel,
  reputationLabel,
  reputationColor,
  paymentHeading = 'PAYMENT',
  reputationHeading = 'REPUTATION',
}: ContractTermsStripProps): React.JSX.Element {
  return (
    <View style={styles.section}>
      <TerminalText size={7} letterSpacing={1.05} style={styles.sectionLabel}>
        CONTRACT TERMS
      </TerminalText>
      <View style={styles.strip}>
        <View style={styles.cell}>
          <TerminalText size={6.5} letterSpacing={0.9} style={styles.label}>
            RISK
          </TerminalText>
          <TerminalText size={11} letterSpacing={0.4} style={[styles.value, { color: riskColor }]}>
            {riskLabel}
          </TerminalText>
        </View>
        <View style={styles.divider} />
        <View style={styles.cell}>
          <TerminalText size={6.5} letterSpacing={0.9} style={styles.label}>
            {paymentHeading}
          </TerminalText>
          <TerminalText size={11} letterSpacing={0.2} style={[styles.value, styles.payment]}>
            {paymentLabel}
          </TerminalText>
        </View>
        <View style={styles.divider} />
        <View style={[styles.cell, styles.cellWide]}>
          <TerminalText size={6.5} letterSpacing={0.9} style={styles.label}>
            {reputationHeading}
          </TerminalText>
          <TerminalText
            size={10}
            letterSpacing={0.25}
            style={[styles.value, { color: reputationColor }]}
            numberOfLines={2}
          >
            {reputationLabel}
          </TerminalText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    flexGrow: 0,
    flexShrink: 0,
    marginBottom: 18,
  },
  sectionLabel: {
    color: 'rgba(198, 194, 180, 0.92)',
    fontWeight: '700',
    marginBottom: 8,
  },
  strip: {
    minHeight: 76,
    maxHeight: 88,
    paddingVertical: 14,
    paddingHorizontal: 14,
    // Match unselected Contract Board card surface (cooler than VEIL.surface2).
    backgroundColor: 'rgba(8, 13, 13, 0.78)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopColor: VEIL.line,
    borderBottomColor: VEIL.line,
    ...Platform.select({
      web: {
        display: 'grid',
        gridTemplateColumns: 'minmax(90px, 0.8fr) 1px minmax(110px, 1fr) 1px minmax(140px, 1.25fr)',
        alignItems: 'center',
        columnGap: 0,
      } as object,
      default: {
        flexDirection: 'row',
        alignItems: 'center',
      },
    }),
  },
  cell: {
    minWidth: 0,
    paddingHorizontal: 10,
    justifyContent: 'center',
    ...Platform.select({
      default: { flex: 1 },
      web: {},
    }),
  },
  cellWide: {
    ...Platform.select({
      default: { flex: 1.25 },
      web: {},
    }),
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: VEIL.line,
    opacity: 0.85,
  },
  label: {
    color: '#9CA7A0',
    fontWeight: '700',
    marginBottom: 6,
  },
  value: {
    color: VEIL.text,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  payment: {
    color: VEIL.bone,
  },
});
