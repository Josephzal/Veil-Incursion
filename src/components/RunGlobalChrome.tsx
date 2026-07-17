import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import RunFeedChromeButtons from './run/RunFeedChromeButtons';
import TerminalText from './TerminalText';
import { useTerminal } from '../context/TerminalContext';
import { useCargoOverlay } from '../context/CargoOverlayContext';
import { useRunStatusOverlay } from '../context/RunStatusOverlayContext';
import { useRun } from '../context/RunContext';
import { getEquippedKeepsakeShortLabel } from '../data/expeditionKeepsakeEngine';
import { buildKeepsakeLiveCounters } from '../data/expeditionKeepsakeRunUiEngine';
import { buildRunItemLiveCounters, shouldShowRunItemChromeChip } from '../data/runItemRunUiEngine';
import { countOccupiedRunItemSlots } from '../data/runItemRunState';

/** Floating cargo / status controls for non-combat run screens. */
export default function RunGlobalChrome(): React.JSX.Element | null {
  const { theme } = useTerminal();
  const { activeIncursion } = useRun();
  const cargo = useCargoOverlay();
  const status = useRunStatusOverlay();
  const showStatus = status?.statusEnabled ?? false;
  const showCargo = cargo?.cargoEnabled ?? false;
  const keepsakeLabel = getEquippedKeepsakeShortLabel(activeIncursion.keepsakeRuntime);
  const keepsakeCounters = useMemo(
    () => buildKeepsakeLiveCounters(activeIncursion.keepsakeRuntime),
    [activeIncursion.keepsakeRuntime],
  );
  const runItemCount = countOccupiedRunItemSlots(activeIncursion.runItems);
  const showRunItemsChip = shouldShowRunItemChromeChip(
    activeIncursion.itemRuntime,
    activeIncursion.runItems,
  );
  const runItemCounters = useMemo(
    () => buildRunItemLiveCounters(activeIncursion.itemRuntime, activeIncursion.runItems),
    [activeIncursion.itemRuntime, activeIncursion.runItems],
  );

  if (!showStatus && !showCargo && !keepsakeLabel && !showRunItemsChip) return null;

  return (
    <View style={styles.host} pointerEvents="box-none">
      <RunFeedChromeButtons
        accent={theme.statusColor}
        mutedColor={theme.mutedColor}
      />
      {keepsakeLabel ? (
        <View style={[styles.keepsakeChip, { borderColor: `${theme.statusColor}66` }]}>
          <Text style={[styles.keepsakeText, { color: theme.statusColor }]}>
            {`RELIC // ${keepsakeLabel}`}
          </Text>
          {keepsakeCounters.length > 0 ? (
            <View style={styles.counterRow}>
              {keepsakeCounters.map((counter) => {
                const color = counter.tone === 'warning'
                  ? '#f59e0b'
                  : counter.tone === 'accent'
                    ? theme.statusColor
                    : theme.mutedColor;
                return (
                  <Text
                    key={counter.key}
                    style={[styles.counterText, { color }]}
                  >
                    {`${counter.label} ${counter.value}`}
                  </Text>
                );
              })}
            </View>
          ) : null}
        </View>
      ) : null}
      {showRunItemsChip ? (
        <View style={[styles.keepsakeChip, { borderColor: `${theme.statusColor}66` }]}>
          <TerminalText variant="caption" style={{ color: theme.statusColor, fontSize: 9, fontWeight: '700' }}>
            {runItemCount > 0 ? `RUN ITEMS // ${runItemCount}/4` : 'RUN ITEMS // ACTIVE'}
          </TerminalText>
          {runItemCounters.length > 0 ? (
            <View style={styles.counterRow}>
              {runItemCounters.map((counter) => {
                const color = counter.tone === 'warning'
                  ? '#f59e0b'
                  : counter.tone === 'accent'
                    ? theme.statusColor
                    : theme.mutedColor;
                return (
                  <Text
                    key={counter.key}
                    style={[styles.counterText, { color }]}
                  >
                    {`${counter.label} ${counter.value}`}
                  </Text>
                );
              })}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 30,
    elevation: 30,
    alignItems: 'flex-end',
    gap: 6,
    maxWidth: 220,
  },
  keepsakeChip: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    gap: 4,
  },
  keepsakeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  counterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  counterText: {
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 0.5,
    fontFamily: 'monospace',
  },
});
