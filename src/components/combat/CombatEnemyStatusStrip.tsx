import React from 'react';
import { StyleSheet, Text } from 'react-native';
import {
  formatEnemyStatusLine,
  type EnemyStatusUnitFields,
} from '../../utils/combatTelemetryFormat';

const MONO = 'monospace';
const STATUS_COLOR = '#94a3b8';
const STATUS_ACTIVE_COLOR = '#fbbf24';

interface CombatEnemyStatusStripProps {
  unit: EnemyStatusUnitFields;
  trackWidth?: number;
}

/** Status readout rendered directly beneath the hostile fracture gauge. */
export default function CombatEnemyStatusStrip({
  unit,
  trackWidth,
}: CombatEnemyStatusStripProps): React.JSX.Element {
  const line = formatEnemyStatusLine(unit);
  const isClear = line === 'CLEAR';

  return (
    <Text
      style={[
        styles.line,
        { color: isClear ? STATUS_COLOR : STATUS_ACTIVE_COLOR },
        trackWidth != null ? { width: trackWidth } : null,
      ]}
      numberOfLines={2}
    >
      {`STATUS // ${line}`}
    </Text>
  );
}

const styles = StyleSheet.create({
  line: {
    fontFamily: MONO,
    fontSize: 6,
    letterSpacing: 0.35,
    lineHeight: 8,
  },
});
