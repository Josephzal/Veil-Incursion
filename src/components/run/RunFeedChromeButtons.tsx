import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import HapticPressable from '../HapticPressable';
import TacticalButton from '../TacticalButton';
import { useCargoOverlay } from '../../context/CargoOverlayContext';
import { useRunStatusOverlay } from '../../context/RunStatusOverlayContext';
import { useRunItemOverlay } from '../../context/RunItemOverlayContext';
import { OTT } from '../../constants/occultTacticalTerminalTheme';
import { COMBAT_HUD_TYPE } from '../../constants/combatHudTypography';
import { combatConsoleChromeStyle } from '../../theme/combatConsoleChrome';

const TERMINAL_CHROME_ACCENT = '#8AA0A8';

interface RunFeedChromeButtonsProps {
  accent: string;
  mutedColor: string;
  /** Thin concept tabs for Occult Tactical Terminal combat chrome. */
  terminal?: boolean;
  /** Stack STATUS / ITEMS / CARGO vertically (bottom-right under End Turn). */
  stack?: boolean;
  /** Larger combat-console chrome targets under End Turn. */
  consoleScale?: boolean;
  /** Compact horizontal utility row above End Turn (combat system module). */
  systemModule?: boolean;
}

function TerminalChromeButton({
  label,
  onPress,
  stacked,
  consoleScale,
  systemModule,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  stacked: boolean;
  consoleScale: boolean;
  systemModule: boolean;
  accessibilityLabel: string;
}): React.JSX.Element {
  const [hot, setHot] = useState(false);
  return (
    <HapticPressable
      onPress={onPress}
      onHoverIn={() => setHot(true)}
      onHoverOut={() => setHot(false)}
      style={({ pressed }) => [
        styles.terminalBtn,
        stacked && !systemModule && styles.terminalBtnStacked,
        consoleScale && !systemModule && styles.terminalBtnConsole,
        systemModule && styles.terminalBtnSystem,
        combatConsoleChromeStyle({
          accent: hot || pressed ? OTT.cyanSelect : TERMINAL_CHROME_ACCENT,
          tone: hot || pressed ? 'awake' : 'rest',
        }),
        { opacity: pressed ? 0.88 : 1 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Text style={[
        styles.terminalLabel,
        consoleScale && !systemModule && styles.terminalLabelConsole,
        systemModule && styles.terminalLabelSystem,
        (hot) ? styles.terminalLabelHot : null,
      ]}>
        {label}
      </Text>
    </HapticPressable>
  );
}

/** STATUS / CARGO controls — shared by scanner data feed and run global chrome. */
export default function RunFeedChromeButtons({
  accent,
  mutedColor,
  terminal = false,
  stack = false,
  consoleScale = false,
  systemModule = false,
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
      <View style={[
        systemModule
          ? styles.terminalSystemRow
          : stack
            ? styles.terminalStack
            : styles.terminalRow,
        !systemModule && consoleScale ? styles.terminalStackConsole : null,
      ]}>
        {showStatus ? (
          <TerminalChromeButton
            label="STATUS"
            onPress={status!.openStatus}
            stacked={stack}
            consoleScale={consoleScale}
            systemModule={systemModule}
            accessibilityLabel="Open operative status"
          />
        ) : null}
        {showItems ? (
          <TerminalChromeButton
            label="ITEMS"
            onPress={runItems!.openItems}
            stacked={stack}
            consoleScale={consoleScale}
            systemModule={systemModule}
            accessibilityLabel="Open run items"
          />
        ) : null}
        {showCargo ? (
          <TerminalChromeButton
            label="CARGO"
            onPress={cargo!.openCargo}
            stacked={stack}
            consoleScale={consoleScale}
            systemModule={systemModule}
            accessibilityLabel="Open cargo grid"
          />
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
  terminalStackConsole: {
    gap: 6,
  },
  terminalBtn: {
    paddingHorizontal: 6,
    paddingVertical: 6,
    minWidth: 0,
    minHeight: 26,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 2,
    overflow: 'visible',
  },
  terminalBtnStacked: {
    width: '100%',
    minWidth: 0,
    flex: 0,
    paddingVertical: 5,
  },
  terminalBtnConsole: {
    minHeight: 30,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  terminalLabel: {
    fontFamily: OTT.mono,
    fontSize: COMBAT_HUD_TYPE.caption,
    fontWeight: '700',
    letterSpacing: 0.9,
    color: OTT.textSecondary,
  },
  terminalLabelConsole: {
    fontSize: 9,
    letterSpacing: 1,
    fontWeight: '700',
    color: OTT.textSecondary,
  },
  terminalSystemRow: {
    flexDirection: 'row',
    gap: 4,
    flexShrink: 0,
    width: '100%',
  },
  terminalBtnSystem: {
    flex: 1,
    minWidth: 0,
    minHeight: 28,
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  terminalLabelSystem: {
    fontSize: 8,
    letterSpacing: 0.8,
    fontWeight: '700',
    color: OTT.textMuted,
  },
  terminalLabelHot: {
    color: OTT.cyanSelect,
  },
});
