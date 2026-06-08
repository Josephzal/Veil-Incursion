import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import DescentPipelineHUD from '../components/DescentPipelineHUD';
import ExtractConfirmOverlay from '../components/ExtractConfirmOverlay';
import TerminalSafeArea from '../components/TerminalSafeArea';
import { useGameFlow } from '../context/GameFlowContext';
import { useRun } from '../context/RunContext';
import { useTerminalNav } from '../context/TerminalNavContext';
import { useTerminal } from '../context/TerminalContext';
import { getFactionDefinition } from '../data/factions';
import { usePlayerAccount } from '../context/PlayerAccountContext';

interface IncursionShellProps {
  children: React.ReactNode;
  hidePipeline?: boolean;
}

export default function IncursionShell({ children, hidePipeline = false }: IncursionShellProps): React.JSX.Element {
  const { theme } = useTerminal();
  const { activeIncursion, exitCombatToBadge } = useRun();
  const { goToHub } = useGameFlow();
  const { setTerminalView } = useTerminalNav();
  const { account } = usePlayerAccount();
  const [extractConfirmVisible, setExtractConfirmVisible] = useState(false);
  const accent =
    account.alignedFaction != null
      ? getFactionDefinition(account.alignedFaction).accentColor
      : '#00ff33';

  const handleConfirmExtract = useCallback(() => {
    setExtractConfirmVisible(false);
    exitCombatToBadge();
    goToHub();
    setTerminalView('BADGE');
  }, [exitCombatToBadge, goToHub, setTerminalView]);

  return (
    <TerminalSafeArea edges={['top', 'left', 'right']}>
      <View style={styles.root}>
        {activeIncursion.isRunActive && !hidePipeline ? (
          <DescentPipelineHUD
            depth={activeIncursion.currentDepth}
            currentEncounterIndex={activeIncursion.currentEncounterIndex}
            encounterPath={activeIncursion.encounterPath}
            accentColor={accent}
            borderColor={theme.borderColor}
            mutedColor={theme.mutedColor}
            showExtract
            onExtractPress={() => setExtractConfirmVisible(true)}
          />
        ) : null}
        <View style={styles.body}>{children}</View>
      </View>

      <ExtractConfirmOverlay
        visible={extractConfirmVisible}
        theme={theme}
        accentColor={accent}
        onConfirm={handleConfirmExtract}
        onCancel={() => setExtractConfirmVisible(false)}
      />
    </TerminalSafeArea>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1 },
});
