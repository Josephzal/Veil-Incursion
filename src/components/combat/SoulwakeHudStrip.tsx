import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import HapticPressable from '../HapticPressable';
import { OTT } from '../../constants/occultTacticalTerminalTheme';
import type { NineStrainRuntime } from '../../data/nineStrain/runtime';

type Presentation = ReturnType<NineStrainRuntime['soulwakePresentation']>;

interface SoulwakeHudStripProps {
  presentation: Presentation;
  overdrawPreview?: {
    requestedHp: number;
    actualHp: number;
    overflowLost: number;
    hpAfter: number;
  } | null;
  onOverdraw?: () => void;
}

export default function SoulwakeHudStrip({
  presentation,
  overdrawPreview = null,
  onOverdraw,
}: SoulwakeHudStripProps): React.JSX.Element | null {
  const [confirming, setConfirming] = useState(false);
  if (!presentation.active && !presentation.lastLog && !presentation.overdrawAvailable) return null;
  const expiry = presentation.wake > 0
    ? ` · HOLD THRU HOSTILE ${presentation.expireAtEnemyCycleIndex}`
    : '';
  return (
    <View style={styles.host} accessibilityRole="summary">
      <Text style={styles.line} numberOfLines={1}>
        {`SOULWAKE // ${presentation.kindLabel} ${presentation.wake}/${presentation.cap}${presentation.recorded > 0 ? ` · NEXT ${presentation.recorded}` : ''}${expiry}`}
      </Text>
      {presentation.lastLog ? <Text style={styles.sub}>{presentation.lastLog}</Text> : null}
      {onOverdraw && presentation.overdrawAvailable ? (
        confirming ? (
          <View style={styles.row}>
            <Text style={styles.sub}>
              {overdrawPreview
                ? `PAY ${overdrawPreview.actualHp} HP (ASK ${overdrawPreview.requestedHp})${overdrawPreview.overflowLost > 0 ? ` · CAP LOSES ${overdrawPreview.overflowLost}` : ''}`
                : 'CONFIRM HP COST'}
            </Text>
            <HapticPressable
              onPress={() => {
                onOverdraw();
                setConfirming(false);
              }}
              accessibilityLabel="Confirm Overdraw"
              style={styles.overdraw}
            >
              <Text style={styles.overdrawLabel}>CONFIRM</Text>
            </HapticPressable>
            <HapticPressable
              onPress={() => setConfirming(false)}
              accessibilityLabel="Cancel Overdraw"
              style={styles.overdraw}
            >
              <Text style={styles.overdrawLabel}>CANCEL</Text>
            </HapticPressable>
          </View>
        ) : (
          <HapticPressable
            onPress={() => setConfirming(true)}
            accessibilityLabel="Overdraw — pay a nonlethal HP cost for Wake"
            style={styles.overdraw}
          >
            <Text style={styles.overdrawLabel}>OVERDRAW</Text>
          </HapticPressable>
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(190, 80, 90, 0.5)',
    backgroundColor: 'rgba(18, 8, 10, 0.92)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 3,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  line: {
    fontFamily: 'monospace',
    color: '#fda4af',
    fontSize: 8,
    letterSpacing: 0.4,
  },
  sub: {
    fontFamily: 'monospace',
    color: OTT.terminalGreenMuted,
    fontSize: 7,
  },
  overdraw: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(251, 113, 133, 0.55)',
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  overdrawLabel: {
    fontFamily: 'monospace',
    color: '#fecdd3',
    fontSize: 8,
    letterSpacing: 0.6,
  },
});
