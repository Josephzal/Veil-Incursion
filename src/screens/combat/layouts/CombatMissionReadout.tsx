import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COMBAT_HUD_TYPE } from '../../../constants/combatHudTypography';
import { OTT, OTT_LAYOUT } from '../../../constants/occultTacticalTerminalTheme';

interface CombatMissionReadoutProps {
  depthLabel: string;
  sectorLabel: string;
  objectiveLabel: string | null;
}

/** Compact top-left mission readout — thin dividers, no bulky box. */
export default function CombatMissionReadout({
  depthLabel,
  sectorLabel,
  objectiveLabel,
}: CombatMissionReadoutProps): React.JSX.Element {
  return (
    <View style={styles.host} pointerEvents="none">
      <Text style={styles.depth} numberOfLines={1}>
        {depthLabel}
      </Text>
      <Text style={styles.sector} numberOfLines={1}>
        {sectorLabel}
      </Text>
      <View style={styles.rule} />
      <Text style={styles.objectiveHeader}>OBJECTIVE</Text>
      <Text style={styles.objective} numberOfLines={2}>
        {`> ${objectiveLabel ?? 'Survive the encounter'}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: OTT_LAYOUT.missionTop,
    left: OTT_LAYOUT.missionLeft,
    zIndex: 26,
    maxWidth: '22%',
    minWidth: 148,
    gap: 2,
    paddingHorizontal: 2,
  },
  depth: {
    fontFamily: OTT.mono,
    fontSize: COMBAT_HUD_TYPE.title,
    fontWeight: '800',
    letterSpacing: 1.1,
    color: OTT.textPrimary,
  },
  sector: {
    fontFamily: OTT.mono,
    fontSize: COMBAT_HUD_TYPE.label,
    fontWeight: '600',
    letterSpacing: 1,
    color: OTT.textSecondary,
    textTransform: 'uppercase',
  },
  rule: {
    marginTop: 5,
    marginBottom: 3,
    height: StyleSheet.hairlineWidth,
    backgroundColor: OTT.borderSubtle,
    width: '72%',
  },
  objectiveHeader: {
    fontFamily: OTT.mono,
    fontSize: COMBAT_HUD_TYPE.body,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: OTT.terminalGreenMuted,
  },
  objective: {
    fontFamily: OTT.mono,
    fontSize: COMBAT_HUD_TYPE.title,
    fontWeight: '600',
    letterSpacing: 0.35,
    color: OTT.textPrimary,
    lineHeight: COMBAT_HUD_TYPE.lineLabel + 2,
  },
});
