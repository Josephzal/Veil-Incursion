import React from 'react';
import { StyleSheet, View } from 'react-native';
import TerminalText from './TerminalText';
import type { ClassType } from '../types/game';
import { formatAbilityLabel, getActiveClassSnapshot } from '../data/classLoadoutEngine';
import type { PlayerAccount } from '../types/game';
import type { TerminalTheme } from '../types/theme';
import { formatBracketHeader } from '../styles/hubTerminalUi';
import { hubKeyColor } from '../constants/hubAtmosphere';
import { useResponsiveScale } from '../hooks/useResponsiveScale';

interface ClassAbilityRosterProps {
  account: PlayerAccount;
  theme: TerminalTheme;
  accentColor?: string;
  /** Tighter typography for the deployment deck desktop layout. */
  compact?: boolean;
}

export default function ClassAbilityRoster({
  account,
  theme,
  accentColor,
  compact = false,
}: ClassAbilityRosterProps): React.JSX.Element {
  const snapshot = getActiveClassSnapshot(account);
  const classId = snapshot.classId as ClassType;
  const headerColor = accentColor ?? theme.statusColor;
  const dimColor = hubKeyColor(theme.mutedColor);
  const { isDesktop } = useResponsiveScale();
  const tight = compact && isDesktop;
  const headerSize = tight ? 9 : isDesktop ? 11 : 9;
  const lineSize = tight ? 8 : isDesktop ? 9 : 8;
  const lineHeight = tight ? 11 : isDesktop ? 13 : 11;

  return (
    <View style={[styles.root, tight ? styles.rootCompact : null]}>
      <TerminalText size={headerSize} letterSpacing={1.1} style={[styles.header, { color: headerColor }]}>
        {formatBracketHeader(`LOADOUT MANIFEST // ${classId}`)}
      </TerminalText>
      <View style={styles.list}>
        {snapshot.loadout.map((abilityId, index) => {
          const unlocked = (snapshot.unlocked as readonly string[]).includes(abilityId);
          return (
            <TerminalText
              key={`${abilityId}-${index}`}
              size={lineSize}
              lineHeight={lineHeight}
              letterSpacing={0.4}
              style={[
                styles.line,
                { color: unlocked ? theme.statusColor : dimColor },
              ]}
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
  root: { gap: 5 },
  rootCompact: { gap: 3 },
  header: {
    fontWeight: '800',
  },
  list: { gap: 3, paddingLeft: 2 },
  line: {
    fontWeight: '700',
  },
});
