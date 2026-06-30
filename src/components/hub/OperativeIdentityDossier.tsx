import React, { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import HapticPressable from '../HapticPressable';
import TerminalText from '../TerminalText';
import { CLASS_DEFINITIONS } from '../../data/classes';
import { getFactionDefinition } from '../../data/factions';
import { hubKeyColor, resolveFactionSlateInnerBorder } from '../../constants/hubAtmosphere';
import { usePlayerAccount } from '../../context/PlayerAccountContext';
import ClassAbilityRoster from '../ClassAbilityRoster';
import { HubSectionHeader } from './HubScreenShell';
import { PlayerAccount } from '../../types/game';
import { OperativeProfile } from '../../types/profile';
import { TerminalTheme } from '../../types/theme';
import { resolvePlayerBadgePortrait } from '../../utils/combatPlayerPortrait';
import { useHubLayout } from '../../context/HubLayoutContext';
import {
  DESKTOP_DEPLOYMENT_AVATAR_SIZE,
  DESKTOP_DEPLOYMENT_IDENTITY_BLOCK_MIN_HEIGHT,
  DESKTOP_DEPLOYMENT_LOADOUT_BLOCK_MIN_HEIGHT,
} from '../../constants/responsiveScale';

interface OperativeIdentityDossierProps {
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

/** Operative profile and loadout manifest for the deployment deck. */
export default function OperativeIdentityDossier({
  theme,
  profile,
  account,
}: OperativeIdentityDossierProps): React.JSX.Element {
  const { cycleActiveClass } = usePlayerAccount();
  const { isDesktop, scaleSize, scaleSpacing } = useHubLayout();
  const identityBlockMinHeight = isDesktop
    ? scaleSize(DESKTOP_DEPLOYMENT_IDENTITY_BLOCK_MIN_HEIGHT)
    : undefined;
  const loadoutBlockMinHeight = isDesktop
    ? scaleSize(DESKTOP_DEPLOYMENT_LOADOUT_BLOCK_MIN_HEIGHT)
    : undefined;

  const cred = profile.operative_profile.credentials;
  const classDef = CLASS_DEFINITIONS[account.activeClass];
  const factionDef = account.alignedFaction ? getFactionDefinition(account.alignedFaction) : null;
  const factionBorderColor = factionDef?.accentColor ?? resolveFactionSlateInnerBorder(account.alignedFaction);
  const headerColor = theme.statusColor;
  const keyColor = hubKeyColor(theme.mutedColor);
  const slateInnerBorder = resolveFactionSlateInnerBorder(account.alignedFaction);
  const accentFill = `${theme.primaryColor}26`;
  const portraitSource = useMemo(
    () => resolvePlayerBadgePortrait(account.activeClass),
    [account.activeClass],
  );
  const canCycleClass = account.unlockedClasses.length > 1;

  const avatarSize = isDesktop ? scaleSize(DESKTOP_DEPLOYMENT_AVATAR_SIZE) : scaleSize(64);
  const arrowWidth = isDesktop ? scaleSize(20) : scaleSize(18);
  const operativeNameSize = scaleSize(11);

  const handleCycleClass = (direction: 1 | -1) => {
    if (!canCycleClass) return;
    cycleActiveClass(direction);
  };

  return (
    <View style={[styles.root, isDesktop ? styles.rootDesktop : null]}>
      <HubSectionHeader title="OPERATIVE PROFILE" color={headerColor} />
      <View style={[styles.badgeCard, isDesktop ? styles.badgeCardDesktop : null]}>
        <View style={[styles.portraitRow, { marginBottom: scaleSpacing(10), height: avatarSize }]}>
          {canCycleClass ? (
            <HapticPressable
              onPress={() => handleCycleClass(-1)}
              style={({ pressed }) => [
                styles.classArrow,
                {
                  width: arrowWidth,
                  height: avatarSize,
                  borderColor: slateInnerBorder,
                  opacity: pressed ? 0.6 : 1,
                },
              ]}
            >
              <TerminalText size={isDesktop ? 14 : 14} style={[styles.classArrowLabel, { color: headerColor }]}>
                {'<'}
              </TerminalText>
            </HapticPressable>
          ) : null}
          <View
            style={[
              styles.avatarBlock,
              {
                width: avatarSize,
                backgroundColor: accentFill,
                borderColor: factionBorderColor,
              },
            ]}
          >
            <Image source={portraitSource} style={styles.avatarImage} resizeMode="contain" />
          </View>
          {canCycleClass ? (
            <HapticPressable
              onPress={() => handleCycleClass(1)}
              style={({ pressed }) => [
                styles.classArrow,
                {
                  width: arrowWidth,
                  height: avatarSize,
                  borderColor: slateInnerBorder,
                  opacity: pressed ? 0.6 : 1,
                },
              ]}
            >
              <TerminalText size={isDesktop ? 14 : 14} style={[styles.classArrowLabel, { color: headerColor }]}>
                {'>'}
              </TerminalText>
            </HapticPressable>
          ) : null}
        </View>

        <View
          style={[
            styles.identityBlock,
            identityBlockMinHeight != null ? { minHeight: identityBlockMinHeight } : null,
          ]}
        >
          <Text style={[styles.operativeName, { fontSize: operativeNameSize }]} numberOfLines={1}>
            {cred.username}
          </Text>
          <TerminalText
            variant="body"
            lineHeight={11}
            letterSpacing={0.6}
            style={[styles.subline, { color: keyColor }]}
            numberOfLines={1}
          >
            {`${classDef.displayName.toUpperCase()} // ID ${cred.id}`}
          </TerminalText>
          <TerminalText
            variant="caption"
            letterSpacing={0.4}
            style={[styles.detailLine, { color: keyColor }]}
            numberOfLines={1}
          >
            {classDef.protocolLabel}
          </TerminalText>
          <TerminalText
            variant="caption"
            letterSpacing={0.4}
            style={[styles.detailLine, { color: keyColor }]}
            numberOfLines={1}
          >
            {classDef.weaponLine}
          </TerminalText>
          <TerminalText
            variant="caption"
            letterSpacing={0.4}
            style={[styles.detailLine, { color: keyColor }]}
            numberOfLines={1}
          >
            {classDef.interactionLine}
          </TerminalText>
          <TerminalText
            variant="caption"
            letterSpacing={0.4}
            style={[styles.detailLine, { color: keyColor }]}
            numberOfLines={1}
          >
            {`RANK ${account.operativeRank}`}
          </TerminalText>
          <View style={styles.securityFooter}>
            <BarcodeStrip color={`${theme.mutedColor}88`} />
            <SecurityMatrix />
          </View>
        </View>
      </View>

      <View
        style={[
          styles.loadoutBlock,
          { marginTop: scaleSpacing(4) },
          loadoutBlockMinHeight != null ? { minHeight: loadoutBlockMinHeight } : null,
        ]}
      >
        <ClassAbilityRoster account={account} theme={theme} accentColor={headerColor} compact={isDesktop} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 6,
  },
  rootDesktop: {
    flex: 1,
    minHeight: 0,
  },
  badgeCard: {
    padding: 4,
    minHeight: 0,
  },
  badgeCardDesktop: {
    padding: 6,
  },
  portraitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    alignSelf: 'center',
  },
  classArrow: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
  },
  classArrowLabel: {
    fontWeight: '700',
  },
  avatarBlock: {
    aspectRatio: 1,
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
  identityBlock: {
    width: '100%',
    gap: 2,
    paddingHorizontal: 2,
  },
  operativeName: {
    fontFamily: 'System',
    fontWeight: '800',
    color: '#f8fafc',
    letterSpacing: 0.4,
  },
  subline: {
    fontWeight: '700',
  },
  detailLine: {
    flexShrink: 1,
  },
  securityFooter: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    gap: 6,
    marginTop: 4,
  },
  barcodeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 18,
  },
  barcodeBar: {
    width: 2,
    opacity: 0.75,
  },
  securityMatrix: {
    width: 18,
    height: 18,
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
    flexShrink: 0,
  },
});
