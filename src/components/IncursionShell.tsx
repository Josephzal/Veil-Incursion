import React from 'react';
import { StyleSheet, View } from 'react-native';
import DescentPipelineHUD from '../components/DescentPipelineHUD';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';
import { getFactionDefinition } from '../data/factions';
import { usePlayerAccount } from '../context/PlayerAccountContext';

interface IncursionShellProps {
  children: React.ReactNode;
  hidePipeline?: boolean;
}

export default function IncursionShell({ children, hidePipeline = false }: IncursionShellProps): React.JSX.Element {
  const { theme } = useTerminal();
  const { activeIncursion } = useRun();
  const { account } = usePlayerAccount();
  const accent =
    account.alignedFaction != null
      ? getFactionDefinition(account.alignedFaction).accentColor
      : '#00ff33';

  return (
    <View style={styles.root}>
      {activeIncursion.isRunActive && !hidePipeline && (
        <DescentPipelineHUD
          tier={activeIncursion.currentTier}
          currentNodeIndex={activeIncursion.currentNodeIndex}
          tierNodes={activeIncursion.tierNodes}
          accentColor={accent}
          borderColor={theme.borderColor}
          mutedColor={theme.mutedColor}
        />
      )}
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1 },
});
