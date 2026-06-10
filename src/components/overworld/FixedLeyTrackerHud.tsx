import React from 'react';
import { StyleSheet, View } from 'react-native';
import VectorScanner from '../VectorScanner';
import type { RadarDot } from '../../types/run';
import type { ScannerCabal } from '../../types/scanner';
import type { CabalScannerTheme } from '../../types/scanner';

export const LEY_TRACKER_SIZE = 108;

export interface FixedLeyTrackerHudProps {
  cabal: ScannerCabal;
  zoneTint?: Partial<CabalScannerTheme>;
  vectorDots: RadarDot[];
  selectedNodeId?: string | null;
}

/** Permanent lower-left Ley-Tracker — display-only sensor blips. */
export default function FixedLeyTrackerHud({
  cabal,
  zoneTint,
  vectorDots,
  selectedNodeId = null,
}: FixedLeyTrackerHudProps): React.JSX.Element {
  return (
    <View style={styles.host} pointerEvents="none">
      <View style={styles.bezel}>
        <VectorScanner
          cabal={cabal}
          zoneTint={zoneTint}
          scannerSize={LEY_TRACKER_SIZE}
          active
          continuousScan
          activeNodes={vectorDots}
          contactsLocked={false}
          coreScale={0.46}
          selectedNodeId={selectedNodeId}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    zIndex: 16,
  },
  bezel: {
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 51, 0.32)',
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    padding: 2,
  },
});
