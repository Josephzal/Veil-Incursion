import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import HapticPressable from '../HapticPressable';
import { OTT } from '../../constants/occultTacticalTerminalTheme';
import type { NineStrainRuntime } from '../../data/nineStrain/runtime';

type Presentation = ReturnType<NineStrainRuntime['afterimagePresentation']>;

interface AfterimageHudStripProps {
  presentation: Presentation;
  onConfirmDeferred: (traceId: string | null) => void;
}

export default function AfterimageHudStrip({
  presentation,
  onConfirmDeferred,
}: AfterimageHudStripProps): React.JSX.Element | null {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  if (presentation.pendingCount <= 0 && !presentation.deferredAvailable && !presentation.crossfadeArmed && !presentation.reflexReady) {
    return null;
  }
  return (
    <View style={styles.host} accessibilityRole="summary">
      <Text style={styles.line} numberOfLines={1}>
        {`AFTERIMAGE // ${presentation.pendingCount} TRACE${presentation.pendingCount === 1 ? '' : 'S'}`}
      </Text>
      {presentation.crossfadeArmed ? <Text style={styles.sub}>CROSSFADE ARMED</Text> : null}
      {presentation.reflexReady ? <Text style={styles.sub}>REFLEX READY</Text> : null}
      <HapticPressable onPress={() => setOpen((value) => !value)} style={styles.control} accessibilityRole="button">
        <Text style={styles.controlLabel}>{open ? 'HIDE QUEUE' : 'SHOW QUEUE'}</Text>
      </HapticPressable>
      {open ? presentation.queue.map((row, index) => (
        <Text key={`${row.origin}:${row.due}:${index}`} style={styles.sub} numberOfLines={1}>
          {`${row.origin} // T${row.due} // ${row.payload} // ${row.provenance}`}
        </Text>
      )) : null}
      {presentation.deferredAvailable ? (
        <View style={styles.panel}>
          <Text style={styles.sub}>DEFERRED EXPOSURE</Text>
          {presentation.deferredOptions.map((row) => (
            <HapticPressable key={row.traceId} onPress={() => setSelectedId(row.traceId)} style={styles.option}>
              <Text style={styles.optionLabel} numberOfLines={2}>
                {`${row.originLabel} // ${row.basePayload} → ${row.delayedPayload} // due ${row.delayedDue}`}
              </Text>
            </HapticPressable>
          ))}
          <View style={styles.row}>
            <HapticPressable onPress={() => { onConfirmDeferred(null); setSelectedId(null); }} style={styles.control}>
              <Text style={styles.controlLabel}>RESOLVE ALL</Text>
            </HapticPressable>
            <HapticPressable
              onPress={() => {
                if (!selectedId) return;
                onConfirmDeferred(selectedId);
                setSelectedId(null);
              }}
              style={styles.control}
            >
              <Text style={styles.controlLabel}>DELAY</Text>
            </HapticPressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(180, 160, 90, 0.45)',
    backgroundColor: 'rgba(16, 14, 8, 0.92)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 3,
  },
  line: {
    fontFamily: 'monospace',
    color: '#fde68a',
    fontSize: 8,
    letterSpacing: 0.4,
  },
  sub: {
    fontFamily: 'monospace',
    color: OTT.terminalGreenMuted,
    fontSize: 7,
  },
  control: {
    borderWidth: 1,
    borderColor: 'rgba(180, 160, 90, 0.4)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  controlLabel: {
    fontFamily: 'monospace',
    color: '#fde68a',
    fontSize: 7,
  },
  panel: {
    gap: 4,
  },
  option: {
    paddingVertical: 2,
  },
  optionLabel: {
    fontFamily: 'monospace',
    color: '#fef3c7',
    fontSize: 7,
  },
  row: {
    flexDirection: 'row',
    gap: 6,
  },
});
