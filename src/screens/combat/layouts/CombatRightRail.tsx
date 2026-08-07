import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import CombatPanel, { CombatSectionHeader } from '../../../components/combat/ui/CombatPanel';
import HapticPressable from '../../../components/HapticPressable';
import { useRun } from '../../../context/RunContext';
import { OTT, OTT_LAYOUT } from '../../../constants/occultTacticalTerminalTheme';

interface CombatRightRailProps {
  combatLog: React.ReactNode;
  hostileIntel: React.ReactNode;
}

/**
 * Right stack — combat log + enemy intel.
 * Empty combat log collapses to a narrow header; expands on first event or tap.
 */
export default function CombatRightRail({
  combatLog,
  hostileIntel,
}: CombatRightRailProps): React.JSX.Element {
  const { runLog } = useRun();
  const hasEntries = runLog.length > 0;
  const [expanded, setExpanded] = useState(hasEntries);

  useEffect(() => {
    if (hasEntries) setExpanded(true);
  }, [hasEntries]);

  const showLogBody = hasEntries || expanded;

  return (
    <View style={styles.host} pointerEvents="box-none">
      {showLogBody ? (
        <CombatPanel raised style={styles.logPanel}>
          <HapticPressable
            onPress={() => setExpanded((open) => !open)}
            haptic={false}
            sfx={false}
            accessibilityRole="button"
            accessibilityLabel={expanded ? 'Collapse combat log' : 'Expand combat log'}
          >
            <CombatSectionHeader label="COMBAT LOG" accent={OTT.terminalGreenMuted} />
          </HapticPressable>
          {expanded ? <View style={styles.logBody}>{combatLog}</View> : null}
        </CombatPanel>
      ) : (
        <HapticPressable
          onPress={() => setExpanded(true)}
          style={styles.logCollapsed}
          accessibilityRole="button"
          accessibilityLabel="Expand combat log"
        >
          <Text style={styles.logCollapsedLabel}>COMBAT LOG</Text>
          <Text style={styles.logCollapsedHint}>TAP TO EXPAND</Text>
        </HapticPressable>
      )}
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
    justifyContent: 'flex-start',
  },
  logCollapsed: {
    flexGrow: 0,
    flexShrink: 0,
    paddingHorizontal: OTT.panelPad,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: OTT.borderMuted,
    backgroundColor: 'rgba(8, 12, 14, 0.72)',
    gap: 1,
  },
  logCollapsedLabel: {
    fontFamily: OTT.mono,
    fontSize: OTT.headerSize,
    fontWeight: '800',
    letterSpacing: OTT.headerTracking,
    color: OTT.terminalGreenMuted,
  },
  logCollapsedHint: {
    fontFamily: OTT.mono,
    fontSize: 7,
    letterSpacing: 0.8,
    color: OTT.textMuted,
  },
  logPanel: {
    flexGrow: 0,
    flexShrink: 1,
    maxHeight: '30%',
    minHeight: 0,
    paddingHorizontal: OTT.panelPad,
    paddingTop: 6,
    paddingBottom: 4,
  },
  logBody: {
    flexGrow: 0,
    flexShrink: 1,
    minHeight: 36,
    maxHeight: 120,
  },
  intelPanel: {
    flexGrow: 0,
    flexShrink: 1,
    maxHeight: '58%',
    paddingHorizontal: OTT.panelPad,
    paddingTop: 6,
    paddingBottom: 4,
  },
  intelBody: {
    flexGrow: 0,
    flexShrink: 1,
  },
});
