import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CLASS_DEFINITIONS } from '../data/classes';
import { getFactionDefinition } from '../data/factions';
import { useGameFlow } from '../context/GameFlowContext';
import { useRun } from '../context/RunContext';
import ExplorationHubPanel from './ExplorationHubPanel';
import { PlayerAccount } from '../types/game';
import { OperativeProfile } from '../types/profile';
import { TerminalTheme } from '../types/theme';
import { formatSnakeCaseToTitleCase } from '../utils/formatDisplayName';

interface IdentificationBadgeViewProps {
  theme: TerminalTheme;
  profile: OperativeProfile;
  account: PlayerAccount;
}

const BARCODE_HEIGHTS = [14, 22, 10, 28, 16, 24, 12, 20, 18, 26, 11, 19];
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
  const { startCombat } = useGameFlow();
  const { startBadgeTestCombat } = useRun();
  const [hubOpen, setHubOpen] = useState(false);

  const cred = profile.operative_profile.credentials;
  const vectors = profile.operative_profile.location_vectors;
  const factionDef = account.alignedFaction ? getFactionDefinition(account.alignedFaction) : null;
  const classDef = CLASS_DEFINITIONS[account.activeClass];
  const factionColor = factionDef?.accentColor ?? theme.primaryColor;
  const accentFill = `${theme.primaryColor}26`;

  const borderStyle = {
    borderColor: theme.borderColor,
    borderWidth: theme.borderWidth,
    borderStyle: theme.borderStyle,
  };

  const launchTestCombat = (preset: 'easy' | 'hard') => {
    startBadgeTestCombat(preset);
    startCombat();
  };

  if (hubOpen) {
    return (
      <View style={[styles.root, styles.hubRoot, borderStyle, { backgroundColor: '#050608' }]}>
        <Pressable
          onPress={() => setHubOpen(false)}
          style={[styles.hubBackBtn, { borderColor: theme.statusColor }]}
        >
          <Text style={[styles.hubBackBtnText, { color: theme.statusColor }]}>
            [ RETURN TO BADGE ]
          </Text>
        </Pressable>
        <View style={styles.hubPanel}>
          <ExplorationHubPanel />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, borderStyle, { backgroundColor: '#050608' }]}>
      <Text style={[styles.header, { color: theme.primaryColor }]}>
        [ IDENTIFICATION BADGE // OPERATIVE ]
      </Text>

      <View style={[styles.badgeCard, { borderColor: `${theme.statusColor}55` }]}>
        <View style={styles.identityRow}>
          <View style={[styles.avatarBlock, { backgroundColor: accentFill }]}>
            <Text style={[styles.avatarLetter, { color: theme.statusColor }]}>
              {cred.class.slice(0, 1)}
            </Text>
          </View>

          <View style={styles.identityDetails}>
            <Text style={styles.operativeName}>{cred.username}</Text>
            <Text style={[styles.subline, { color: theme.mutedColor }]}>
              {`${classDef.displayName.toUpperCase()} // ID ${cred.id}`}
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

      <View style={styles.fieldBlock}>
        <Text style={[styles.fieldLabel, { color: theme.mutedColor }]}>[ CABAL ALIGNMENT ]</Text>
        <View style={styles.factionRow}>
          <View style={[styles.factionDot, { backgroundColor: factionColor }]} />
          <Text style={[styles.fieldValue, { color: factionColor }]}>
            {factionDef?.displayName ?? formatSnakeCaseToTitleCase(cred.cabal_alignment)}
          </Text>
        </View>
      </View>

      <View style={styles.fieldBlock}>
        <Text style={[styles.fieldLabel, { color: theme.mutedColor }]}>[ TRACKING FREQUENCY ]</Text>
        <Text style={[styles.fieldValue, { color: theme.statusColor }]}>{vectors.active_frequency}</Text>
      </View>

      <View style={styles.fieldBlock}>
        <Text style={[styles.fieldLabel, { color: theme.mutedColor }]}>[ NODE LOCK ]</Text>
        <Text style={[styles.fieldValue, { color: theme.textColor }]}>
          {formatSnakeCaseToTitleCase(vectors.current_node_lock)}
        </Text>
      </View>

      <View style={styles.fieldBlock}>
        <Text style={[styles.fieldLabel, { color: theme.mutedColor }]}>[ HOME SECTOR ]</Text>
        <Text style={[styles.fieldValue, { color: theme.textColor }]}>
          {formatSnakeCaseToTitleCase(vectors.home_sector)}
        </Text>
      </View>

      <View style={[styles.metaRow, { borderTopColor: `${theme.borderColor}66` }]}>
        <Text style={[styles.metaText, { color: theme.mutedColor }]}>
          {`${account.cabalCredits} CABAL CR // CLEARANCE ACTIVE`}
        </Text>
      </View>

      <View style={[styles.testCombatSection, { borderTopColor: `${theme.borderColor}66` }]}>
        <Text style={[styles.testCombatLabel, { color: theme.mutedColor }]}>
          [ TEST COMBAT // BADGE ARENA ]
        </Text>
        <View style={styles.testCombatRow}>
          <Pressable
            onPress={() => launchTestCombat('easy')}
            style={[styles.testCombatBtn, { borderColor: theme.primaryColor }]}
          >
            <Text style={[styles.testCombatBtnText, { color: theme.primaryColor }]}>
              [ EASY COMBAT ]
            </Text>
          </Pressable>
          <Pressable
            onPress={() => launchTestCombat('hard')}
            style={[styles.testCombatBtn, { borderColor: theme.statusColor }]}
          >
            <Text style={[styles.testCombatBtnText, { color: theme.statusColor }]}>
              [ HARD COMBAT ]
            </Text>
          </Pressable>
        </View>
        <Text style={[styles.testCombatHint, { color: theme.mutedColor }]}>
          Returns here after victory or defeat.
        </Text>
      </View>

      <Pressable
        onPress={() => setHubOpen(true)}
        style={[styles.hubBtn, { borderColor: theme.primaryColor }]}
      >
        <Text style={[styles.hubBtnText, { color: theme.primaryColor }]}>
          [ HUB ]
        </Text>
        <Text style={[styles.hubBtnSub, { color: theme.mutedColor }]}>
          // METROPOLITAN EXPLORATION CORRIDOR
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 14, minHeight: 320 },
  hubRoot: { paddingTop: 8, gap: 8 },
  header: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  badgeCard: {
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
    minHeight: 120,
    position: 'relative',
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  avatarBlock: {
    width: 80,
    height: 80,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    paddingTop: 8,
    paddingLeft: 10,
    flexShrink: 0,
  },
  avatarLetter: {
    fontFamily: 'System',
    fontSize: 36,
    fontWeight: '800',
    lineHeight: 40,
  },
  identityDetails: {
    flex: 1,
    minWidth: 0,
    gap: 4,
    paddingTop: 2,
  },
  operativeName: {
    fontFamily: 'System',
    fontSize: 20,
    fontWeight: '800',
    color: '#f8fafc',
    letterSpacing: 0.4,
  },
  subline: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 0.6,
    lineHeight: 13,
  },
  rankLine: {
    fontFamily: 'monospace',
    fontSize: 8,
    letterSpacing: 0.4,
    marginTop: 2,
  },
  securityFooter: {
    position: 'absolute',
    right: 10,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  barcodeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 28,
  },
  barcodeBar: {
    width: 3,
    opacity: 0.75,
  },
  securityMatrix: {
    width: 28,
    height: 28,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
  },
  securityCell: {
    width: 5,
    height: 5,
  },
  securityCellOn: {
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  securityCellOff: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  fieldBlock: { marginBottom: 12 },
  fieldLabel: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 1,
    marginBottom: 4,
  },
  factionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  factionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  fieldValue: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  metaRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    marginTop: 4,
  },
  metaText: {
    fontFamily: 'monospace',
    fontSize: 8,
    letterSpacing: 0.5,
  },
  testCombatSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    marginTop: 12,
    gap: 8,
  },
  testCombatLabel: {
    fontFamily: 'monospace',
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  testCombatRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  testCombatBtn: {
    flex: 1,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  testCombatBtnText: {
    fontFamily: 'monospace',
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  testCombatHint: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.4,
    lineHeight: 10,
  },
  hubBtn: {
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginTop: 12,
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  hubBtnText: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  hubBtnSub: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.4,
  },
  hubBackBtn: {
    borderWidth: 1,
    paddingVertical: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
  },
  hubBackBtnText: {
    fontFamily: 'monospace',
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  hubPanel: {
    flex: 1,
    minHeight: 240,
  },
});
