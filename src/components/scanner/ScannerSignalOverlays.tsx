import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { RadarDot } from '../../types/run';
import type { RadarVeilSignal } from '../../types/scannerSignals';
import {
  scannerOverlayOpacity,
  shouldShowScannerSignalOverlay,
} from '../../data/scannerSignalEngine';

interface ScannerSignalOverlaysProps {
  radarDots: readonly RadarDot[];
  siphonedNodeIds: readonly string[];
  selectedNodeId: string | null;
  fullyInterpretedNodeIds?: readonly string[];
}

function SignalChip({
  signal,
  opacity,
}: {
  signal: RadarVeilSignal;
  opacity: number;
}): React.JSX.Element {
  return (
    <View
      style={[
        styles.chip,
        {
          borderColor: `${signal.color}${opacity > 0.7 ? 'cc' : '88'}`,
          backgroundColor: `${signal.color}18`,
          opacity,
        },
      ]}
    >
      <View style={[styles.chipDot, { backgroundColor: signal.color }]} />
      <Text style={[styles.chipText, { color: signal.color }]} numberOfLines={1}>
        {signal.label}
      </Text>
    </View>
  );
}

/** Per-node Veil Front signal chips positioned over locked scanner contacts. */
export default function ScannerSignalOverlays({
  radarDots,
  siphonedNodeIds,
  selectedNodeId,
  fullyInterpretedNodeIds = [],
}: ScannerSignalOverlaysProps): React.JSX.Element {
  const visibleOverlays = useMemo(
    () => radarDots.flatMap((dot) => {
      const signals = dot.veilSignals ?? [];
      if (signals.length === 0) return [];

      const show = shouldShowScannerSignalOverlay(dot.id, {
        siphonedNodeIds,
        selectedNodeId,
        isPreDiscovered: dot.isPreDiscovered,
        hasSignals: true,
        fullyInterpretedNodeIds,
      });
      if (!show) return [];

      const opacity = scannerOverlayOpacity(dot.id, {
        siphonedNodeIds,
        selectedNodeId,
        isPreDiscovered: dot.isPreDiscovered,
        fullyInterpretedNodeIds,
      });

      return [{
        dot,
        signals,
        opacity,
      }];
    }),
    [radarDots, selectedNodeId, siphonedNodeIds, fullyInterpretedNodeIds],
  );

  if (visibleOverlays.length === 0) return <></>;

  return (
    <>
      {visibleOverlays.map(({ dot, signals, opacity }) => (
        <View
          key={`signal-${dot.id}`}
          pointerEvents="none"
          style={[
            styles.host,
            {
              left: dot.x - 40,
              top: dot.y - 52,
              opacity,
            },
          ]}
        >
          <Text style={styles.header}>VEIL SIGNAL</Text>
          <View style={styles.row}>
            {signals.map((signal) => (
              <SignalChip key={`${dot.id}-${signal.kind}`} signal={signal} opacity={1} />
            ))}
          </View>
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    width: 80,
    alignItems: 'center',
    zIndex: 7,
  },
  header: {
    fontFamily: 'monospace',
    fontSize: 5,
    letterSpacing: 0.8,
    color: 'rgba(226, 232, 240, 0.55)',
    marginBottom: 3,
  },
  row: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    width: '100%',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 2,
    paddingHorizontal: 4,
    paddingVertical: 2,
    maxWidth: 78,
    gap: 3,
  },
  chipDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  chipText: {
    fontFamily: 'monospace',
    fontSize: 5,
    fontWeight: '700',
    letterSpacing: 0.3,
    flexShrink: 1,
  },
});
