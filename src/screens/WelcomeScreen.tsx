import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Dimensions,
  Platform,
} from 'react-native';
import { useTerminal } from '../context/TerminalContext';
import { useGameFlow } from '../context/GameFlowContext';
import { useRun } from '../context/RunContext';

const { width } = Dimensions.get('window');
const TERMINAL_ACCENT = '#00ff33';

export default function WelcomeScreen(): React.JSX.Element {
  const { theme, profile } = useTerminal();
  const { startScanning } = useGameFlow();
  const { startNewRun } = useRun();

  const handleStartScan = () => {
    startNewRun();
    startScanning('INITIAL');
  };
  const credentials = profile.operative_profile.credentials;
  const vectors = profile.operative_profile.location_vectors;

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <View style={styles.gridBackdrop} pointerEvents="none">
        {Array.from({ length: 8 }).map((_, row) => (
          <View key={`row-${row}`} style={styles.gridRow}>
            {Array.from({ length: 6 }).map((__, col) => (
              <View
                key={`cell-${row}-${col}`}
                style={[styles.gridCell, { borderColor: `${theme.borderColor}55` }]}
              />
            ))}
          </View>
        ))}
      </View>

      <View style={[styles.headerStrip, { borderColor: theme.borderColor }]}>
        <Text style={[styles.headerStripText, { color: theme.mutedColor }]}>
          VEIL INCURSION // OPERATIVE TERMINAL // NODE: {vectors.current_node_lock.toUpperCase()}
        </Text>
      </View>

      <View style={styles.content}>
        <Text style={[styles.welcomeEyebrow, { color: theme.mutedColor }]}>
          SECURE CHANNEL ESTABLISHED
        </Text>
        <Text style={[styles.welcomeTitle, { color: theme.primaryColor }]}>
          Welcome back,{'\n'}
          <Text style={{ color: TERMINAL_ACCENT }}>{credentials.username}</Text>
        </Text>
        <Text style={[styles.welcomeBody, { color: theme.mutedColor }]}>
          Ley-line sensors are nominal. Your soul anchor is synced to the urban grid.
          Stand by for anomaly sweep authorization.
        </Text>

        <View style={[styles.badgeFrame, { borderColor: theme.primaryColor, shadowColor: theme.primaryColor }]}>
          <View style={[styles.badgeInner, { borderColor: theme.borderColor, backgroundColor: '#0a0b0f' }]}>
            <View style={[styles.badgeHeader, { borderBottomColor: theme.borderColor }]}>
              <Text style={[styles.badgeHeaderText, { color: theme.mutedColor }]}>AGENT BADGE</Text>
              <View style={[styles.statusDot, { backgroundColor: '#22c55e' }]} />
            </View>

            <View style={[styles.badgeEmblem, { borderColor: TERMINAL_ACCENT }]}>
              <Text style={styles.badgeEmblemText}>{credentials.class.slice(0, 1)}</Text>
            </View>

            <Text style={[styles.badgeClass, { color: theme.primaryColor }]}>{credentials.class} OPERATIVE</Text>
            <Text style={[styles.badgeCabal, { color: theme.mutedColor }]}>
              {credentials.cabal_alignment.replace('_', ' ')}
            </Text>
          </View>
        </View>

        <View style={[styles.idReadout, { borderColor: theme.borderColor, backgroundColor: '#0d0f14' }]}>
          <Text style={[styles.idLabel, { color: theme.mutedColor }]}>OPERATIVE ID READOUT</Text>
          <Text style={[styles.idValue, { color: TERMINAL_ACCENT }]}>{credentials.id}</Text>
          <View style={styles.idMetaRow}>
            <Text style={[styles.idMeta, { color: theme.mutedColor }]}>HANDLE</Text>
            <Text style={[styles.idMetaValue, { color: theme.primaryColor }]}>{credentials.username}</Text>
          </View>
          <View style={styles.idMetaRow}>
            <Text style={[styles.idMeta, { color: theme.mutedColor }]}>SECTOR LOCK</Text>
            <Text style={[styles.idMetaValue, { color: theme.primaryColor }]}>{vectors.home_sector}</Text>
          </View>
        </View>

        <Pressable
          onPress={handleStartScan}
          style={({ pressed }) => [
            styles.scanButton,
            {
              borderColor: TERMINAL_ACCENT,
              backgroundColor: pressed ? '#083344' : '#0e1624',
              shadowColor: TERMINAL_ACCENT,
            },
          ]}
        >
          <View style={styles.scanButtonGlow} />
          <Text style={styles.scanButtonLabel}>INITIATE ANOMALY SCAN</Text>
          <Text style={styles.scanButtonSub}>// AUTHORIZE LEY-LINE SWEEP</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? 24 : 8,
  },
  gridBackdrop: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.35,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridRow: {
    flexDirection: 'row',
  },
  gridCell: {
    width: (width - 32) / 6,
    height: 48,
    borderWidth: 0.5,
  },
  headerStrip: {
    borderBottomWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  headerStripText: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 32,
    justifyContent: 'center',
  },
  welcomeEyebrow: {
    fontFamily: 'monospace',
    fontSize: 10,
    letterSpacing: 2,
    marginBottom: 8,
  },
  welcomeTitle: {
    fontFamily: 'monospace',
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 32,
    marginBottom: 12,
  },
  welcomeBody: {
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 17,
    marginBottom: 28,
  },
  badgeFrame: {
    borderWidth: 2,
    padding: 3,
    marginBottom: 20,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 14,
    elevation: 8,
  },
  badgeInner: {
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
  },
  badgeHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingBottom: 8,
    marginBottom: 16,
  },
  badgeHeaderText: {
    fontFamily: 'monospace',
    fontSize: 10,
    letterSpacing: 1.5,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  badgeEmblem: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    backgroundColor: '#061018',
  },
  badgeEmblemText: {
    fontFamily: 'monospace',
    fontSize: 28,
    fontWeight: '700',
    color: TERMINAL_ACCENT,
  },
  badgeClass: {
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },
  badgeCabal: {
    fontFamily: 'monospace',
    fontSize: 10,
    marginTop: 4,
    letterSpacing: 0.8,
  },
  idReadout: {
    borderWidth: 1,
    padding: 14,
    marginBottom: 28,
  },
  idLabel: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 1.4,
    marginBottom: 6,
  },
  idValue: {
    fontFamily: 'monospace',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 10,
  },
  idMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  idMeta: {
    fontFamily: 'monospace',
    fontSize: 9,
  },
  idMetaValue: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '600',
  },
  scanButton: {
    borderWidth: 2,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 16,
    elevation: 10,
  },
  scanButtonGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#00ff3322',
  },
  scanButtonLabel: {
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: TERMINAL_ACCENT,
  },
  scanButtonSub: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: TERMINAL_ACCENT,
    marginTop: 4,
    letterSpacing: 1,
  },
});
