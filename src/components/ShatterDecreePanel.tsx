import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useShatterCountdown } from '../hooks/useShatterCountdown';
import { FactionType } from '../types/game';
import { MacroSectorId } from '../types/regional';
import { TerminalTheme } from '../types/theme';

interface ShatterDecreePanelProps {
  theme: TerminalTheme;
  activeSectorId: MacroSectorId;
  shatterFlashFaction: FactionType | null;
  onForceDecree: () => void;
}

export default function ShatterDecreePanel({
  theme,
  activeSectorId,
  shatterFlashFaction,
  onForceDecree,
}: ShatterDecreePanelProps): React.JSX.Element {
  const countdown = useShatterCountdown();
  const flashTheme = shatterFlashFaction != null;

  return (
    <View
      style={[
        styles.panel,
        {
          borderColor: flashTheme ? theme.primaryColor : theme.borderColor,
          borderWidth: flashTheme ? theme.borderWidth + 1 : theme.borderWidth,
          borderStyle: theme.borderStyle,
          backgroundColor: flashTheme ? `${theme.primaryColor}12` : 'transparent',
        },
      ]}
    >
      <Text style={[styles.title, { color: theme.primaryColor }]}>THE SHATTER EVENT // CLIMAX CALCULATOR</Text>
      <Text style={[styles.sub, { color: theme.mutedColor }]}>{countdown.targetLabel}</Text>
      <Text style={[styles.countdown, { color: theme.statusColor }]}>{countdown.remainingLabel}</Text>

      {shatterFlashFaction && (
        <View style={[styles.victoryFlash, { borderColor: theme.statusColor }]}>
          <Text style={[styles.victoryText, { color: theme.primaryColor }]}>
            {`>> ${shatterFlashFaction.replace('_', ' ')} DOMINION CONFIRMED — ${activeSectorId}`}
          </Text>
        </View>
      )}

      <Pressable
        onPress={onForceDecree}
        style={({ pressed }) => [
          styles.decreeBtn,
          {
            borderColor: theme.primaryColor,
            opacity: pressed ? 0.75 : 1,
            backgroundColor: pressed ? `${theme.primaryColor}22` : '#0a0b0f',
          },
        ]}
      >
        <Text style={[styles.decreeBtnText, { color: theme.primaryColor }]}>
          [ FORCE REGIONAL SHATTER DECREE ]
        </Text>
      </Pressable>
      <Text style={[styles.adminNote, { color: theme.mutedColor }]}>
        ADMIN OVERRIDE — FREEZES INFLUENCE ARRAYS AND EVALUATES SECTOR VICTOR
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { padding: 12, marginBottom: 12, minHeight: 140 },
  title: { fontFamily: 'monospace', fontSize: 9, fontWeight: '700', letterSpacing: 1, marginBottom: 6 },
  sub: { fontFamily: 'monospace', fontSize: 8, letterSpacing: 0.5, marginBottom: 4 },
  countdown: { fontFamily: 'monospace', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 10 },
  victoryFlash: { borderWidth: 1, padding: 8, marginBottom: 10, minHeight: 36 },
  victoryText: { fontFamily: 'monospace', fontSize: 8, fontWeight: '700', letterSpacing: 0.5, lineHeight: 12 },
  decreeBtn: { borderWidth: 2, paddingVertical: 12, alignItems: 'center', marginBottom: 6 },
  decreeBtnText: { fontFamily: 'monospace', fontSize: 9, fontWeight: '700', letterSpacing: 0.8, textAlign: 'center' },
  adminNote: { fontFamily: 'monospace', fontSize: 7, letterSpacing: 0.4, textAlign: 'center', lineHeight: 11 },
});
