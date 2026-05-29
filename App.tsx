import React from 'react';
import { StyleSheet, SafeAreaView, StatusBar, ScrollView, View } from 'react-native';
import { TerminalProvider, useTerminal } from './src/context/TerminalContext';
import ProfileCard from './src/components/ProfileCard';
import BlueprintSilhouette from './src/components/BlueprintSilhouette'; // Insert new component link

function MainTerminalScreen(): React.JSX.Element {
  const { theme } = useTerminal();

  return (
    <View style={[styles.screenContainer, { backgroundColor: theme.backgroundColor }]}>
      <StatusBar barStyle="light-content" />
      
      {/* Wrap into an administrative list view container to allow complete card scanning layout */}
      <ScrollView contentContainerStyle={styles.scrollWrapper} showsVerticalScrollIndicator={false}>
        <ProfileCard />
        <BlueprintSilhouette />
      </ScrollView>
    </View>
  );
}

export default function App(): React.JSX.Element {
  return (
    <TerminalProvider>
      <SafeAreaView style={styles.safeArea}>
        <MainTerminalScreen />
      </SafeAreaView>
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
  scrollWrapper: {
    paddingVertical: 16,
    alignItems: 'center',
  },
});