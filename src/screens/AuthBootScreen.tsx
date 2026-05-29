import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import { useTerminal } from '../context/TerminalContext';
import { CabalAlignment } from '../types';

// Enable Android LayoutAnimations if testing on an Android emulator/device
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function AuthBootScreen(): React.JSX.Element {
  const { theme, updateCabalAlignment } = useTerminal();
  const [bootLog, setBootLog] = useState('INITIALIZING SECURE PROTOCOLS...');

  useEffect(() => {
    setBootLog(theme.bootLog);
  }, [theme]);

  const handleCabalChange = (cabal: CabalAlignment) => {
    // Configures a crisp, professional 200ms linear ease-in layout transition
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    updateCabalAlignment(cabal);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <View style={styles.terminalWindow}>
        {/* Dynamic authoritative system boot text dictated by Cabal alignment */}
        <Text style={[styles.terminalText, { color: theme.primaryColor }]}>
          {bootLog}
        </Text>
        <Text style={[styles.subText, { color: theme.mutedColor }]}>
          SYSTEM STATUS: ONLINE. CYCLE CORES TO INJECT OVERRIDES.
        </Text>

        {/* Faction Override Selector Grid */}
        <View style={[styles.overridePanel, { borderColor: theme.borderColor }]}>
          <Text style={[styles.panelHeader, { color: theme.primaryColor }]}>
            FACTION OVERRIDE PROTOCOL
          </Text>
          <View style={styles.buttonGrid}>
            {(['TERRAN_GRID', 'LEGION', 'SOLARIS'] as CabalAlignment[]).map((cabal) => (
              <TouchableOpacity
                key={cabal}
                style={[styles.btn, { borderColor: theme.borderColor }]}
                onPress={() => handleCabalChange(cabal)}
              >
                <Text style={[styles.btnText, { color: theme.primaryColor }]}>
                  {cabal.split('_')[0]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  terminalWindow: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  terminalText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1.2,
    marginBottom: 12,
    lineHeight: 20,
  },
  subText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  overridePanel: {
    marginTop: 40,
    borderWidth: 1,
    padding: 16,
    borderStyle: 'dashed',
  },
  panelHeader: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.5,
    marginBottom: 12,
    textAlign: 'center',
  },
  buttonGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  btn: {
    flex: 1,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  btnText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});