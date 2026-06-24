import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ClassType } from '../types/game';
import { formatAbilityLabel, getActiveClassSnapshot } from '../data/classLoadoutEngine';
import type { PlayerAccount } from '../types/game';
import type { TerminalTheme } from '../types/theme';

interface ClassAbilityRosterProps {
  account: PlayerAccount;
  theme: TerminalTheme;
}

export default function ClassAbilityRoster({
  account,
  theme,
}: ClassAbilityRosterProps): React.JSX.Element {
  const snapshot = getActiveClassSnapshot(account);
  const classId = snapshot.classId as ClassType;

  return (
    <View style={styles.root}>
      <Text style={[styles.header, { color: theme.mutedColor }]}>
        {`LOADOUT MANIFEST // ${classId}`}
      </Text>
      <View style={styles.list}>
        {snapshot.loadout.map((abilityId, index) => {
          const unlocked = (snapshot.unlocked as readonly string[]).includes(abilityId);
          return (
            <Text
              key={`${abilityId}-${index}`}
              style={[
                styles.line,
                { color: unlocked ? theme.primaryColor : theme.mutedColor },
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
  root: { gap: 4 },
  header: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.8,
  },
  list: { gap: 2 },
  line: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.3,
    lineHeight: 9,
  },
  note: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.4,
    lineHeight: 11,
    marginTop: 2,
  },
});
