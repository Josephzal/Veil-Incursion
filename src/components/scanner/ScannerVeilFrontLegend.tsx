import React, { useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import TerminalText from '../TerminalText';
import { formatScannerFieldTelemetry } from '../../data/scannerSignalEngine';
import type { RunGenerationContext } from '../../types/worldState';
import {
  SCANNER_BORDER_QUIET,
  SCANNER_PHOSPHOR,
  SCANNER_TELEMETRY_RAIL_HEIGHT,
  SCANNER_TEXT_PRIMARY,
  SCANNER_TEXT_SECONDARY,
} from './vectorScannerShared';

interface ScannerVeilFrontLegendProps {
  runContext: RunGenerationContext | null | undefined;
  mutedColor: string;
  accentColor: string;
  ledger?: import('../../types/runResourceLedger').RunResourceLedger;
  contract?: import('../../types/contract').ActiveRunContract | null;
}

function parseTelemetry(line: string): { label: string; value: string } {
  const trimmed = line.replace(/^>\s*/, '');
  const idx = trimmed.indexOf(':');
  if (idx === -1) return { label: trimmed, value: '' };
  return {
    label: trimmed.slice(0, idx).trim(),
    value: trimmed.slice(idx + 1).trim(),
  };
}

/**
 * Telemetry rail along the scanner field bottom — information only, not interactive.
 */
export default function ScannerVeilFrontLegend({
  runContext,
  ledger,
  contract,
}: ScannerVeilFrontLegendProps): React.JSX.Element | null {
  const groups = useMemo(() => {
    const lines = formatScannerFieldTelemetry(runContext, { ledger, contract });
    return lines
      .map(parseTelemetry)
      .filter((row) => row.label.length > 0)
      .slice(0, 2);
  }, [contract, ledger, runContext]);

  if (groups.length === 0) return null;

  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      {...(Platform.OS === 'web' ? ({ 'aria-hidden': true } as object) : null)}
      style={styles.rail}
    >
      <View style={styles.strip}>
        {groups.map((group, index) => {
          const isOp = group.label.includes('OPERATION');
          return (
            <React.Fragment key={`${group.label}-${group.value}`}>
              {index > 0 ? <View style={styles.divider} /> : null}
              <View style={styles.cell}>
                <TerminalText size={6.5} letterSpacing={1} style={styles.label} numberOfLines={1}>
                  {group.label}
                </TerminalText>
                <TerminalText
                  size={9}
                  letterSpacing={0.3}
                  style={[styles.value, { color: isOp ? SCANNER_PHOSPHOR : SCANNER_TEXT_PRIMARY }]}
                  numberOfLines={1}
                >
                  {group.value || '—'}
                </TerminalText>
              </View>
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 5,
  },
  strip: {
    height: SCANNER_TELEMETRY_RAIL_HEIGHT,
    paddingVertical: 8,
    paddingHorizontal: 0,
    backgroundColor: 'rgba(7, 13, 14, 0.94)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: SCANNER_BORDER_QUIET,
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'hidden',
    ...Platform.select({
      web: {
        backgroundImage:
          'linear-gradient(180deg, rgba(5, 9, 9, 0.45) 0%, rgba(5, 9, 9, 0.92) 40%)',
      } as object,
      default: {},
    }),
  },
  cell: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    gap: 3,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: SCANNER_BORDER_QUIET,
    marginVertical: 6,
  },
  label: {
    color: SCANNER_TEXT_SECONDARY,
    fontWeight: '700',
  },
  value: {
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});
