import React from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import {
  DESKTOP_SCANNER_DOSSIER_MAX,
  DESKTOP_SCANNER_DOSSIER_MIN,
} from '../../constants/responsiveScale';
import { useLandscapeMetrics } from '../../hooks/useLandscapeMetrics';
import {
  SCANNER_BORDER_QUIET,
  SCANNER_DOSSIER_SURFACE,
  SCANNER_INSTRUMENT_SURFACE,
} from './vectorScannerShared';

interface ScanInstrumentProps {
  scanner: React.ReactNode;
  dossier: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * One continuous field-scanner instrument shell.
 * Scanner field + signal dossier share outer boundary; no nested card borders.
 */
export default function ScanInstrument({
  scanner,
  dossier,
  style,
}: ScanInstrumentProps): React.JSX.Element {
  const { useHorizontalSplit } = useLandscapeMetrics();

  if (!useHorizontalSplit) {
    return (
      <View style={[styles.shell, styles.shellStacked, style]}>
        <View style={styles.scannerStacked}>{scanner}</View>
        <View style={styles.stackRule} />
        <View style={styles.dossierStacked}>{dossier}</View>
      </View>
    );
  }

  return (
    <View style={[styles.shell, styles.shellHorizontal, style]}>
      <View style={styles.scannerField}>{scanner}</View>
      <View style={styles.divider} />
      <View style={styles.dossierBlade}>{dossier}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    minHeight: 0,
    borderWidth: 1,
    borderColor: SCANNER_BORDER_QUIET,
    backgroundColor: SCANNER_INSTRUMENT_SURFACE,
    overflow: 'hidden',
  },
  shellHorizontal: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  shellStacked: {
    flexDirection: 'column',
  },
  scannerField: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    position: 'relative',
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: SCANNER_BORDER_QUIET,
  },
  dossierBlade: {
    flexShrink: 0,
    minHeight: 0,
    backgroundColor: SCANNER_DOSSIER_SURFACE,
    ...Platform.select({
      web: {
        width: `clamp(${DESKTOP_SCANNER_DOSSIER_MIN}px, 22vw, ${DESKTOP_SCANNER_DOSSIER_MAX}px)`,
        maxWidth: DESKTOP_SCANNER_DOSSIER_MAX,
        backgroundImage: `linear-gradient(180deg, #0A100F 0%, ${SCANNER_DOSSIER_SURFACE} 48%, #050908 100%)`,
      } as object,
      default: {
        width: 400,
        maxWidth: '42%',
      },
    }),
  },
  scannerStacked: {
    flex: 1,
    minHeight: 0,
  },
  stackRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: SCANNER_BORDER_QUIET,
  },
  dossierStacked: {
    flexShrink: 0,
    minHeight: 160,
    maxHeight: '38%',
    backgroundColor: SCANNER_DOSSIER_SURFACE,
  },
});
