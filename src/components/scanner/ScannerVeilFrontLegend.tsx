import React from 'react';
import { StyleSheet, View } from 'react-native';
import TerminalText from '../TerminalText';
import { formatScannerFieldTelemetry } from '../../data/scannerSignalEngine';
import type { RunGenerationContext } from '../../types/worldState';

interface ScannerVeilFrontLegendProps {
  runContext: RunGenerationContext | null | undefined;
  mutedColor: string;
  accentColor: string;
  ledger?: import('../../types/runResourceLedger').RunResourceLedger;
  contract?: import('../../types/contract').ActiveRunContract | null;
}

/** Sector-level Veil Front telemetry strip on the scanner bezel. */
export default function ScannerVeilFrontLegend({
  runContext,
  mutedColor,
  accentColor,
  ledger,
  contract,
}: ScannerVeilFrontLegendProps): React.JSX.Element | null {
  const lines = formatScannerFieldTelemetry(runContext, { ledger, contract });
  if (lines.length === 0) return null;

  return (
    <View pointerEvents="none" style={styles.host}>
      {lines.map((line) => (
        <TerminalText
          key={line}
          variant="micro"
          letterSpacing={0.5}
          style={{ color: line.includes('OPERATION') ? accentColor : mutedColor }}
          numberOfLines={1}
        >
          {line.replace('> ', '')}
        </TerminalText>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    zIndex: 5,
    gap: 2,
    maxWidth: '72%',
  },
});
