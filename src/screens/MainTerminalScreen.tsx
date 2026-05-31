import React from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';
import { useTerminal } from '../context/TerminalContext';
import ProfileCard from '../components/ProfileCard';
import TerminalSafeArea from '../components/TerminalSafeArea';

export default function MainTerminalScreen(): React.JSX.Element {
  const { theme } = useTerminal();

  return (
    <TerminalSafeArea>
      <View style={styles.wrapper}>
        <Text style={[styles.panelTitle, { color: theme.primaryColor }]}>
          CURRENT OPERATIVE CREDENTIALS
        </Text>
        <ProfileCard />
      </View>
    </TerminalSafeArea>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    paddingTop: 16,
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
