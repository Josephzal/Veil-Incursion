import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { RUN_FIELD } from '../../theme/runFieldTokens';

export interface LedgerRow {
  label: string;
  value: string;
}

interface SignalMetadataLedgerProps {
  rows: LedgerRow[];
  sectionLabel?: string;
}

/**
 * Compact metadata ledger — tabular labels/values aligned to field dossier grid.
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
            <Text style={styles.label} numberOfLines={2}>
              {row.label}
            </Text>
            <Text
              style={styles.value}
              numberOfLines={row.label === 'SCANNER STATE' ? 4 : 3}
            >
              {row.value}
            </Text>
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
    marginTop: 4,
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
        gridTemplateColumns: 'minmax(112px, 36%) minmax(0, 1fr)',
        columnGap: 14,
        alignItems: 'start',
      } as object,
      default: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 14,
      },
    }),
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: RUN_FIELD.line,
  },
  label: {
    fontFamily: RUN_FIELD.mono,
    fontSize: RUN_FIELD.type.eyebrow,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: RUN_FIELD.textSecondary,
    paddingTop: 1,
    ...Platform.select({
      web: {
        maxWidth: '100%',
      } as object,
      default: {
        width: '36%',
        flexShrink: 0,
      },
    }),
  },
  value: {
    fontFamily: RUN_FIELD.mono,
    fontSize: RUN_FIELD.type.secondary,
    lineHeight: RUN_FIELD.type.secondary * 1.4,
    fontWeight: '600',
    color: RUN_FIELD.text,
    minWidth: 0,
    flexShrink: 1,
    textTransform: 'uppercase',
    ...Platform.select({
      web: {
        overflowWrap: 'anywhere',
        whiteSpace: 'normal',
      } as object,
      default: {
        flex: 1,
      },
    }),
  },
});
