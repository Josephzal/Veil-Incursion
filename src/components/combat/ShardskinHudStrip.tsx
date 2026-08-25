import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { OTT } from '../../constants/occultTacticalTerminalTheme';
import type { NineStrainRuntime } from '../../data/nineStrain/runtime';

type Presentation = ReturnType<NineStrainRuntime['shardskinPresentation']>;

interface ShardskinHudStripProps {
  presentation: Presentation;
}

export default function ShardskinHudStrip({
  presentation,
}: ShardskinHudStripProps): React.JSX.Element | null {
  if (!presentation.active && !presentation.lastLog) return null;
  return (
    <View style={styles.host} accessibilityRole="summary">
      <Text style={styles.line} numberOfLines={1}>
        {`SHARDS ${presentation.currentShards}/${presentation.shardCap} · EDGE ${presentation.currentEdge}/${presentation.edgeCap}`}
      </Text>
      {presentation.pendingTemperedRemnantReturn > 0 ? (
        <Text style={styles.sub} numberOfLines={1}>
          {`TEMPERED REMNANT // +${presentation.pendingTemperedRemnantReturn} EDGE NEXT TURN`}
        </Text>
      ) : null}
      {presentation.cathedralBreakSelected ? (
        <Text style={styles.sub} numberOfLines={1}>
          CATHEDRAL BREAK // ARMED
        </Text>
      ) : null}
      {presentation.lastLog ? <Text style={styles.sub}>{presentation.lastLog}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.5)',
    backgroundColor: 'rgba(6, 14, 20, 0.92)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 3,
    marginBottom: 6,
  },
  line: {
    fontFamily: 'monospace',
    color: '#7dd3fc',
    fontSize: 8,
    letterSpacing: 0.4,
  },
  sub: {
    fontFamily: 'monospace',
    color: OTT.terminalGreenMuted,
    fontSize: 7,
  },
});
