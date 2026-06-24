import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import HapticPressable from '../HapticPressable';
import { useGameFlow } from '../../context/GameFlowContext';
import { useRun } from '../../context/RunContext';
import { usePlayerAccount } from '../../context/PlayerAccountContext';
import { useTerminal } from '../../context/TerminalContext';
import ExplorationHubPanel from '../ExplorationHubPanel';
import {
  formatBracketHeader,
  getInteractiveButtonStyle,
  getInteractiveButtonTextStyle,
  hubTerminalUi,
} from '../../styles/hubTerminalUi';

/** Dev-only hub utilities — test combat and exploration corridor. */
export default function DevTestHubPanel(): React.JSX.Element {
  const { theme } = useTerminal();
  const { startCombat } = useGameFlow();
  const { startBadgeTestCombat } = useRun();
  const { account } = usePlayerAccount();
  const [hubOpen, setHubOpen] = useState(false);

  const launchTestCombat = (preset: 'easy' | 'hard') => {
    startBadgeTestCombat(preset, {
      activeClass: account.activeClass,
      aegisLoadout: account.aegisLoadout,
      hexShotLoadout: account.hexShotLoadout,
      envoyLoadout: account.envoyLoadout,
    });
    startCombat();
  };

  if (hubOpen) {
    return (
      <View style={styles.root}>
        <HapticPressable
          onPress={() => setHubOpen(false)}
          style={({ pressed }) => [
            getInteractiveButtonStyle(theme.statusColor, { pressed, size: 'sm' }),
            styles.backBtn,
          ]}
        >
          <Text style={[getInteractiveButtonTextStyle('sm'), { color: theme.statusColor }]}>
            [ RETURN TO TEST MENU ]
          </Text>
        </HapticPressable>
        <View style={styles.hubPanel}>
          <ExplorationHubPanel />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Text style={[hubTerminalUi.sectionHeaderLg, styles.title, { color: theme.mutedColor }]}>
        {formatBracketHeader('DEV TEST // SANDBOX')}
      </Text>
      <Text style={[styles.sub, { color: theme.mutedColor }]}>
        Internal tools — remove before launch.
      </Text>

      <View style={styles.section}>
        <Text style={[hubTerminalUi.sectionHeader, { color: theme.mutedColor }]}>
          {formatBracketHeader('TEST COMBAT // BADGE ARENA')}
        </Text>
        <View style={styles.row}>
          <HapticPressable
            onPress={() => launchTestCombat('easy')}
            style={({ pressed }) => [
              getInteractiveButtonStyle(theme.primaryColor, { pressed, size: 'sm' }),
              styles.btn,
            ]}
          >
            <Text style={[getInteractiveButtonTextStyle('sm'), { color: theme.primaryColor }]}>
              [ EASY COMBAT ]
            </Text>
          </HapticPressable>
          <HapticPressable
            onPress={() => launchTestCombat('hard')}
            style={({ pressed }) => [
              getInteractiveButtonStyle(theme.statusColor, { pressed, size: 'sm' }),
              styles.btn,
            ]}
          >
            <Text style={[getInteractiveButtonTextStyle('sm'), { color: theme.statusColor }]}>
              [ HARD COMBAT ]
            </Text>
          </HapticPressable>
        </View>
      </View>

      <HapticPressable
        onPress={() => setHubOpen(true)}
        style={({ pressed }) => [
          getInteractiveButtonStyle(theme.primaryColor, { pressed, size: 'md' }),
          styles.hubBtn,
        ]}
      >
        <Text style={[getInteractiveButtonTextStyle('md'), { color: theme.primaryColor }]}>
          [ HUB ]
        </Text>
        <Text style={[styles.hubSub, { color: theme.mutedColor }]}>
          // METROPOLITAN EXPLORATION CORRIDOR
        </Text>
      </HapticPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
    gap: 12,
    paddingVertical: 4,
  },
  title: { marginBottom: 4 },
  sub: {
    fontFamily: 'monospace',
    fontSize: 8,
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  section: { gap: 8 },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  btn: { flex: 1 },
  hubBtn: {
    marginTop: 8,
    gap: 4,
    alignItems: 'flex-start',
  },
  hubSub: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.4,
  },
  backBtn: { alignSelf: 'flex-start' },
  hubPanel: {
    flex: 1,
    minHeight: 0,
  },
});
