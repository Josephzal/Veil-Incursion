import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import TerminalText from '../../TerminalText';
import { VEIL } from '../../../theme/veilTerminalTokens';

export interface DossierLedgerRowData {
  label: string;
  value: string;
}

interface DossierLedgerRowProps {
  label: string;
  value: string;
  last?: boolean;
}

/** Single label/value ledger row with faint divider. */
export function DossierLedgerRow({
  label,
  value,
  last = false,
}: DossierLedgerRowProps): React.JSX.Element {
  return (
    <View style={[styles.row, !last && styles.rowDivider]}>
      <TerminalText size={7} letterSpacing={0.85} style={styles.label}>
        {label}
      </TerminalText>
      <TerminalText size={8.5} lineHeight={13} style={styles.value}>
        {value}
      </TerminalText>
    </View>
  );
}

interface DossierLedgerProps {
  rows: readonly DossierLedgerRowData[];
}

/** Two-column operational parameters ledger. */
export default function DossierLedger({ rows }: DossierLedgerProps): React.JSX.Element | null {
  if (rows.length === 0) return null;

  return (
    <View style={styles.section}>
      <TerminalText size={7} letterSpacing={1.05} style={styles.sectionLabel}>
        OPERATIONAL PARAMETERS
      </TerminalText>
      <View style={styles.ledger}>
        {rows.map((row, index) => (
          <DossierLedgerRow
            key={`${row.label}-${index}`}
            label={row.label}
            value={row.value}
            last={index === rows.length - 1}
          />
        ))}
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
  ledger: {
    minWidth: 0,
  },
  row: {
    minWidth: 0,
    paddingVertical: 10,
    ...Platform.select({
      web: {
        display: 'grid',
        gridTemplateColumns: 'minmax(120px, 34%) minmax(0, 1fr)',
        columnGap: 14,
        alignItems: 'start',
      } as object,
      default: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
      },
    }),
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: VEIL.lineFaint,
  },
  label: {
    color: '#9CA7A0',
    fontWeight: '700',
    paddingTop: 1,
  },
  value: {
    color: VEIL.text,
    fontWeight: '600',
    minWidth: 0,
    fontVariant: ['tabular-nums'],
  },
});
