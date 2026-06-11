import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';
import { buildOperativeVitalsLine } from '../utils/runStatusSnapshot';

/** @deprecated Top strip removed — vitals live in Run Status overlay (macro log). */
export default function OperativeTelemetryBar(): React.JSX.Element {
  const { theme } = useTerminal();
  const { runState, activeIncursion } = useRun();

  const operativeTelemetry = useMemo(
    () => buildOperativeVitalsLine(runState, activeIncursion),
    [runState, activeIncursion],
  );

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
