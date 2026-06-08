import React from 'react';
import { StyleSheet, StatusBar, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
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
import CombatEntryTransition from './src/components/combat/CombatEntryTransition';
import RunCompleteScreen from './src/screens/RunCompleteScreen';
import GameOverScreen from './src/screens/GameOverScreen';

function GameRoot(): React.JSX.Element {
  const { theme } = useTerminal();
  const { currentScreen, combatEntryActive, completeCombatEntry } = useGameFlow();

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
      {currentScreen === 'RUN_COMPLETE' && <RunCompleteScreen />}
      {currentScreen === 'GAME_OVER' && <GameOverScreen />}
      {combatEntryActive ? (
        <CombatEntryTransition onComplete={completeCombatEntry} />
      ) : null}
    </View>
  );
}

export default function App(): React.JSX.Element {
  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
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
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  gestureRoot: { flex: 1 },
  screenContainer: { flex: 1 },
});
