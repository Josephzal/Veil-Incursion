import React from 'react';
import { StyleSheet, View } from 'react-native';
import VectorScanner from '../VectorScanner';
import type { RadarDot } from '../../types/run';
import type { ScannerCabal } from '../../types/scanner';
import type { CabalScannerTheme } from '../../types/scanner';
import DiscoveredNodesRegistry, { type RegistryEntry } from './DiscoveredNodesRegistry';

export const LEY_TRACKER_SIZE = 108;

export interface FixedLeyTrackerHudProps {
  cabal: ScannerCabal;
  zoneTint?: Partial<CabalScannerTheme>;
  vectorDots: RadarDot[];
  proximityGhost?: { x: number; y: number } | null;
  selectedNodeId?: string | null;
  registryEntries?: RegistryEntry[];
  onRegistrySelect?: (nodeId: string) => void;
  accentColor?: string;
}

/** Lower-left Ley-Tracker — registry floats upward; scanner position is fixed. */
export default function FixedLeyTrackerHud({
  cabal,
  zoneTint,
  vectorDots,
  proximityGhost = null,
  selectedNodeId = null,
  registryEntries = [],
  onRegistrySelect,
  accentColor = '#00ff33',
}: FixedLeyTrackerHudProps): React.JSX.Element {
  return (
    <View style={styles.host} pointerEvents="box-none">
      <View style={styles.scannerAnchor}>
        {registryEntries.length > 0 && onRegistrySelect ? (
          <View style={styles.registryFloat} pointerEvents="box-none">
            <DiscoveredNodesRegistry
              entries={registryEntries}
              selectedNodeId={selectedNodeId}
              accent={accentColor}
              onSelectNode={onRegistrySelect}
            />
          </View>
        ) : null}
        <View style={styles.bezel} pointerEvents="none">
          <VectorScanner
            cabal={cabal}
            zoneTint={zoneTint}
            scannerSize={LEY_TRACKER_SIZE}
            active
            continuousScan
            activeNodes={vectorDots}
            proximityGhost={proximityGhost}
            contactsLocked={false}
            coreScale={0.46}
            selectedNodeId={selectedNodeId}
          />
        </View>
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
  scannerAnchor: {
    position: 'relative',
  },
  registryFloat: {
    position: 'absolute',
    left: 0,
    bottom: '100%',
    marginBottom: 4,
    zIndex: 2,
  },
  bezel: {
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 51, 0.32)',
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    padding: 2,
  },
});
