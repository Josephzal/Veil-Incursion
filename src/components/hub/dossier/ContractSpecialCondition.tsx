import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import TerminalText from '../../TerminalText';
import type { SpecialConditionField } from '../../../utils/contractUi';
import { VEIL } from '../../../theme/veilTerminalTokens';

interface ContractSpecialConditionProps {
  fields: readonly SpecialConditionField[];
  fallbackText?: string | null;
}

/**
 * Conditional contract clause — trigger / restriction / failure.
 * Unconditional perks belong in ContractProvision instead.
 */
export default function ContractSpecialCondition({
  fields,
  fallbackText = null,
}: ContractSpecialConditionProps): React.JSX.Element | null {
  if (fields.length === 0 && !fallbackText) return null;

  return (
    <View style={styles.section}>
      <View style={styles.topRule} />
      <View style={styles.labelRow}>
        <View style={styles.occultMark} />
        <TerminalText size={7} letterSpacing={1.1} style={styles.sectionLabel}>
          SPECIAL CONDITION
        </TerminalText>
      </View>

      {fields.length > 0 ? (
        <View style={styles.fields}>
          {fields.map((field, index) => (
            <View
              key={`${field.label}-${index}`}
              style={[styles.fieldRow, index < fields.length - 1 && styles.fieldDivider]}
            >
              <TerminalText size={7} letterSpacing={0.85} style={styles.fieldLabel}>
                {field.label}
              </TerminalText>
              <TerminalText size={8.5} lineHeight={13} style={styles.fieldValue}>
                {field.value}
              </TerminalText>
            </View>
          ))}
        </View>
      ) : (
        <TerminalText size={8.5} lineHeight={13.5} style={styles.fallback}>
          {fallbackText}
        </TerminalText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    flexGrow: 0,
    flexShrink: 0,
    marginTop: 4,
    marginBottom: 8,
    paddingTop: 4,
  },
  topRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(140, 115, 159, 0.35)',
    marginBottom: 12,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  occultMark: {
    width: 2,
    height: 12,
    backgroundColor: VEIL.occult,
    opacity: 0.75,
  },
  sectionLabel: {
    color: VEIL.occultPale,
    fontWeight: '700',
  },
  fields: {
    minWidth: 0,
  },
  fieldRow: {
    minWidth: 0,
    paddingVertical: 9,
    ...Platform.select({
      web: {
        display: 'grid',
        gridTemplateColumns: 'minmax(120px, 34%) minmax(0, 1fr)',
        columnGap: 14,
        alignItems: 'start',
      } as object,
      default: {
        flexDirection: 'row',
        gap: 12,
      },
    }),
  },
  fieldDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(140, 115, 159, 0.18)',
  },
  fieldLabel: {
    color: 'rgba(179, 162, 192, 0.78)',
    fontWeight: '700',
  },
  fieldValue: {
    color: VEIL.text,
    fontWeight: '600',
    minWidth: 0,
  },
  fallback: {
    color: VEIL.textSoft,
    marginTop: 2,
  },
});
