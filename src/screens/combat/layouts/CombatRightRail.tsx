import React from 'react';
import { StyleSheet, View } from 'react-native';
import CombatPanel, { CombatSectionHeader } from '../../../components/combat/ui/CombatPanel';
import { OTT, OTT_LAYOUT } from '../../../constants/occultTacticalTerminalTheme';

interface CombatRightRailProps {
  combatLog: React.ReactNode;
  hostileIntel: React.ReactNode;
}

/**
 * Right stack — combat log + enemy intel.
 * STATUS / ITEMS / CARGO live under End Turn in the bottom console.
 */
export default function CombatRightRail({
  combatLog,
  hostileIntel,
}: CombatRightRailProps): React.JSX.Element {
  return (
    <View style={styles.host} pointerEvents="box-none">
      <CombatPanel raised style={styles.logPanel}>
        <CombatSectionHeader label="COMBAT LOG" accent={OTT.terminalGreenMuted} />
        <View style={styles.logBody}>{combatLog}</View>
      </CombatPanel>
      <CombatPanel raised style={styles.intelPanel}>
        <CombatSectionHeader label="ENEMY INTEL" accent={OTT.textSecondary} />
        <View style={styles.intelBody}>{hostileIntel}</View>
      </CombatPanel>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: 36,
    right: 10,
    bottom: OTT_LAYOUT.consoleHeightPercent,
    width: '17%',
    minWidth: 156,
    maxWidth: 220,
    zIndex: 22,
    gap: 6,
    pointerEvents: 'box-none',
  },
  logPanel: {
    flex: 1,
    minHeight: 0,
    maxHeight: '42%',
    paddingHorizontal: OTT.panelPad,
    paddingTop: 6,
    paddingBottom: 4,
  },
  logBody: {
    flex: 1,
    minHeight: 0,
  },
  intelPanel: {
    flex: 1.55,
    minHeight: 0,
    paddingHorizontal: OTT.panelPad,
    paddingTop: 6,
    paddingBottom: 4,
  },
  intelBody: {
    flex: 1,
    minHeight: 0,
  },
});
