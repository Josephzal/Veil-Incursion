import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import StaticIntelCard from '../../../components/combat/readout/StaticIntelCard';
import { DOSSIER_ROW_BG } from '../../../constants/dossierSurface';
import type { CombatGridUnitSnapshot } from '../../../utils/combatTelemetryFormat';

interface HostileIntelViewProps {
  enemy: CombatGridUnitSnapshot | null;
  mutedColor: string;
}

/** Dashboard column 3 — selected hostile intel stat block (no turn order). */
export default function HostileIntelView({
  enemy,
  mutedColor,
}: HostileIntelViewProps): React.JSX.Element {
  if (enemy) {
    return (
      <View style={styles.host}>
        <StaticIntelCard unit={enemy} mutedColor={mutedColor} />
      </View>
    );
  }

  return (
    <View style={styles.standby}>
      <Text style={[styles.standbyTitle, { color: mutedColor }]}>STANDBY</Text>
      <Text style={[styles.standbyBody, { color: mutedColor }]} numberOfLines={3}>
        SCANNING FOR THREATS… Tap a hostile in the arena to lock intel.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    overflow: 'visible',
  },
  standby: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 4,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(51, 51, 51, 0.9)',
    backgroundColor: DOSSIER_ROW_BG,
    overflow: 'hidden',
  },
  standbyTitle: {
    fontFamily: 'monospace',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
  },
  standbyBody: {
    fontFamily: 'monospace',
    fontSize: 6,
    lineHeight: 9,
    opacity: 0.75,
  },
});
