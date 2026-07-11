import React from 'react';
import { ScrollView, StyleSheet, View, Text } from 'react-native';
import HapticPressable from '../components/HapticPressable';
import { useTerminal } from '../context/TerminalContext';
import { useGameFlow } from '../context/GameFlowContext';
import { usePlayerAccount } from '../context/PlayerAccountContext';
import { useRun } from '../context/RunContext';
import FactionBootLogo from '../components/FactionBootLogo';
import LandscapeSplitPane from '../components/layout/LandscapeSplitPane';
import TerminalSafeArea from '../components/TerminalSafeArea';
import { DEFAULT_HOME_SECTOR_PROFILE_LABEL } from '../constants/homeSector';
import { LANDSCAPE_PANEL_PADDING, LANDSCAPE_WELCOME_PRIMARY_RATIO } from '../constants/landscapeLayout';
import { useImmersiveScreenPadding } from '../hooks/useImmersiveScreenPadding';
import { useLandscapeMetrics } from '../hooks/useLandscapeMetrics';
import { viewShadow } from '../utils/adaptiveStyles';

export default function WelcomeScreen(): React.JSX.Element {
  const { theme, profile } = useTerminal();
  const { width } = useLandscapeMetrics();
  const immersivePadding = useImmersiveScreenPadding();
  const { startBoundRequisition } = useGameFlow();
  const { startNewRun } = useRun();
  const { account } = usePlayerAccount();

  const handleStartScan = () => {
    startNewRun({
      startingVeilResidueBalance: account.veilResidueBalance,
      equippedKeepsakeId: account.equippedKeepsakeId,
      keepsakeDeployment: account.keepsakeDeployment,
    });
    startBoundRequisition();
  };
  const credentials = profile.operative_profile.credentials;
  const vectors = profile.operative_profile.location_vectors;
  const gridCellWidth = Math.max(48, (width - LANDSCAPE_PANEL_PADDING * 2) / 8);

  const identityPane = (
    <ScrollView
      style={styles.identityScroll}
      contentContainerStyle={styles.identityScrollContent}
      showsVerticalScrollIndicator={false}
    >
      <FactionBootLogo theme={theme} />
      <Text style={[styles.welcomeEyebrow, { color: theme.mutedColor }]}>
        SECURE CHANNEL ESTABLISHED
      </Text>
      <Text style={[styles.welcomeTitle, { color: theme.primaryColor }]}>
        Welcome back,{'\n'}
        <Text style={{ color: theme.statusColor }}>{credentials.username}</Text>
      </Text>
      <Text style={[styles.welcomeBody, { color: theme.mutedColor }]}>
        Ley-line sensors are nominal. Your soul anchor is synced to the urban grid.
        Stand by for anomaly sweep authorization.
      </Text>
    </ScrollView>
  );

  const actionPane = (
    <ScrollView
      style={styles.actionScroll}
      contentContainerStyle={styles.actionScrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View
        style={[
          styles.badgeFrame,
          {
            borderColor: theme.primaryColor,
            ...viewShadow({
              color: theme.primaryColor,
              opacity: 0.8,
              radius: 14,
              offset: { width: 0, height: 0 },
            }),
          },
        ]}
      >
        <View style={[styles.badgeInner, { borderColor: theme.borderColor, backgroundColor: '#0a0b0f' }]}>
          <View style={[styles.badgeHeader, { borderBottomColor: theme.borderColor }]}>
            <Text style={[styles.badgeHeaderText, { color: theme.mutedColor }]}>AGENT BADGE</Text>
            <View style={[styles.statusDot, { backgroundColor: '#22c55e' }]} />
          </View>

          <View style={[styles.badgeEmblem, { borderColor: theme.statusColor }]}>
            <Text style={[styles.badgeEmblemText, { color: theme.statusColor }]}>
              {credentials.class.slice(0, 1)}
            </Text>
          </View>

          <Text style={[styles.badgeClass, { color: theme.primaryColor }]}>{credentials.class} OPERATIVE</Text>
          <Text style={[styles.badgeCabal, { color: theme.mutedColor }]}>
            {credentials.cabal_alignment.replace('_', ' ')}
          </Text>
        </View>
      </View>

      <View style={[styles.idReadout, { borderColor: theme.borderColor, backgroundColor: '#0d0f14' }]}>
        <Text style={[styles.idLabel, { color: theme.mutedColor }]}>OPERATIVE ID READOUT</Text>
        <Text style={[styles.idValue, { color: theme.statusColor }]}>{credentials.id}</Text>
        <View style={styles.idMetaRow}>
          <Text style={[styles.idMeta, { color: theme.mutedColor }]}>HANDLE</Text>
          <Text style={[styles.idMetaValue, { color: theme.primaryColor }]}>{credentials.username}</Text>
        </View>
        <View style={styles.idMetaRow}>
          <Text style={[styles.idMeta, { color: theme.mutedColor }]}>SECTOR LOCK</Text>
          <Text style={[styles.idMetaValue, { color: theme.primaryColor }]}>
            {DEFAULT_HOME_SECTOR_PROFILE_LABEL}
          </Text>
        </View>
      </View>

      <HapticPressable
        onPress={handleStartScan}
        style={({ pressed }) => [
          styles.scanButton,
          {
            borderColor: theme.statusColor,
            backgroundColor: pressed ? '#083344' : '#0e1624',
            ...viewShadow({
              color: theme.statusColor,
              opacity: 0.9,
              radius: 16,
              offset: { width: 0, height: 0 },
            }),
          },
        ]}
      >
        <View style={styles.scanButtonGlow} />
        <Text style={[styles.scanButtonLabel, { color: theme.statusColor }]}>INITIATE ANOMALY SCAN</Text>
        <Text style={[styles.scanButtonSub, { color: theme.statusColor }]}>// AUTHORIZE LEY-LINE SWEEP</Text>
      </HapticPressable>
    </ScrollView>
  );

  return (
    <TerminalSafeArea style={immersivePadding}>
      <View style={styles.container}>
        <View style={[styles.gridBackdrop, styles.gridBackdropPointerLock]}>
          {Array.from({ length: 8 }).map((_, row) => (
            <View key={`row-${row}`} style={styles.gridRow}>
              {Array.from({ length: 8 }).map((__, col) => (
                <View
                  key={`cell-${row}-${col}`}
                  style={[
                    styles.gridCell,
                    { width: gridCellWidth, borderColor: `${theme.borderColor}55` },
                  ]}
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

        <LandscapeSplitPane
          style={styles.splitBody}
          primary={identityPane}
          secondary={actionPane}
          primaryRatio={LANDSCAPE_WELCOME_PRIMARY_RATIO}
          primaryStyle={styles.splitPane}
          secondaryStyle={styles.splitPane}
        />
      </View>
    </TerminalSafeArea>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0,
  },
  gridBackdrop: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.35,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridBackdropPointerLock: {
    pointerEvents: 'none',
  },
  gridRow: {
    flexDirection: 'row',
  },
  gridCell: {
    height: 48,
    borderWidth: 0.5,
  },
  headerStrip: {
    borderBottomWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexShrink: 0,
    zIndex: 1,
  },
  headerStripText: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  splitBody: {
    flex: 1,
    minHeight: 0,
    padding: LANDSCAPE_PANEL_PADDING,
    zIndex: 1,
  },
  splitPane: {
    minHeight: 0,
    justifyContent: 'center',
  },
  identityScroll: {
    flex: 1,
    minHeight: 0,
  },
  identityScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingRight: 4,
  },
  actionScroll: {
    flex: 1,
    minHeight: 0,
  },
  actionScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: 16,
    paddingLeft: 4,
  },
  welcomeEyebrow: {
    fontFamily: 'monospace',
    fontSize: 10,
    letterSpacing: 2,
    marginBottom: 8,
    marginTop: 12,
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
  },
  badgeFrame: {
    borderWidth: 2,
    padding: 3,
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
  },
  scanButtonSub: {
    fontFamily: 'monospace',
    fontSize: 9,
    marginTop: 4,
    letterSpacing: 1,
  },
});
