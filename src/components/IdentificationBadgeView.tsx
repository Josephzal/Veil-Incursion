import React, { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import HapticPressable from './HapticPressable';
import { CLASS_DEFINITIONS } from '../data/classes';
import { getFactionDefinition } from '../data/factions';
import { getMacroSector } from '../data/macroSectors';
import { hubKeyColor, resolveFactionSlateInnerBorder } from '../constants/hubAtmosphere';
import { usePlayerAccount } from '../context/PlayerAccountContext';
import LandscapeSplitPane from './layout/LandscapeSplitPane';
import ClassAbilityRoster from './ClassAbilityRoster';
import HubDataField from './hub/HubDataField';
import HubScreenShell, { HubSectionHeader } from './hub/HubScreenShell';
import { PlayerAccount } from '../types/game';
import { OperativeProfile } from '../types/profile';
import { TerminalTheme } from '../types/theme';
import { formatHomeSectorDisplay } from '../constants/homeSector';
import { formatSnakeCaseToTitleCase } from '../utils/formatDisplayName';
import { resolvePlayerBadgePortrait } from '../utils/combatPlayerPortrait';
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

export default function IdentificationBadgeView({
  theme,
  profile,
  account,
}: IdentificationBadgeViewProps): React.JSX.Element {
  const { cycleActiveClass } = usePlayerAccount();
  const { useHorizontalSplit } = useLandscapeMetrics();

  const cred = profile.operative_profile.credentials;
  const vectors = profile.operative_profile.location_vectors;
  const factionDef = account.alignedFaction ? getFactionDefinition(account.alignedFaction) : null;
  const classDef = CLASS_DEFINITIONS[account.activeClass];
  const homeSector = getMacroSector(account.regionalPresence.homeMacroSector);
  const factionColor = factionDef?.accentColor ?? theme.statusColor;
  const headerColor = theme.statusColor;
  const keyColor = hubKeyColor(theme.mutedColor);
  const slateInnerBorder = resolveFactionSlateInnerBorder(account.alignedFaction);
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

  const identityColumn = (
    <View style={styles.identityColumn}>
      <HubSectionHeader title="OPERATIVE PROFILE" color={headerColor} />
      <View style={styles.badgeCard}>
        <View style={styles.identityRow}>
          <View style={styles.portraitColumn}>
            {canCycleClass ? (
              <HapticPressable
                onPress={() => handleCycleClass(-1)}
                style={({ pressed }) => [
                  styles.classArrow,
                  { borderColor: slateInnerBorder, opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <Text style={[styles.classArrowLabel, { color: headerColor }]}>{'<'}</Text>
              </HapticPressable>
            ) : null}
            <View style={[styles.avatarBlock, { backgroundColor: accentFill, borderColor: slateInnerBorder }]}>
              <Image source={portraitSource} style={styles.avatarImage} resizeMode="contain" />
            </View>
            {canCycleClass ? (
              <HapticPressable
                onPress={() => handleCycleClass(1)}
                style={({ pressed }) => [
                  styles.classArrow,
                  { borderColor: slateInnerBorder, opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <Text style={[styles.classArrowLabel, { color: headerColor }]}>{'>'}</Text>
              </HapticPressable>
            ) : null}
          </View>

          <View style={styles.identityDetails}>
            <Text style={styles.operativeName} numberOfLines={1}>{cred.username}</Text>
            <Text style={[styles.subline, { color: keyColor }]} numberOfLines={1}>
              {`${classDef.displayName.toUpperCase()} // ID ${cred.id}`}
            </Text>
            <Text style={[styles.rankLine, { color: keyColor }]} numberOfLines={1}>
              {classDef.protocolLabel}
            </Text>
            <Text style={[styles.rankLine, { color: keyColor }]} numberOfLines={1}>
              {`${classDef.weaponLine} // ${classDef.interactionLine}`}
            </Text>
            <Text style={[styles.rankLine, { color: keyColor }]}>
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
        <ClassAbilityRoster account={account} theme={theme} accentColor={headerColor} />
      </View>
    </View>
  );

  const telemetryColumn = (
    <View style={styles.telemetryColumn}>
      <HubSectionHeader title="OPERATIVE DATA" color={headerColor} />
      <HubDataField
        title="CABAL ALIGNMENT"
        value={factionDef?.displayName ?? formatSnakeCaseToTitleCase(cred.cabal_alignment)}
        valueColor={factionColor}
        mutedColor={theme.mutedColor}
        icon="skull-outline"
      />
      <HubDataField
        title="TRACKING FREQUENCY"
        value={vectors.active_frequency}
        valueColor={theme.statusColor}
        mutedColor={theme.mutedColor}
        icon="radio-outline"
      />
      <HubDataField
        title="NODE LOCK"
        value={formatSnakeCaseToTitleCase(vectors.current_node_lock)}
        valueColor={theme.textColor}
        mutedColor={theme.mutedColor}
        icon="locate-outline"
      />
      <HubDataField
        title="HOME SECTOR"
        value={formatHomeSectorDisplay(homeSector.id, homeSector.label)}
        valueColor={theme.textColor}
        mutedColor={theme.mutedColor}
        icon="compass-outline"
      />
      <View style={styles.metaFooter}>
        <Text style={[styles.metaText, { color: theme.statusColor }]}>
          {`${account.cabalCredits} CABAL CR // CLEARANCE ACTIVE`}
        </Text>
      </View>
    </View>
  );

  const profileBody = useHorizontalSplit ? (
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
  );

  return (
    <HubScreenShell title="IDENTIFICATION BADGE // OPERATIVE">
      {profileBody}
    </HubScreenShell>
  );
}

const styles = StyleSheet.create({
  split: {
    flex: 1,
    minHeight: 0,
    gap: 18,
  },
  splitPane: {
    minHeight: 0,
    justifyContent: 'flex-start',
    paddingHorizontal: 2,
  },
  stacked: {
    flex: 1,
    minHeight: 0,
    gap: 14,
  },
  identityColumn: {
    flex: 1,
    minHeight: 0,
    gap: 8,
    justifyContent: 'flex-start',
    paddingRight: 6,
  },
  telemetryColumn: {
    flex: 1,
    minHeight: 0,
    gap: 10,
    justifyContent: 'flex-start',
    paddingLeft: 6,
  },
  badgeCard: {
    padding: 4,
    minHeight: 0,
    position: 'relative',
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  portraitColumn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  classArrow: {
    width: 18,
    height: 64,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
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
    borderWidth: 1,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  identityDetails: {
    flex: 1,
    minWidth: 0,
    gap: 3,
    paddingTop: 2,
  },
  operativeName: {
    fontFamily: 'System',
    fontSize: 16,
    fontWeight: '800',
    color: '#f8fafc',
    letterSpacing: 0.4,
  },
  subline: {
    fontFamily: 'monospace',
    fontSize: 8,
    letterSpacing: 0.6,
    lineHeight: 11,
  },
  rankLine: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.4,
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
    marginTop: 4,
  },
  metaFooter: {
    marginTop: 'auto',
    paddingTop: 8,
    alignItems: 'flex-end',
  },
  metaText: {
    fontFamily: 'monospace',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.6,
    lineHeight: 11,
    textAlign: 'right',
  },
});
