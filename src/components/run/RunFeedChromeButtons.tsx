import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import HapticPressable from '../HapticPressable';
import TacticalButton from '../TacticalButton';
import { useCargoOverlay } from '../../context/CargoOverlayContext';
import { useRunStatusOverlay } from '../../context/RunStatusOverlayContext';
import { useRunItemOverlay } from '../../context/RunItemOverlayContext';
import { OTT } from '../../constants/occultTacticalTerminalTheme';

interface RunFeedChromeButtonsProps {
  accent: string;
  mutedColor: string;
  /** Thin concept tabs for Occult Tactical Terminal combat chrome. */
  terminal?: boolean;
  /** Stack STATUS / ITEMS / CARGO vertically (bottom-right under End Turn). */
  stack?: boolean;
}

/** STATUS / CARGO controls — shared by scanner data feed and run global chrome. */
export default function RunFeedChromeButtons({
  accent,
  mutedColor,
  terminal = false,
  stack = false,
}: RunFeedChromeButtonsProps): React.JSX.Element | null {
  const cargo = useCargoOverlay();
  const status = useRunStatusOverlay();
  const runItems = useRunItemOverlay();
  const showStatus = status?.statusEnabled ?? false;
  const showCargo = cargo?.cargoEnabled ?? false;
  const showItems = runItems?.itemsEnabled ?? false;

  if (!showStatus && !showCargo && !showItems) return null;

  if (terminal) {
    return (
      <View style={stack ? styles.terminalStack : styles.terminalRow}>
        {showStatus ? (
          <HapticPressable
            onPress={status!.openStatus}
            style={({ pressed }) => [
              styles.terminalBtn,
              stack && styles.terminalBtnStacked,
              { opacity: pressed ? 0.7 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Open operative status"
          >
            <Text style={styles.terminalLabel}>STATUS</Text>
          </HapticPressable>
        ) : null}
        {showItems ? (
          <HapticPressable
            onPress={runItems!.openItems}
            style={({ pressed }) => [
              styles.terminalBtn,
              stack && styles.terminalBtnStacked,
              { opacity: pressed ? 0.7 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Open run items"
          >
            <Text style={styles.terminalLabel}>ITEMS</Text>
          </HapticPressable>
        ) : null}
        {showCargo ? (
          <HapticPressable
            onPress={cargo!.openCargo}
            style={({ pressed }) => [
              styles.terminalBtn,
              stack && styles.terminalBtnStacked,
              { opacity: pressed ? 0.7 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Open cargo grid"
          >
            <Text style={styles.terminalLabel}>CARGO</Text>
          </HapticPressable>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.row}>
      {showStatus ? (
        <TacticalButton
          label="STATUS"
          active={false}
          onPress={status!.openStatus}
          accentColor={accent}
          mutedColor={mutedColor}
          variant="inline"
        />
      ) : null}
      {showItems ? (
        <TacticalButton
          label="ITEMS"
          active={false}
          onPress={runItems!.openItems}
          accentColor={accent}
          mutedColor={mutedColor}
          variant="inline"
        />
      ) : null}
      {showCargo ? (
        <TacticalButton
          label="CARGO"
          active={false}
          onPress={cargo!.openCargo}
          accentColor={accent}
          mutedColor={mutedColor}
          variant="inline"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
    flexShrink: 0,
  },
  terminalRow: {
    flexDirection: 'row',
    gap: 5,
    flexShrink: 0,
    width: '100%',
  },
  terminalStack: {
    flexDirection: 'column',
    gap: 4,
    flexShrink: 0,
    width: '100%',
  },
  terminalBtn: {
    borderWidth: 1,
    borderColor: OTT.borderSubtle,
    backgroundColor: 'rgba(8, 12, 14, 0.82)',
    paddingHorizontal: 6,
    paddingVertical: 6,
    minWidth: 0,
    minHeight: 26,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  terminalBtnStacked: {
    width: '100%',
    minWidth: 0,
    flex: 0,
    paddingVertical: 5,
  },
  terminalLabel: {
    fontFamily: OTT.mono,
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.9,
    color: OTT.textSecondary,
  },
});
