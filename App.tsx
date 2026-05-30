import React from 'react';
import { StyleSheet, SafeAreaView, StatusBar, View } from 'react-native';
import { TerminalProvider, useTerminal } from './src/context/TerminalContext';
import { GameFlowProvider, useGameFlow } from './src/context/GameFlowContext';
import { RunProvider } from './src/context/RunContext';
import WelcomeScreen from './src/screens/WelcomeScreen';
import ScanningScreen from './src/screens/ScanningScreen';
import PostCombatBoonScreen from './src/screens/PostCombatBoonScreen';
import SkillCheckScreen from './src/screens/SkillCheckScreen';
import RestScreen from './src/screens/RestScreen';
import CombatScreen from './src/screens/CombatScreen';
import RunCompleteScreen from './src/screens/RunCompleteScreen';
import GameOverScreen from './src/screens/GameOverScreen';

function GameRoot(): React.JSX.Element {
  const { theme } = useTerminal();
  const { currentScreen } = useGameFlow();

  return (
    <View style={[styles.screenContainer, { backgroundColor: theme.backgroundColor }]}>
      <StatusBar barStyle="light-content" />
      {currentScreen === 'WELCOME' && <WelcomeScreen />}
      {currentScreen === 'SCANNING' && <ScanningScreen />}
      {currentScreen === 'POST_COMBAT_BOON' && <PostCombatBoonScreen />}
      {currentScreen === 'SKILL_CHECK' && <SkillCheckScreen />}
      {currentScreen === 'REST' && <RestScreen />}
      {currentScreen === 'COMBAT' && <CombatScreen />}
      {currentScreen === 'RUN_COMPLETE' && <RunCompleteScreen />}
      {currentScreen === 'GAME_OVER' && <GameOverScreen />}
    </View>
  );
}

export default function App(): React.JSX.Element {
  return (
    <TerminalProvider>
      <RunProvider>
        <GameFlowProvider>
          <SafeAreaView style={styles.safeArea}>
            <GameRoot />
          </SafeAreaView>
        </GameFlowProvider>
      </RunProvider>
    </TerminalProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#1c1e21' },
  screenContainer: { flex: 1 },
});
