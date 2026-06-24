import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import HapticPressable from '../HapticPressable';
import { CLASS_DEFINITIONS } from '../../data/classes';
import { getFactionDefinition } from '../../data/factions';
import { shadowWarBuffsToRunModifiers } from '../../data/shadowWarBuffEngine';
import { SHADOW_WAR_SECTORS } from '../../data/shadowWarSectors';
import { usePlayerAccount } from '../../context/PlayerAccountContext';
import { useShadowWar } from '../../context/ShadowWarContext';
import type { PlayerAccount } from '../../types/game';
import type { ShadowWarBuffId } from '../../types/shadowWar';
import type { TerminalTheme } from '../../types/theme';
import {
  formatBracketHeader,
  getInteractiveButtonStyle,
  getInteractiveButtonTextStyle,
  hubTerminalUi,
} from '../../styles/hubTerminalUi';

const BUFF_LABELS: Record<ShadowWarBuffId, string> = {
  KINETIC_ARMOR_PLUS_1: '+1 Kinetic Armor layer',
  MAX_HP_PLUS_10: '+10% Max Soul Anchor',
  RARE_LOOT_PLUS_10: '+10% Rare loot drop rate',
  BLACK_MARKET_DISCOUNT_15: '15% Black Market discount',
  FIRST_TURN_AP_PLUS_1: '+1 AP on combat turn 1',
};

interface IncursionPrepPanelProps {
  theme: TerminalTheme;
  account: PlayerAccount;
  runDisabled: boolean;
  launching: boolean;
  onBeginIncursion: () => void;
}

export default function IncursionPrepPanel({
  theme,
  account,
  runDisabled,
  launching,
  onBeginIncursion,
}: IncursionPrepPanelProps): React.JSX.Element {
  const { activeBuffs } = useShadowWar();
  const { getStashCapacitySnapshot } = usePlayerAccount();
  const stash = getStashCapacitySnapshot();
  const factionDef = account.alignedFaction ? getFactionDefinition(account.alignedFaction) : null;
  const classDef = CLASS_DEFINITIONS[account.activeClass];
  const buffMods = shadowWarBuffsToRunModifiers(activeBuffs);

  const activeBuffLines = useMemo(() => {
    if (activeBuffs.length === 0) {
      return ['No secured sector buffs active — donate on Shadow War tab.'];
    }
    return activeBuffs.map((id) => BUFF_LABELS[id] ?? id);
  }, [activeBuffs]);

  const securedSectors = useMemo(
    () => SHADOW_WAR_SECTORS.filter((s) => activeBuffs.includes(s.buffId)).map((s) => s.label),
    [activeBuffs],
  );

  return (
    <View style={styles.root}>
      <Text style={[hubTerminalUi.sectionHeaderLg, styles.title, { color: theme.mutedColor }]}>
        {formatBracketHeader('INCURSION PREP // DESCENT STAGING')}
      </Text>
      <Text style={[styles.sub, { color: theme.mutedColor }]}>
        Lock loadout on Safehouse, then breach the Veil from this terminal.
      </Text>

      <View style={styles.grid}>
        <View style={[styles.card, { borderColor: theme.borderColor }]}>
          <Text style={[styles.cardLabel, { color: theme.mutedColor }]}>OPERATIVE</Text>
          <Text style={[styles.cardValue, { color: theme.primaryColor }]}>
            {account.username.toUpperCase()}
          </Text>
          <Text style={[styles.cardMeta, { color: theme.mutedColor }]}>
            {`${classDef.displayName} // RANK ${account.operativeRank}`}
          </Text>
        </View>

        <View style={[styles.card, { borderColor: theme.borderColor }]}>
          <Text style={[styles.cardLabel, { color: theme.mutedColor }]}>CABAL</Text>
          <Text style={[styles.cardValue, { color: factionDef?.accentColor ?? theme.mutedColor }]}>
            {factionDef?.displayName ?? 'UNALIGNED'}
          </Text>
          <Text style={[styles.cardMeta, { color: theme.mutedColor }]}>
            {`${account.cabalCredits} CR // DEPTH ${account.progressionMatrix.maxDepthUnlocked}`}
          </Text>
        </View>

        <View style={[styles.card, { borderColor: theme.borderColor }]}>
          <Text style={[styles.cardLabel, { color: theme.mutedColor }]}>STASH</Text>
          <Text style={[styles.cardValue, { color: theme.statusColor }]}>
            {`${stash.used}/${stash.max} SLOTS`}
          </Text>
          <Text style={[styles.cardMeta, { color: theme.mutedColor }]}>
            Cargo manifest committed on breach
          </Text>
        </View>

        <View style={[styles.card, { borderColor: theme.borderColor }]}>
          <Text style={[styles.cardLabel, { color: theme.mutedColor }]}>SHADOW WAR BUFFS</Text>
          {activeBuffLines.map((line) => (
            <Text key={line} style={[styles.cardMeta, { color: theme.primaryColor }]}>
              {`• ${line}`}
            </Text>
          ))}
          {securedSectors.length > 0 ? (
            <Text style={[styles.cardMeta, { color: theme.mutedColor }]}>
              {`Secured: ${securedSectors.join(', ')}`}
            </Text>
          ) : null}
          {buffMods.firstTurnApBonus > 0 || buffMods.maxHpBonusPct > 0 ? (
            <Text style={[styles.cardMeta, { color: theme.mutedColor }]}>
              {`Run modifiers: +${buffMods.maxHpBonusPct}% HP, +${buffMods.firstTurnApBonus} turn-1 AP`}
            </Text>
          ) : null}
        </View>
      </View>

      <HapticPressable
        onPress={() => {
          if (runDisabled || launching) return;
          onBeginIncursion();
        }}
        disabled={runDisabled || launching}
        style={({ pressed }) => [
          getInteractiveButtonStyle(theme.statusColor, {
            disabled: runDisabled || launching,
            pressed,
            size: 'lg',
          }),
          styles.cta,
          runDisabled || launching ? null : pressed ? { opacity: 0.85 } : null,
        ]}
      >
        {launching ? (
          <ActivityIndicator color={theme.statusColor} />
        ) : (
          <>
            <Text style={[getInteractiveButtonTextStyle('lg'), { color: theme.statusColor }]}>
              BEGIN INCURSION
            </Text>
            <Text style={[styles.ctaSub, { color: theme.mutedColor }]}>
              {runDisabled
                ? 'Align with a Cabal to unlock descent'
                : 'Commit loadout and enter Bound Requisition'}
            </Text>
          </>
        )}
      </HapticPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  title: { marginBottom: 2 },
  sub: {
    fontFamily: 'monospace',
    fontSize: 8,
    letterSpacing: 0.4,
    lineHeight: 12,
    marginBottom: 6,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  card: {
    flex: 1,
    minWidth: '45%',
    borderWidth: 1,
    padding: 10,
    gap: 4,
  },
  cardLabel: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.8,
  },
  cardValue: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardMeta: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.3,
    lineHeight: 10,
  },
  cta: {
    marginTop: 4,
    alignItems: 'center',
    gap: 4,
  },
  ctaSub: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.4,
    textAlign: 'center',
  },
});
