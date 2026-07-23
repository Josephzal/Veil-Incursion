import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import TerminalText from '../TerminalText';
import { VEIL } from '../../theme/veilTerminalTokens';
import { SCANNER_TEXT_PRIMARY, SCANNER_TEXT_SECONDARY } from './vectorScannerShared';

export interface LedgerRow {
  label: string;
  value: string;
}

interface SignalMetadataLedgerProps {
  rows: LedgerRow[];
  sectionLabel?: string;
}

/**
 * Compact metadata ledger — tabular labels/values, subtle row rules only.
 */
export default function SignalMetadataLedger({
  rows,
}: SignalMetadataLedgerProps): React.JSX.Element | null {
  if (rows.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.ledger}>
        {rows.map((row, index) => (
          <View
            key={`${row.label}-${row.value}`}
            style={[styles.row, index < rows.length - 1 && styles.rowDivider]}
          >
            <TerminalText size={7.5} letterSpacing={0.9} style={styles.label} numberOfLines={2}>
              {row.label}
            </TerminalText>
            <TerminalText
              size={9}
              lineHeight={14}
              style={styles.value}
              numberOfLines={row.label === 'SCANNER STATE' ? 4 : 3}
            >
              {row.value}
            </TerminalText>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    width: '100%',
    flexShrink: 0,
    marginTop: 2,
    marginBottom: 8,
  },
  ledger: {
    minWidth: 0,
  },
  row: {
    minWidth: 0,
    paddingVertical: 11,
    ...Platform.select({
      web: {
        display: 'grid',
        gridTemplateColumns: 'minmax(108px, 34%) minmax(0, 1fr)',
        columnGap: 12,
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
    color: SCANNER_TEXT_SECONDARY,
    fontWeight: '700',
    paddingTop: 1,
  },
  value: {
    color: SCANNER_TEXT_PRIMARY,
    fontWeight: '600',
    minWidth: 0,
    flexShrink: 1,
    textTransform: 'uppercase',
    ...Platform.select({
      web: {
        overflowWrap: 'anywhere',
        whiteSpace: 'normal',
      } as object,
      default: {},
    }),
  },
});
