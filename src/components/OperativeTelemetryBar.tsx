import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';

function resourcePercent(current: number, max: number): number {
  if (max <= 0) return 0;
  return Math.round((current / max) * 100);
}

/** HEALTH // SHIELD // STAMINA // ENERGY strip — shared by scan, narrative, and sanctuary screens. */
export default function OperativeTelemetryBar(): React.JSX.Element {
  const { theme } = useTerminal();
  const { runState } = useRun();

  const operativeTelemetry = useMemo(() => {
    const healthPct = resourcePercent(runState.soulAnchorIntegrity, runState.maxSoulAnchor);
    const staminaPct = resourcePercent(runState.currentStamina, runState.maxStamina);
    const shieldPct = Math.max(0, Math.min(100, healthPct + 8));
    const energyPct = Math.max(0, Math.min(100, runState.startingKineticPercent));
    return `HEALTH: ${healthPct}% // SHIELD: ${shieldPct}% // STAMINA: ${staminaPct}% // ENERGY: ${energyPct}%`;
  }, [
    runState.soulAnchorIntegrity,
    runState.maxSoulAnchor,
    runState.currentStamina,
    runState.maxStamina,
    runState.startingKineticPercent,
  ]);

  return (
    <View style={[styles.statusBar, { borderColor: theme.borderColor }]}>
      <Text style={[styles.statusBarResources, { color: theme.primaryColor }]}>
        {operativeTelemetry}
      </Text>
    </View>
  );
}

export const operativeTelemetryBarStyles = StyleSheet.create({
  statusBar: {
    borderBottomWidth: 1,
    paddingTop: 8,
    paddingBottom: 10,
    paddingHorizontal: 16,
    flexShrink: 0,
    gap: 6,
  },
  statusBarResources: {
    fontFamily: 'monospace',
    fontSize: 8,
    letterSpacing: 0.9,
    textAlign: 'center',
    lineHeight: 11,
  },
});

const styles = operativeTelemetryBarStyles;
