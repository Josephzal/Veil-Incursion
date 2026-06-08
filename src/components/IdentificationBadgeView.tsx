import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CLASS_DEFINITIONS } from '../data/classes';
import { getFactionDefinition } from '../data/factions';
import { useGameFlow } from '../context/GameFlowContext';
import { useRun } from '../context/RunContext';
import { PlayerAccount } from '../types/game';
import { OperativeProfile } from '../types/profile';
import { TerminalTheme } from '../types/theme';

interface IdentificationBadgeViewProps {
  theme: TerminalTheme;
  profile: OperativeProfile;
  account: PlayerAccount;
}

export default function IdentificationBadgeView({
  theme,
  profile,
  account,
}: IdentificationBadgeViewProps): React.JSX.Element {
  const { startCombat } = useGameFlow();
  const { startBadgeTestCombat } = useRun();

  const cred = profile.operative_profile.credentials;
  const vectors = profile.operative_profile.location_vectors;
  const factionDef = account.alignedFaction ? getFactionDefinition(account.alignedFaction) : null;
  const classDef = CLASS_DEFINITIONS[account.activeClass];

  const borderStyle = {
    borderColor: theme.borderColor,
    borderWidth: theme.borderWidth,
    borderStyle: theme.borderStyle,
  };

  const launchTestCombat = (preset: 'easy' | 'hard') => {
    startBadgeTestCombat(preset);
    startCombat();
  };

  return (
    <View style={[styles.root, borderStyle, { backgroundColor: '#050608' }]}>
      <Text style={[styles.header, { color: theme.primaryColor }]}>IDENTIFICATION BADGE // OPERATIVE</Text>

      <View style={[styles.badgeFrame, { borderColor: theme.statusColor }]}>
        <Text style={[styles.emblem, { color: theme.statusColor }]}>{cred.class.slice(0, 1)}</Text>
        <Text style={[styles.username, { color: theme.textColor }]}>{cred.username}</Text>
        <Text style={[styles.subline, { color: theme.mutedColor }]}>
          {classDef.displayName} // ID {cred.id}
        </Text>
      </View>

      <View style={styles.fieldBlock}>
        <Text style={[styles.fieldLabel, { color: theme.mutedColor }]}>CABAL ALIGNMENT</Text>
        <Text style={[styles.fieldValue, { color: theme.primaryColor }]}>
          {factionDef?.displayName ?? cred.cabal_alignment.replace('_', ' ')}
        </Text>
      </View>

      <View style={styles.fieldBlock}>
        <Text style={[styles.fieldLabel, { color: theme.mutedColor }]}>TRACKING FREQUENCY</Text>
        <Text style={[styles.fieldValue, { color: theme.statusColor }]}>{vectors.active_frequency}</Text>
      </View>

      <View style={styles.fieldBlock}>
        <Text style={[styles.fieldLabel, { color: theme.mutedColor }]}>NODE LOCK</Text>
        <Text style={[styles.fieldValue, { color: theme.textColor }]}>{vectors.current_node_lock}</Text>
      </View>

      <View style={styles.fieldBlock}>
        <Text style={[styles.fieldLabel, { color: theme.mutedColor }]}>HOME SECTOR</Text>
        <Text style={[styles.fieldValue, { color: theme.textColor }]}>{vectors.home_sector}</Text>
      </View>

      <View style={[styles.metaRow, { borderTopColor: theme.borderColor }]}>
        <Text style={[styles.metaText, { color: theme.mutedColor }]}>
          RANK {account.operativeRank} // DEPTH {account.progressionMatrix.maxDepthUnlocked}
        </Text>
        <Text style={[styles.metaText, { color: theme.mutedColor }]}>
          {account.cabalCredits} CABAL CR
        </Text>
      </View>

      <View style={[styles.testCombatSection, { borderTopColor: theme.borderColor }]}>
        <Text style={[styles.testCombatLabel, { color: theme.mutedColor }]}>
          TEST COMBAT // BADGE ARENA
        </Text>
        <View style={styles.testCombatRow}>
          <Pressable
            onPress={() => launchTestCombat('easy')}
            style={[styles.testCombatBtn, { borderColor: theme.primaryColor }]}
          >
            <Text style={[styles.testCombatBtnText, { color: theme.primaryColor }]}>
              [ EASY COMBAT ]
            </Text>
          </Pressable>
          <Pressable
            onPress={() => launchTestCombat('hard')}
            style={[styles.testCombatBtn, { borderColor: theme.statusColor }]}
          >
            <Text style={[styles.testCombatBtnText, { color: theme.statusColor }]}>
              [ HARD COMBAT ]
            </Text>
          </Pressable>
        </View>
        <Text style={[styles.testCombatHint, { color: theme.mutedColor }]}>
          Returns here after victory or defeat.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 14, minHeight: 320 },
  header: { fontFamily: 'monospace', fontSize: 9, fontWeight: '700', letterSpacing: 1.2, marginBottom: 12 },
  badgeFrame: { borderWidth: 2, padding: 16, alignItems: 'center', marginBottom: 16 },
  emblem: { fontFamily: 'monospace', fontSize: 32, fontWeight: '700', marginBottom: 6 },
  username: { fontFamily: 'monospace', fontSize: 16, fontWeight: '700', letterSpacing: 1 },
  subline: { fontFamily: 'monospace', fontSize: 9, marginTop: 4, letterSpacing: 0.5 },
  fieldBlock: { marginBottom: 12 },
  fieldLabel: { fontFamily: 'monospace', fontSize: 7, letterSpacing: 1.2, marginBottom: 3 },
  fieldValue: { fontFamily: 'monospace', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  metaRow: { borderTopWidth: 1, paddingTop: 10, marginTop: 8, gap: 4 },
  metaText: { fontFamily: 'monospace', fontSize: 8, letterSpacing: 0.5 },
  testCombatSection: {
    borderTopWidth: 1,
    paddingTop: 12,
    marginTop: 12,
    gap: 8,
  },
  testCombatLabel: {
    fontFamily: 'monospace',
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  testCombatRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  testCombatBtn: {
    flex: 1,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testCombatBtnText: {
    fontFamily: 'monospace',
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  testCombatHint: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.4,
    lineHeight: 10,
  },
});
