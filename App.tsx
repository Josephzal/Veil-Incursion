import React from 'react';
import { StyleSheet, SafeAreaView, StatusBar, View } from 'react-native';
import { TerminalProvider, useTerminal } from './src/context/TerminalContext';
import { GameFlowProvider, useGameFlow } from './src/context/GameFlowContext';
import WelcomeScreen from './src/screens/WelcomeScreen';
import ScanningScreen from './src/screens/ScanningScreen';
import CombatScreen from './src/screens/CombatScreen';

function GameRoot(): React.JSX.Element {
  const { theme } = useTerminal();
  const { currentScreen } = useGameFlow();

  return (
    <View style={[styles.screenContainer, { backgroundColor: theme.backgroundColor }]}>
      <StatusBar barStyle="light-content" />
      {currentScreen === 'WELCOME' && <WelcomeScreen />}
      {currentScreen === 'SCANNING' && <ScanningScreen />}
      {currentScreen === 'COMBAT' && <CombatScreen />}
    </View>
  );
}

export default function App(): React.JSX.Element {
  return (
    <TerminalProvider>
      <GameFlowProvider>
        <SafeAreaView style={styles.safeArea}>
          <GameRoot />
        </SafeAreaView>
      </GameFlowProvider>
    </TerminalProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1c1e21',
  },
  screenContainer: {
    flex: 1,
  },
});
