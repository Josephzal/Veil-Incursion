import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import HapticPressable from '../HapticPressable';
import { OTT } from '../../constants/occultTacticalTerminalTheme';
import type { ChosenFatePreview } from '../../types/counterfate';
import type { NineStrainRuntime } from '../../data/nineStrain/runtime';

type Presentation = ReturnType<NineStrainRuntime['presentation']>;

interface CounterfateHudStripProps {
  presentation: Presentation;
  onConfirmChosenFate: (instanceId: string) => ChosenFatePreview;
  onPreviewChosenFate: (instanceId: string) => ChosenFatePreview;
}

export default function CounterfateHudStrip({
  presentation,
  onConfirmChosenFate,
  onPreviewChosenFate,
}: CounterfateHudStripProps): React.JSX.Element | null {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  if (presentation.fateboundInstanceId == null && presentation.reversal <= 0 && !presentation.chosenFateAvailable) {
    return null;
  }
  const preview = selectedId ? onPreviewChosenFate(selectedId) : null;
  return (
    <View style={styles.host} accessibilityRole="summary">
      <Text style={styles.line} numberOfLines={1}>
        {presentation.concealed
          ? `FATEBOUND // obscured future // RV ${presentation.reversal}/${presentation.cap}`
          : `FATEBOUND // ${presentation.boundLabel ?? 'none'} // RV ${presentation.reversal}/${presentation.cap}`}
      </Text>
      {presentation.lastRelease ? (
        <Text style={styles.sub} numberOfLines={1}>
          {`RELEASE // ${Math.round(presentation.lastRelease.multiplier * 100)}% // ${presentation.lastRelease.packet}`}
        </Text>
      ) : null}
      {presentation.chosenFateAvailable ? (
        <HapticPressable
          onPress={() => setOpen((value) => !value)}
          style={styles.control}
          accessibilityRole="button"
          accessibilityLabel="Chosen Fate"
        >
          <Text style={styles.controlLabel}>CHOSEN FATE</Text>
        </HapticPressable>
      ) : null}
      {open && presentation.chosenFateAvailable ? (
        <View style={styles.panel}>
          <Text style={styles.sub}>{`CURRENT RV ${presentation.reversal}`}</Text>
          {presentation.alternatives.map((row) => (
            <HapticPressable
              key={row.intentInstanceId}
              onPress={() => setSelectedId(row.intentInstanceId)}
              style={styles.option}
            >
              <Text style={styles.optionLabel} numberOfLines={1}>
                {row.designation ?? row.unitId}
              </Text>
            </HapticPressable>
          ))}
          {preview?.eligible ? (
            <Text style={styles.sub}>
              {`TRANSFER ${preview.cappedTransferred} // LOSE ${preview.lost}`}
            </Text>
          ) : null}
          <View style={styles.row}>
            <HapticPressable onPress={() => { setOpen(false); setSelectedId(null); }} style={styles.control}>
              <Text style={styles.controlLabel}>CANCEL</Text>
            </HapticPressable>
            <HapticPressable
              onPress={() => {
                if (!selectedId) return;
                const result = onConfirmChosenFate(selectedId);
                if (result.eligible) {
                  setOpen(false);
                  setSelectedId(null);
                }
              }}
              style={styles.control}
            >
              <Text style={styles.controlLabel}>CONFIRM</Text>
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
    borderColor: 'rgba(180, 140, 255, 0.45)',
    backgroundColor: 'rgba(12, 10, 18, 0.92)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 4,
  },
  line: {
    fontFamily: 'monospace',
    color: '#c4b5fd',
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
    borderColor: 'rgba(180, 140, 255, 0.55)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  controlLabel: {
    fontFamily: 'monospace',
    color: '#e9d5ff',
    fontSize: 7,
    letterSpacing: 0.6,
  },
  panel: {
    gap: 4,
  },
  option: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  optionLabel: {
    fontFamily: 'monospace',
    color: '#f5f3ff',
    fontSize: 7,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
});
