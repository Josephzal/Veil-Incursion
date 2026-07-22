import React from 'react';
import { StyleSheet, View } from 'react-native';
import TerminalText from '../../TerminalText';
import { VEIL } from '../../../theme/veilTerminalTokens';

interface ContractProvisionProps {
  benefits: readonly string[];
}

/**
 * Unconditional active-contract benefits (employer package perks).
 * Not a special/conditional clause.
 */
export default function ContractProvision({
  benefits,
}: ContractProvisionProps): React.JSX.Element | null {
  if (benefits.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.labelRow}>
        <View style={styles.mark} />
        <TerminalText size={7} letterSpacing={1.05} style={styles.sectionLabel}>
          RUN PROVISION
        </TerminalText>
      </View>
      <TerminalText size={8.5} lineHeight={13} style={styles.value}>
        {benefits.join(' · ')}
      </TerminalText>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    flexGrow: 0,
    flexShrink: 0,
    marginTop: 2,
    marginBottom: 12,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  mark: {
    width: 2,
    height: 12,
    backgroundColor: VEIL.bone,
    opacity: 0.55,
  },
  sectionLabel: {
    color: 'rgba(185, 181, 167, 0.78)',
    fontWeight: '700',
  },
  value: {
    color: VEIL.text,
    fontWeight: '600',
  },
});
