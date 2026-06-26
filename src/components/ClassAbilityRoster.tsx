import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ClassType } from '../types/game';
import { formatAbilityLabel, getActiveClassSnapshot } from '../data/classLoadoutEngine';
import type { PlayerAccount } from '../types/game';
import type { TerminalTheme } from '../types/theme';
import { formatBracketHeader } from '../styles/hubTerminalUi';
import { hubKeyColor } from '../constants/hubAtmosphere';

interface ClassAbilityRosterProps {
  account: PlayerAccount;
  theme: TerminalTheme;
  accentColor?: string;
}

export default function ClassAbilityRoster({
  account,
  theme,
  accentColor,
}: ClassAbilityRosterProps): React.JSX.Element {
  const snapshot = getActiveClassSnapshot(account);
  const classId = snapshot.classId as ClassType;
  const headerColor = accentColor ?? theme.statusColor;
  const dimColor = hubKeyColor(theme.mutedColor);

  return (
    <View style={styles.root}>
      <Text style={[styles.header, { color: headerColor }]}>
        {formatBracketHeader(`LOADOUT MANIFEST // ${classId}`)}
      </Text>
      <View style={styles.list}>
        {snapshot.loadout.map((abilityId, index) => {
          const unlocked = (snapshot.unlocked as readonly string[]).includes(abilityId);
          return (
            <Text
              key={`${abilityId}-${index}`}
              style={[
                styles.line,
                { color: unlocked ? theme.statusColor : dimColor },
              ]}
            >
              {`${index + 1}. ${formatAbilityLabel(classId, abilityId)}`}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 5 },
  header: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  list: { gap: 3, paddingLeft: 2 },
  line: {
    fontFamily: 'monospace',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.4,
    lineHeight: 11,
  },
});
