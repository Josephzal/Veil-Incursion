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
  /** Tighter emblem + typography for embedding inside modals. */
  compact?: boolean;
  /** Minimal hub strip — smallest portrait and credentials row. */
  mini?: boolean;
  /** Hide the four-slot ability manifest (loadout tab has its own editor). */
  hideManifest?: boolean;
}

const EMBLEM_SIZE = 112;
const COMPACT_EMBLEM_SIZE = 52;
const MINI_EMBLEM_SIZE = 40;
const SLATE_MUTED = '#94a3b8';
const SLATE_BORDER = '#475569';
const DIVIDER_COLOR = '#334155';

/** Landscape operative ID badge — emblem lane + credentials / loadout. */
export default function OperativeIdentityDossier({
  theme,
  profile,
  account,
  compact = false,
  mini = false,
  hideManifest = false,
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

  const tight = compact || mini;
  const emblemSize = scaleSize(mini ? MINI_EMBLEM_SIZE : compact ? COMPACT_EMBLEM_SIZE : EMBLEM_SIZE);
  const arrowWidth = scaleSize(mini ? 11 : compact ? 14 : 20);
  const laneGap = scaleSpacing(mini ? 8 : compact ? 10 : 16);
  const nameSize = mini
    ? Math.max(10, 10.5 * fontScale)
    : compact
      ? Math.max(11, 12 * fontScale)
      : Math.max(14, 17 * fontScale);
  const metaSize = mini
    ? Math.max(6.5, 7 * fontScale)
    : compact
      ? Math.max(7, 7.5 * fontScale)
      : Math.max(9, 10 * fontScale);
  const metaLineHeight = mini
    ? Math.max(8, 9 * fontScale)
    : compact
      ? Math.max(9, 10 * fontScale)
      : Math.max(12, 14 * fontScale);
  const compactFontScale = tight ? fontScale * (mini ? 0.75 : 0.82) : fontScale;
  const arrowLabelSize = mini ? Math.max(8, 8.5 * fontScale) : Math.max(9, 10 * fontScale);

  const handleCycleClass = (direction: 1 | -1) => {
    if (!canCycleClass) return;
    cycleActiveClass(direction);
  };

  const emblemBlock = (
    <View style={[styles.emblemLane, { width: emblemSize + (canCycleClass ? arrowWidth * 2 + 6 : 0) }]}>
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
            <TerminalText size={arrowLabelSize} style={[styles.classArrowLabel, { color: keyColor }]}>
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
            <TerminalText size={arrowLabelSize} style={[styles.classArrowLabel, { color: keyColor }]}>
              {'>'}
            </TerminalText>
          </HapticPressable>
        ) : null}
      </View>
    </View>
  );

  const credentialsBlock = (
    <View style={[styles.credentials, { gap: scaleSpacing(mini ? 1 : compact ? 2 : 4), flex: 1, minWidth: 0 }]}>
      <Text
        style={[styles.operativeName, { fontSize: nameSize, lineHeight: nameSize * 1.15 }]}
        numberOfLines={1}
      >
        {cred.username}
      </Text>
      <TerminalText
        size={metaSize}
        lineHeight={metaLineHeight}
        letterSpacing={0.4}
        style={[styles.metaLine, { color: SLATE_MUTED }]}
        numberOfLines={1}
      >
        {mini
          ? `${classDef.displayName.toUpperCase()} // RANK ${account.operativeRank}`
          : `${classDef.displayName.toUpperCase()} // ID ${cred.id}`}
      </TerminalText>
      {!mini ? (
        <>
          <TerminalText
            size={metaSize}
            lineHeight={metaLineHeight}
            letterSpacing={0.3}
            style={[styles.metaLine, { color: theme.statusColor }]}
            numberOfLines={1}
          >
            {classDef.weaponLine}
          </TerminalText>
          <TerminalText
            size={metaSize}
            lineHeight={metaLineHeight}
            letterSpacing={0.3}
            style={[styles.metaLine, { color: SLATE_MUTED }]}
            numberOfLines={1}
          >
            {`RANK ${account.operativeRank}`}
          </TerminalText>
        </>
      ) : (
        <TerminalText
          size={metaSize}
          lineHeight={metaLineHeight}
          letterSpacing={0.3}
          style={[styles.metaLine, { color: theme.statusColor }]}
          numberOfLines={1}
        >
          {classDef.weaponLine}
        </TerminalText>
      )}
    </View>
  );

  const loadoutBlock = hideManifest ? null : (
    <ClassAbilityRoster
      account={account}
      theme={theme}
      accentColor={theme.statusColor}
      fontScale={compactFontScale}
      compact={tight}
    />
  );

  if (mini || compact) {
    return (
      <View style={[styles.compactRoot, { gap: scaleSpacing(mini ? 4 : 8) }]}>
        <View style={[styles.compactIdentityRow, { gap: laneGap }]}>
          {emblemBlock}
          {credentialsBlock}
        </View>
        {loadoutBlock ? (
          <>
            <View style={[styles.horizontalRule, { backgroundColor: DIVIDER_COLOR }]} />
            {loadoutBlock}
          </>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.root, { gap: laneGap }]}>
      {emblemBlock}
      <View style={[styles.verticalDivider, { backgroundColor: DIVIDER_COLOR }]} />
      <View style={[styles.dataLane, { gap: scaleSpacing(10) }]}>
        {credentialsBlock}
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
  compactRoot: {
    width: '100%',
  },
  compactIdentityRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
