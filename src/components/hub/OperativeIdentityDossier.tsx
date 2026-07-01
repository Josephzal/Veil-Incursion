import React, { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import HapticPressable from '../HapticPressable';
import TerminalText from '../TerminalText';
import { CLASS_DEFINITIONS } from '../../data/classes';
import { hubKeyColor } from '../../constants/hubAtmosphere';
import { usePlayerAccount } from '../../context/PlayerAccountContext';
import ClassAbilityRoster from '../ClassAbilityRoster';
import { PlayerAccount } from '../../types/game';
import { OperativeProfile } from '../../types/profile';
import { TerminalTheme } from '../../types/theme';
import { resolvePlayerBadgePortrait } from '../../utils/combatPlayerPortrait';
import { useHubLayout } from '../../context/HubLayoutContext';

interface OperativeIdentityDossierProps {
  theme: TerminalTheme;
  profile: OperativeProfile;
  account: PlayerAccount;
}

const EMBLEM_SIZE = 112;
const SLATE_MUTED = '#94a3b8';
const SLATE_BORDER = '#475569';
const DIVIDER_COLOR = '#334155';

/** Landscape operative ID badge — emblem lane + credentials / loadout. */
export default function OperativeIdentityDossier({
  theme,
  profile,
  account,
}: OperativeIdentityDossierProps): React.JSX.Element {
  const { cycleActiveClass } = usePlayerAccount();
  const { scaleSize, scaleSpacing, fontScale } = useHubLayout();

  const cred = profile.operative_profile.credentials;
  const classDef = CLASS_DEFINITIONS[account.activeClass];
  const keyColor = hubKeyColor(theme.mutedColor);
  const portraitSource = useMemo(
    () => resolvePlayerBadgePortrait(account.activeClass),
    [account.activeClass],
  );
  const canCycleClass = account.unlockedClasses.length > 1;

  const emblemSize = scaleSize(EMBLEM_SIZE);
  const arrowWidth = scaleSize(20);
  const laneGap = scaleSpacing(16);
  const nameSize = Math.max(14, 17 * fontScale);
  const metaSize = Math.max(9, 10 * fontScale);
  const metaLineHeight = Math.max(12, 14 * fontScale);

  const handleCycleClass = (direction: 1 | -1) => {
    if (!canCycleClass) return;
    cycleActiveClass(direction);
  };

  const weaponRankLine = `${classDef.weaponLine} | RANK ${account.operativeRank}`;

  return (
    <View style={[styles.root, { gap: laneGap }]}>
      <View style={[styles.emblemLane, { width: emblemSize + (canCycleClass ? arrowWidth * 2 + 8 : 0) }]}>
        <View style={[styles.emblemRow, { height: emblemSize }]}>
          {canCycleClass ? (
            <HapticPressable
              onPress={() => handleCycleClass(-1)}
              style={({ pressed }) => [
                styles.classArrow,
                {
                  width: arrowWidth,
                  height: emblemSize,
                  opacity: pressed ? 0.55 : 1,
                },
              ]}
            >
              <TerminalText size={Math.max(11, 12 * fontScale)} style={[styles.classArrowLabel, { color: keyColor }]}>
                {'<'}
              </TerminalText>
            </HapticPressable>
          ) : null}

          <View
            style={[
              styles.emblemFrame,
              {
                width: emblemSize,
                height: emblemSize,
                borderColor: SLATE_BORDER,
              },
            ]}
          >
            <Image source={portraitSource} style={styles.emblemImage} resizeMode="contain" />
          </View>

          {canCycleClass ? (
            <HapticPressable
              onPress={() => handleCycleClass(1)}
              style={({ pressed }) => [
                styles.classArrow,
                {
                  width: arrowWidth,
                  height: emblemSize,
                  opacity: pressed ? 0.55 : 1,
                },
              ]}
            >
              <TerminalText size={Math.max(11, 12 * fontScale)} style={[styles.classArrowLabel, { color: keyColor }]}>
                {'>'}
              </TerminalText>
            </HapticPressable>
          ) : null}
        </View>
      </View>

      <View style={[styles.verticalDivider, { backgroundColor: DIVIDER_COLOR }]} />

      <View style={[styles.dataLane, { gap: scaleSpacing(10) }]}>
        <View style={[styles.credentials, { gap: scaleSpacing(4) }]}>
          <Text
            style={[styles.operativeName, { fontSize: nameSize, lineHeight: nameSize * 1.15 }]}
            numberOfLines={1}
          >
            {cred.username}
          </Text>
          <TerminalText
            size={metaSize}
            lineHeight={metaLineHeight}
            letterSpacing={0.5}
            style={[styles.metaLine, { color: SLATE_MUTED }]}
            numberOfLines={1}
          >
            {`${classDef.displayName.toUpperCase()} // ID ${cred.id}`}
          </TerminalText>
          <TerminalText
            size={metaSize}
            lineHeight={metaLineHeight}
            letterSpacing={0.35}
            style={[styles.metaLine, { color: theme.statusColor }]}
            numberOfLines={2}
          >
            {weaponRankLine}
          </TerminalText>
        </View>

        <View style={[styles.horizontalRule, { backgroundColor: DIVIDER_COLOR }]} />

        <ClassAbilityRoster
          account={account}
          theme={theme}
          accentColor={theme.statusColor}
          fontScale={fontScale}
          landscape
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  emblemLane: {
    flexShrink: 0,
    justifyContent: 'center',
  },
  emblemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  classArrow: {
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
  },
  classArrowLabel: {
    fontWeight: '700',
  },
  emblemFrame: {
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    flexShrink: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
  },
  emblemImage: {
    width: '100%',
    height: '100%',
  },
  verticalDivider: {
    width: 1,
    alignSelf: 'stretch',
    flexShrink: 0,
  },
  dataLane: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  credentials: {
    width: '100%',
  },
  operativeName: {
    fontFamily: 'monospace',
    fontWeight: '800',
    color: '#f8fafc',
    letterSpacing: 0.5,
  },
  metaLine: {
    fontWeight: '700',
  },
  horizontalRule: {
    width: '100%',
    height: 1,
  },
});
