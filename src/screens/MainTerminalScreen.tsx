import React from 'react';
import { StyleSheet, View, SafeAreaView, Text, Platform } from 'react-native';
import { useTerminal } from '../context/TerminalContext';
import ProfileCard from '../components/ProfileCard';

export default function MainTerminalScreen() {
  const { theme } = useTerminal(); // profile is safely extracted downstream or can be read here

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <View style={styles.wrapper}>
        <Text style={[styles.panelTitle, { color: theme.primaryColor }]}>
          CURRENT OPERATIVE CREDENTIALS
        </Text>
        
        {/* Render our pristine digital passport asset[cite: 1] */}
        <ProfileCard />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  wrapper: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? 40 : 16,
    paddingHorizontal: 16,
  },
  panelTitle: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textAlign: 'center',
    textTransform: 'uppercase',
    marginBottom: 20,
  },
});