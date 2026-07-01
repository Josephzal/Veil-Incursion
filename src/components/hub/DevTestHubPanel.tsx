import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import HapticPressable from '../HapticPressable';
import { useGameFlow } from '../../context/GameFlowContext';
import { useRun } from '../../context/RunContext';
import { usePlayerAccount } from '../../context/PlayerAccountContext';
import { useTerminal } from '../../context/TerminalContext';
import ExplorationHubPanel from '../ExplorationHubPanel';
import HubScreenShell, { HubSectionHeader } from './HubScreenShell';
import { hubKeyColor } from '../../constants/hubAtmosphere';
import type { DevSandboxPreset } from '../../types/devSandbox';
import {
  formatBracketHeader,
  getInteractiveButtonStyle,
  getInteractiveButtonTextStyle,
} from '../../styles/hubTerminalUi';

interface SandboxLaunchButtonProps {
  label: string;
  onPress: () => void;
  accentColor: string;
}

function SandboxLaunchButton({ label, onPress, accentColor }: SandboxLaunchButtonProps): React.JSX.Element {
  return (
    <HapticPressable
      onPress={onPress}
      style={({ pressed }) => [
        getInteractiveButtonStyle(accentColor, { pressed, size: 'sm' }),
        styles.launchBtn,
      ]}
    >
      <Text style={[getInteractiveButtonTextStyle('sm'), { color: accentColor }]}>
        {label}
      </Text>
    </HapticPressable>
  );
}

/** Dev-only hub utilities — isolated node previews for QA. */
export default function DevTestHubPanel(): React.JSX.Element {
  const { theme } = useTerminal();
  const {
    startCombat,
    startNarrative,
    startRest,
    startBlackMarket,
    startExtractionReview,
    startSafehouse,
    startResourceHarvest,
  } = useGameFlow();
  const { startDevSandboxNode } = useRun();
  const { account } = usePlayerAccount();
  const [hubOpen, setHubOpen] = useState(false);
  const keyColor = hubKeyColor(theme.mutedColor);

  const sandboxConfig = useMemo(() => ({
    activeClass: account.activeClass,
    aegisLoadout: account.aegisLoadout,
    hexShotLoadout: account.hexShotLoadout,
    envoyLoadout: account.envoyLoadout,
    alignedFaction: account.alignedFaction,
  }), [
    account.activeClass,
    account.aegisLoadout,
    account.envoyLoadout,
    account.alignedFaction,
    account.hexShotLoadout,
  ]);

  const launchSandbox = useCallback((
    preset: DevSandboxPreset,
    navigate: () => void,
  ) => {
    startDevSandboxNode(preset, sandboxConfig);
    navigate();
  }, [sandboxConfig, startDevSandboxNode]);

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
      subtitle="Isolated node previews — continue returns here."
      scrollable
    >
      <HubSectionHeader title="NARRATIVE // TENSION MINI-GAMES" color={theme.mutedColor} />
      <View style={styles.grid}>
        <SandboxLaunchButton
          label="[ SCAVENGE BAR ]"
          accentColor={theme.primaryColor}
          onPress={() => launchSandbox('narrative-scavenge', startNarrative)}
        />
        <SandboxLaunchButton
          label="[ CONCEAL SLIDER ]"
          accentColor={theme.primaryColor}
          onPress={() => launchSandbox('narrative-conceal', startNarrative)}
        />
        <SandboxLaunchButton
          label="[ GRID CIPHER ]"
          accentColor={theme.primaryColor}
          onPress={() => launchSandbox('narrative-sigil', startNarrative)}
        />
      </View>

      <HubSectionHeader title="COMBAT // ENCOUNTER NODES" color={theme.mutedColor} />
      <View style={styles.grid}>
        <SandboxLaunchButton
          label="[ STANDARD COMBAT ]"
          accentColor={theme.statusColor}
          onPress={() => launchSandbox('standard-combat', startCombat)}
        />
        <SandboxLaunchButton
          label="[ ELITE COMBAT ]"
          accentColor={theme.statusColor}
          onPress={() => launchSandbox('elite-combat', startCombat)}
        />
        <SandboxLaunchButton
          label="[ EASY COMBAT ]"
          accentColor={theme.primaryColor}
          onPress={() => launchSandbox('combat-easy', startCombat)}
        />
        <SandboxLaunchButton
          label="[ HARD COMBAT ]"
          accentColor={theme.statusColor}
          onPress={() => launchSandbox('combat-hard', startCombat)}
        />
      </View>

      <HubSectionHeader title="INCURSION // FIELD NODES" color={theme.mutedColor} />
      <View style={styles.grid}>
        <SandboxLaunchButton
          label="[ SANCTUARY ]"
          accentColor={TERMINAL_ACCENT}
          onPress={() => launchSandbox('sanctuary', startRest)}
        />
        <SandboxLaunchButton
          label="[ EXTRACTION REVIEW ]"
          accentColor={TERMINAL_ACCENT}
          onPress={() => launchSandbox('extraction', startExtractionReview)}
        />
        <SandboxLaunchButton
          label="[ BLACK MARKET ]"
          accentColor={TERMINAL_ACCENT}
          onPress={() => launchSandbox('black-market', startBlackMarket)}
        />
        <SandboxLaunchButton
          label="[ INCURSION SAFEHOUSE ]"
          accentColor={TERMINAL_ACCENT}
          onPress={() => launchSandbox('incursion-safehouse', startSafehouse)}
        />
        <SandboxLaunchButton
          label="[ RESOURCE HARVEST ]"
          accentColor={TERMINAL_ACCENT}
          onPress={() => launchSandbox('resource-harvest', startResourceHarvest)}
        />
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

const TERMINAL_ACCENT = '#00ff33';

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  launchBtn: {
    minWidth: '47%',
    flexGrow: 1,
  },
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
