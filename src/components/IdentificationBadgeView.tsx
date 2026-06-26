import React, { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import HapticPressable from './HapticPressable';
import { CLASS_DEFINITIONS } from '../data/classes';
import { getFactionDefinition } from '../data/factions';
import { getMacroSector } from '../data/macroSectors';
import { LANDSCAPE_PANEL_PADDING } from '../constants/landscapeLayout';
import { useGameFlow } from '../context/GameFlowContext';
import { useRun } from '../context/RunContext';
import { usePlayerAccount } from '../context/PlayerAccountContext';
import LandscapeSplitPane from './layout/LandscapeSplitPane';
import ClassAbilityRoster from './ClassAbilityRoster';
import { PlayerAccount } from '../types/game';
import { OperativeProfile } from '../types/profile';
import { TerminalTheme } from '../types/theme';
import { formatHomeSectorDisplay } from '../constants/homeSector';
import { formatSnakeCaseToTitleCase } from '../utils/formatDisplayName';
import { resolvePlayerBadgePortrait } from '../utils/combatPlayerPortrait';
import {
  formatBracketHeader,
  getInteractiveButtonStyle,
  getInteractiveButtonTextStyle,
  hubTerminalUi,
} from '../styles/hubTerminalUi';
import { useLandscapeMetrics } from '../hooks/useLandscapeMetrics';

interface IdentificationBadgeViewProps {
  theme: TerminalTheme;
  profile: OperativeProfile;
  account: PlayerAccount;
}

const BARCODE_HEIGHTS = [12, 18, 8, 22, 12, 18, 8, 16, 14, 20, 8, 14];
const SECURITY_MATRIX = [
  1, 0, 1, 1,
  0, 1, 0, 1,
  1, 1, 0, 0,
  0, 1, 1, 1,
];

function SecurityMatrix(): React.JSX.Element {
  return (
    <View style={styles.securityMatrix}>
      {SECURITY_MATRIX.map((on, index) => (
        <View
          key={index}
          style={[styles.securityCell, on ? styles.securityCellOn : styles.securityCellOff]}
        />
      ))}
    </View>
  );
}

function BarcodeStrip({ color }: { color: string }): React.JSX.Element {
  return (
    <View style={styles.barcodeRow}>
      {BARCODE_HEIGHTS.map((height, index) => (
        <View
          key={index}
          style={[styles.barcodeBar, { height, backgroundColor: color }]}
        />
      ))}
    </View>
  );
}

function DataField({
  title,
  value,
  valueColor,
  mutedColor,
}: {
  title: string;
  value: string;
  valueColor: string;
  mutedColor: string;
}) {
  return (
    <View style={styles.dataField}>
      <Text style={[hubTerminalUi.sectionHeader, { color: mutedColor }]}>
        {formatBracketHeader(title)}
      </Text>
      <Text style={[styles.fieldValue, { color: valueColor }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

export default function IdentificationBadgeView({
  theme,
  profile,
  account,
}: IdentificationBadgeViewProps): React.JSX.Element {
  const { cycleActiveClass } = usePlayerAccount();
  const { startCombat } = useGameFlow();
  const { startBadgeTestCombat } = useRun();
  const { useHorizontalSplit } = useLandscapeMetrics();

  const cred = profile.operative_profile.credentials;
  const vectors = profile.operative_profile.location_vectors;
  const factionDef = account.alignedFaction ? getFactionDefinition(account.alignedFaction) : null;
  const classDef = CLASS_DEFINITIONS[account.activeClass];
  const homeSector = getMacroSector(account.regionalPresence.homeMacroSector);
  const factionColor = factionDef?.accentColor ?? theme.primaryColor;
  const accentFill = `${theme.primaryColor}26`;
  const portraitSource = useMemo(
    () => resolvePlayerBadgePortrait(account.activeClass),
    [account.activeClass],
  );
  const canCycleClass = account.unlockedClasses.length > 1;

  const handleCycleClass = (direction: 1 | -1) => {
    if (!canCycleClass) return;
    cycleActiveClass(direction);
  };

  const launchTestCombat = (preset: 'easy' | 'hard') => {
    startBadgeTestCombat(preset, {
      activeClass: account.activeClass,
      aegisLoadout: account.aegisLoadout,
      hexShotLoadout: account.hexShotLoadout,
      envoyLoadout: account.envoyLoadout,
    });
    startCombat();
  };

  const identityColumn = (
    <View style={styles.identityColumn}>
      <View style={styles.badgeCard}>
        <View style={styles.identityRow}>
          <View style={styles.portraitColumn}>
            {canCycleClass ? (
              <HapticPressable
                onPress={() => handleCycleClass(-1)}
                style={({ pressed }) => [
                  styles.classArrow,
                  { borderColor: theme.borderColor, opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <Text style={[styles.classArrowLabel, { color: theme.mutedColor }]}>{'<'}</Text>
              </HapticPressable>
            ) : null}
            <View style={[styles.avatarBlock, { backgroundColor: accentFill }]}>
              <Image source={portraitSource} style={styles.avatarImage} resizeMode="contain" />
            </View>
            {canCycleClass ? (
              <HapticPressable
                onPress={() => handleCycleClass(1)}
                style={({ pressed }) => [
                  styles.classArrow,
                  { borderColor: theme.borderColor, opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <Text style={[styles.classArrowLabel, { color: theme.mutedColor }]}>{'>'}</Text>
              </HapticPressable>
            ) : null}
          </View>

          <View style={styles.identityDetails}>
            <Text style={styles.operativeName} numberOfLines={1}>{cred.username}</Text>
            <Text style={[styles.subline, { color: theme.mutedColor }]} numberOfLines={1}>
              {`${classDef.displayName.toUpperCase()} // ID ${cred.id}`}
            </Text>
            <Text style={[styles.rankLine, { color: theme.mutedColor }]} numberOfLines={1}>
              {classDef.protocolLabel}
            </Text>
            <Text style={[styles.rankLine, { color: theme.mutedColor }]} numberOfLines={1}>
              {`${classDef.weaponLine} // ${classDef.interactionLine}`}
            </Text>
            <Text style={[styles.rankLine, { color: theme.mutedColor }]}>
              {`RANK ${account.operativeRank} // DEPTH ${account.progressionMatrix.maxDepthUnlocked}`}
            </Text>
          </View>
        </View>

        <View style={styles.securityFooter}>
          <BarcodeStrip color={`${theme.mutedColor}88`} />
          <SecurityMatrix />
        </View>
      </View>

      <View style={styles.loadoutBlock}>
        <ClassAbilityRoster account={account} theme={theme} />
      </View>

      <View style={styles.testArenaBlock}>
        <Text style={[hubTerminalUi.sectionHeader, { color: theme.mutedColor }]}>
          {formatBracketHeader('TRAINING ARENA // BADGE COMBAT')}
        </Text>
        <Text style={[styles.testArenaHint, { color: theme.mutedColor }]}>
          {`Deploy ${classDef.displayName.toUpperCase()} loadout against an isolated hostile.`}
        </Text>
        <View style={styles.testArenaRow}>
          <HapticPressable
            onPress={() => launchTestCombat('easy')}
            style={({ pressed }) => [
              getInteractiveButtonStyle(theme.primaryColor, { pressed, size: 'sm' }),
              styles.testArenaBtn,
            ]}
          >
            <Text style={[getInteractiveButtonTextStyle('sm'), { color: theme.primaryColor }]}>
              [ EASY COMBAT ]
            </Text>
          </HapticPressable>
          <HapticPressable
            onPress={() => launchTestCombat('hard')}
            style={({ pressed }) => [
              getInteractiveButtonStyle(theme.statusColor, { pressed, size: 'sm' }),
              styles.testArenaBtn,
            ]}
          >
            <Text style={[getInteractiveButtonTextStyle('sm'), { color: theme.statusColor }]}>
              [ HARD COMBAT ]
            </Text>
          </HapticPressable>
        </View>
      </View>
    </View>
  );

  const telemetryColumn = (
    <View style={styles.telemetryColumn}>
      <DataField
        title="CABAL ALIGNMENT"
        value={factionDef?.displayName ?? formatSnakeCaseToTitleCase(cred.cabal_alignment)}
        valueColor={factionColor}
        mutedColor={theme.mutedColor}
      />
      <DataField
        title="TRACKING FREQUENCY"
        value={vectors.active_frequency}
        valueColor={theme.statusColor}
        mutedColor={theme.mutedColor}
      />
      <DataField
        title="NODE LOCK"
        value={formatSnakeCaseToTitleCase(vectors.current_node_lock)}
        valueColor={theme.textColor}
        mutedColor={theme.mutedColor}
      />
      <DataField
        title="HOME SECTOR"
        value={formatHomeSectorDisplay(homeSector.id, homeSector.label)}
        valueColor={theme.textColor}
        mutedColor={theme.mutedColor}
      />
      <View style={styles.dataField}>
        <Text style={[styles.metaText, { color: theme.mutedColor }]}>
          {`${account.cabalCredits} CABAL CR // CLEARANCE ACTIVE`}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      <Text style={[hubTerminalUi.sectionHeaderLg, styles.screenHeader, { color: theme.mutedColor }]}>
        {formatBracketHeader('IDENTIFICATION BADGE // OPERATIVE')}
      </Text>

      {useHorizontalSplit ? (
        <LandscapeSplitPane
          style={styles.split}
          primary={identityColumn}
          secondary={telemetryColumn}
          primaryRatio={0.58}
          primaryStyle={styles.splitPane}
          secondaryStyle={styles.splitPane}
        />
      ) : (
        <View style={styles.stacked}>
          {identityColumn}
          {telemetryColumn}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
    padding: LANDSCAPE_PANEL_PADDING,
  },
  screenHeader: {
    marginBottom: 6,
    flexShrink: 0,
  },
  split: {
    flex: 1,
    minHeight: 0,
  },
  splitPane: {
    minHeight: 0,
    justifyContent: 'flex-start',
  },
  stacked: {
    flex: 1,
    minHeight: 0,
    gap: 8,
  },
  identityColumn: {
    flex: 1,
    minHeight: 0,
    gap: 6,
    justifyContent: 'center',
  },
  telemetryColumn: {
    flex: 1,
    minHeight: 0,
    gap: 6,
    justifyContent: 'center',
  },
  badgeCard: {
    padding: 8,
    minHeight: 0,
    position: 'relative',
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  portraitColumn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flexShrink: 0,
  },
  classArrow: {
    width: 18,
    height: 64,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  classArrowLabel: {
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: '700',
  },
  avatarBlock: {
    width: 64,
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  identityDetails: {
    flex: 1,
    minWidth: 0,
    gap: 2,
    paddingTop: 2,
  },
  operativeName: {
    fontFamily: 'System',
    fontSize: 16,
    fontWeight: '800',
    color: '#f8fafc',
    letterSpacing: 0.3,
  },
  subline: {
    fontFamily: 'monospace',
    fontSize: 8,
    letterSpacing: 0.5,
    lineHeight: 11,
  },
  rankLine: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.3,
    lineHeight: 10,
  },
  securityFooter: {
    position: 'absolute',
    right: 6,
    bottom: 4,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  barcodeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 22,
  },
  barcodeBar: {
    width: 2,
    opacity: 0.75,
  },
  securityMatrix: {
    width: 22,
    height: 22,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
  },
  securityCell: {
    width: 4,
    height: 4,
  },
  securityCellOn: {
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  securityCellOff: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  loadoutBlock: {
    flexShrink: 1,
    minHeight: 0,
  },
  testArenaBlock: {
    gap: 4,
    flexShrink: 0,
  },
  testArenaHint: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.3,
    lineHeight: 10,
  },
  testArenaRow: {
    flexDirection: 'row',
    gap: 6,
  },
  testArenaBtn: {
    flex: 1,
  },
  dataField: {
    gap: 2,
    flexShrink: 0,
  },
  fieldValue: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.4,
    lineHeight: 12,
  },
  metaText: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.4,
    lineHeight: 10,
  },
});
