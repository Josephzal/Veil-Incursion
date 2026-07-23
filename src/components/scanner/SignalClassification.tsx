import React from 'react';
import { StyleSheet, View } from 'react-native';
import TerminalText from '../TerminalText';
import { VEIL } from '../../theme/veilTerminalTokens';
import { HOSTILE_PATROL_COLOR, SCANNER_TEXT_SECONDARY } from './vectorScannerShared';

interface SignalClassificationProps {
  value: string;
}

function isCombatClass(value: string): boolean {
  const upper = value.toUpperCase();
  return upper.includes('COMBAT') || upper.includes('ELITE') || upper.includes('BOSS');
}

/**
 * Primary decoded result — coral registration for combat, no filled panel.
 */
export default function SignalClassification({
  value,
}: SignalClassificationProps): React.JSX.Element {
  const combat = isCombatClass(value);
  const valueColor = combat ? HOSTILE_PATROL_COLOR : VEIL.occultPale;

  return (
    <View style={styles.block}>
      <TerminalText size={7.5} letterSpacing={1.05} style={styles.label}>
        NODE CLASSIFICATION
      </TerminalText>
      <View style={styles.valueRow}>
        <View style={[styles.mark, { backgroundColor: combat ? HOSTILE_PATROL_COLOR : VEIL.occult }]} />
        <TerminalText
          size={13}
          letterSpacing={0.4}
          style={[styles.value, { color: valueColor }]}
          numberOfLines={2}
          accessibilityLabel={`Node classification ${value}`}
        >
          {value.toUpperCase()}
        </TerminalText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    width: '100%',
    gap: 8,
    flexShrink: 0,
    marginTop: 4,
    marginBottom: 12,
  },
  label: {
    color: SCANNER_TEXT_SECONDARY,
    fontWeight: '700',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  mark: {
    width: 2,
    alignSelf: 'stretch',
    minHeight: 20,
    marginTop: 3,
  },
  value: {
    flex: 1,
    minWidth: 0,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
});
