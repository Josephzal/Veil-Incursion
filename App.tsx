import React from 'react';
import { StyleSheet, StatusBar, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TerminalProvider, useTerminal } from './src/context/TerminalContext';
import { TerminalNavProvider } from './src/context/TerminalNavContext';
import { PlayerAccountProvider } from './src/context/PlayerAccountContext';
import { RegionalShatterProvider } from './src/context/RegionalShatterContext';
import { GameFlowProvider, useGameFlow } from './src/context/GameFlowContext';
import { RunProvider } from './src/context/RunContext';
import OverworldHubScreen from './src/screens/OverworldHubScreen';
import WelcomeScreen from './src/screens/WelcomeScreen';
import ScanningScreen from './src/screens/ScanningScreen';
import NarrativeScreen from './src/screens/NarrativeScreen';
import PostCombatBoonScreen from './src/screens/PostCombatBoonScreen';
import SkillCheckScreen from './src/screens/SkillCheckScreen';
import RestScreen from './src/screens/RestScreen';
import CombatScreen from './src/screens/CombatScreen';
import RunProgressScreen from './src/screens/RunProgressScreen';
import RunCompleteScreen from './src/screens/RunCompleteScreen';
import GameOverScreen from './src/screens/GameOverScreen';

function GameRoot(): React.JSX.Element {
  const { theme } = useTerminal();
  const { currentScreen } = useGameFlow();

  return (
    <View style={[styles.screenContainer, { backgroundColor: theme.backgroundColor }]}>
      <StatusBar barStyle="light-content" backgroundColor={theme.backgroundColor} />
      {currentScreen === 'HUB' && <OverworldHubScreen />}
      {currentScreen === 'WELCOME' && <WelcomeScreen />}
      {currentScreen === 'SCANNING' && <ScanningScreen />}
      {currentScreen === 'NARRATIVE' && <NarrativeScreen />}
      {currentScreen === 'POST_COMBAT_BOON' && <PostCombatBoonScreen />}
      {currentScreen === 'SKILL_CHECK' && <SkillCheckScreen />}
      {currentScreen === 'REST' && <RestScreen />}
      {currentScreen === 'COMBAT' && <CombatScreen />}
      {currentScreen === 'RUN_PROGRESS' && <RunProgressScreen />}
      {currentScreen === 'RUN_COMPLETE' && <RunCompleteScreen />}
      {currentScreen === 'GAME_OVER' && <GameOverScreen />}
    </View>
  );
}

export default function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <PlayerAccountProvider>
        <RegionalShatterProvider>
          <TerminalProvider>
            <TerminalNavProvider>
              <RunProvider>
                <GameFlowProvider>
                  <GameRoot />
                </GameFlowProvider>
              </RunProvider>
            </TerminalNavProvider>
          </TerminalProvider>
        </RegionalShatterProvider>
      </PlayerAccountProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screenContainer: { flex: 1 },
});
