import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import HapticPressable from '../HapticPressable';
import { useGameFlow } from '../../context/GameFlowContext';
import { useRun } from '../../context/RunContext';
import { usePlayerAccount } from '../../context/PlayerAccountContext';
import { useTerminal } from '../../context/TerminalContext';
import ExplorationHubPanel from '../ExplorationHubPanel';
import HubScreenShell, { HubSectionHeader } from './HubScreenShell';
import { hubKeyColor } from '../../constants/hubAtmosphere';
import {
  formatBracketHeader,
  getInteractiveButtonStyle,
  getInteractiveButtonTextStyle,
} from '../../styles/hubTerminalUi';

/** Dev-only hub utilities — test combat and exploration corridor. */
export default function DevTestHubPanel(): React.JSX.Element {
  const { theme } = useTerminal();
  const { startCombat } = useGameFlow();
  const { startBadgeTestCombat } = useRun();
  const { account } = usePlayerAccount();
  const [hubOpen, setHubOpen] = useState(false);
  const keyColor = hubKeyColor(theme.mutedColor);

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
      <HubScreenShell title="DEV TEST // EXPLORATION HUB" scrollable>
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
      </HubScreenShell>
    );
  }

  return (
    <HubScreenShell
      title="DEV TEST // SANDBOX"
      subtitle="Internal tools — remove before launch."
    >
      <HubSectionHeader title="TEST COMBAT // BADGE ARENA" color={theme.mutedColor} />
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

      <HapticPressable
        onPress={() => setHubOpen(true)}
        style={({ pressed }) => [
          getInteractiveButtonStyle(theme.primaryColor, { pressed, size: 'md' }),
          styles.hubBtn,
        ]}
      >
        <Text style={[getInteractiveButtonTextStyle('md'), { color: theme.primaryColor }]}>
          {formatBracketHeader('METROPOLITAN EXPLORATION CORRIDOR')}
        </Text>
        <Text style={[styles.hubSub, { color: keyColor }]}>
          Open exploration hub sandbox
        </Text>
      </HapticPressable>
    </HubScreenShell>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
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
  backBtn: { alignSelf: 'flex-start', marginBottom: 8 },
  hubPanel: {
    flex: 1,
    minHeight: 280,
  },
});
