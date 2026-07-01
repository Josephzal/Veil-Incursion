import React from 'react';
import { StyleSheet, View } from 'react-native';
import TerminalText from './TerminalText';
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
  fontScale?: number;
  centered?: boolean;
  landscape?: boolean;
  compact?: boolean;
}

export default function ClassAbilityRoster({
  account,
  theme,
  accentColor,
  fontScale = 1,
  centered = false,
  landscape = false,
  compact = false,
}: ClassAbilityRosterProps): React.JSX.Element {
  const snapshot = getActiveClassSnapshot(account);
  const classId = snapshot.classId as ClassType;
  const headerColor = accentColor ?? theme.statusColor;
  const dimColor = hubKeyColor(theme.mutedColor);
  const tight = compact && !centered && !landscape;

  const headerSize = landscape
    ? Math.max(8, 9 * fontScale)
    : centered
      ? Math.max(9, 10 * fontScale)
      : tight ? 9 : 11;
  const lineSize = landscape
    ? Math.max(8, 9 * fontScale)
    : centered
      ? Math.max(10, 11 * fontScale)
      : tight ? 8 : 9;
  const lineHeight = landscape
    ? Math.max(11, 12 * fontScale)
    : centered
      ? Math.max(14, 16 * fontScale)
      : tight ? 11 : 13;

  return (
    <View style={[
      styles.root,
      centered ? styles.rootCentered : null,
      landscape ? styles.rootLandscape : null,
      tight ? styles.rootCompact : null,
    ]}>
      <TerminalText
        size={headerSize}
        letterSpacing={1.1}
        style={[styles.header, centered ? styles.headerCentered : null, { color: headerColor }]}
      >
        {formatBracketHeader('LOADOUT MANIFEST')}
      </TerminalText>
      <View style={[
        styles.list,
        centered ? styles.listCentered : null,
        landscape ? styles.listLandscape : null,
      ]}>
        {snapshot.loadout.map((abilityId, index) => {
          const unlocked = (snapshot.unlocked as readonly string[]).includes(abilityId);
          return (
            <TerminalText
              key={`${abilityId}-${index}`}
              size={lineSize}
              lineHeight={lineHeight}
              letterSpacing={0.35}
              style={[
                styles.line,
                centered ? styles.lineCentered : null,
                landscape ? styles.lineLandscape : null,
                { color: unlocked ? theme.statusColor : dimColor },
              ]}
              numberOfLines={landscape ? 1 : undefined}
            >
              {`${index + 1}. ${formatAbilityLabel(classId, abilityId)}`}
            </TerminalText>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 8, width: '100%' },
  rootCentered: { alignItems: 'center' },
  rootLandscape: { gap: 4 },
  rootCompact: { gap: 3 },
  header: {
    fontWeight: '800',
  },
  headerCentered: {
    textAlign: 'center',
  },
  list: { gap: 6, paddingLeft: 2, width: '100%' },
  listCentered: {
    paddingLeft: 0,
    alignItems: 'center',
    gap: 8,
  },
  listLandscape: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    rowGap: 2,
    paddingLeft: 0,
  },
  line: {
    fontWeight: '700',
  },
  lineCentered: {
    textAlign: 'center',
  },
  lineLandscape: {
    width: '48%',
    flexGrow: 1,
  },
});
