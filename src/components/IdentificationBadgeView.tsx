import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CLASS_DEFINITIONS } from '../data/classes';
import { getFactionDefinition } from '../data/factions';
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
  const cred = profile.operative_profile.credentials;
  const vectors = profile.operative_profile.location_vectors;
  const factionDef = account.alignedFaction ? getFactionDefinition(account.alignedFaction) : null;
  const classDef = CLASS_DEFINITIONS[account.activeClass];

  const borderStyle = {
    borderColor: theme.borderColor,
    borderWidth: theme.borderWidth,
    borderStyle: theme.borderStyle,
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
          RANK {account.operativeRank} // TIER {account.progressionMatrix.maxTierUnlocked}
        </Text>
        <Text style={[styles.metaText, { color: theme.mutedColor }]}>
          {account.cabalCredits} CABAL CR
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
  metaRow: { borderTopWidth: 1, paddingTop: 10, marginTop: 'auto', gap: 4 },
  metaText: { fontFamily: 'monospace', fontSize: 8, letterSpacing: 0.5 },
});
