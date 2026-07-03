import React from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useImmersiveChrome } from './src/hooks/useImmersiveChrome';
import { TerminalProvider, useTerminal } from './src/context/TerminalContext';
import { TerminalNavProvider } from './src/context/TerminalNavContext';
import { PlayerAccountProvider } from './src/context/PlayerAccountContext';
import { RegionalShatterProvider } from './src/context/RegionalShatterContext';
import { WorldStateProvider } from './src/context/WorldStateContext';
import { GameFlowProvider, useGameFlow } from './src/context/GameFlowContext';
import { RunProvider } from './src/context/RunContext';
import OverworldHubScreen from './src/screens/OverworldHubScreen';
import WelcomeScreen from './src/screens/WelcomeScreen';
import BoundRequisitionScreen from './src/screens/BoundRequisitionScreen';
import ScanningScreen from './src/screens/ScanningScreen';
import NarrativeScreen from './src/screens/NarrativeScreen';
import PostCombatBoonScreen from './src/screens/PostCombatBoonScreen';
import SkillCheckScreen from './src/screens/SkillCheckScreen';
import RestScreen from './src/screens/RestScreen';
import BlackMarketScreen from './src/screens/BlackMarketScreen';
import ResourceHarvestScreen from './src/screens/ResourceHarvestScreen';
import ExtractionReviewScreen from './src/screens/ExtractionReviewScreen';
import CombatScreen from './src/screens/CombatScreen';
import CombatEntryTransition from './src/components/combat/CombatEntryTransition';
import TransitionOverlay from './src/components/transitions/TransitionOverlay';
import RunCompleteScreen from './src/screens/RunCompleteScreen';
import OperationDebriefScreen from './src/screens/OperationDebriefScreen';
import SafehouseScreen from './src/screens/SafehouseScreen';
import GameOverScreen from './src/screens/GameOverScreen';

function GameRoot(): React.JSX.Element {
  const { theme } = useTerminal();
  const { currentScreen, combatEntryActive, completeCombatEntry } = useGameFlow();
  useImmersiveChrome(true);

  return (
    <TransitionOverlay>
      <View style={[styles.screenContainer, { backgroundColor: theme.backgroundColor }]}>
        {currentScreen === 'HUB' && <OverworldHubScreen />}
        {currentScreen === 'WELCOME' && <WelcomeScreen />}
        {currentScreen === 'BOUND_REQUISITION' && <BoundRequisitionScreen />}
        {currentScreen === 'SCANNING' && <ScanningScreen />}
        {currentScreen === 'NARRATIVE' && <NarrativeScreen />}
        {currentScreen === 'POST_COMBAT_BOON' && <PostCombatBoonScreen />}
        {currentScreen === 'SKILL_CHECK' && <SkillCheckScreen />}
        {currentScreen === 'REST' && <RestScreen />}
        {currentScreen === 'BLACK_MARKET' && <BlackMarketScreen />}
        {currentScreen === 'RESOURCE_HARVEST' && <ResourceHarvestScreen />}
        {currentScreen === 'EXTRACTION_REVIEW' && <ExtractionReviewScreen />}
        {currentScreen === 'COMBAT' && <CombatScreen />}
        {currentScreen === 'RUN_COMPLETE' && <RunCompleteScreen />}
        {currentScreen === 'OPERATION_DEBRIEF' && <OperationDebriefScreen />}
        {currentScreen === 'SAFEHOUSE' && <SafehouseScreen />}
        {currentScreen === 'GAME_OVER' && <GameOverScreen />}
        {combatEntryActive ? (
          <CombatEntryTransition onComplete={completeCombatEntry} />
        ) : null}
      </View>
    </TransitionOverlay>
  );
}

export default function App(): React.JSX.Element {
  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <SafeAreaProvider>
        <PlayerAccountProvider>
          <RegionalShatterProvider>
            <WorldStateProvider>
            <TerminalProvider>
              <TerminalNavProvider>
                <RunProvider>
                  <GameFlowProvider>
                    <GameRoot />
                  </GameFlowProvider>
                </RunProvider>
              </TerminalNavProvider>
            </TerminalProvider>
            </WorldStateProvider>
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
