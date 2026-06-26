import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import HapticPressable from '../HapticPressable';
import { CLASS_DEFINITIONS } from '../../data/classes';
import { getFactionDefinition } from '../../data/factions';
import { shadowWarBuffsToRunModifiers } from '../../data/shadowWarBuffEngine';
import { SHADOW_WAR_SECTORS } from '../../data/shadowWarSectors';
import { hubKeyColor } from '../../constants/hubAtmosphere';
import { usePlayerAccount } from '../../context/PlayerAccountContext';
import { useShadowWar } from '../../context/ShadowWarContext';
import type { PlayerAccount } from '../../types/game';
import type { ShadowWarBuffId } from '../../types/shadowWar';
import type { TerminalTheme } from '../../types/theme';
import HubDataField from './HubDataField';
import HubScreenShell, { HubSectionHeader } from './HubScreenShell';
import {
  getInteractiveButtonStyle,
  getInteractiveButtonTextStyle,
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
  const headerColor = theme.statusColor;
  const keyColor = hubKeyColor(theme.mutedColor);

  const activeBuffSummary = useMemo(() => {
    if (activeBuffs.length === 0) return 'No secured sector buffs active';
    return activeBuffs.map((id) => BUFF_LABELS[id] ?? id).join(' // ');
  }, [activeBuffs]);

  const securedSectors = useMemo(
    () => SHADOW_WAR_SECTORS.filter((s) => activeBuffs.includes(s.buffId)).map((s) => s.label),
    [activeBuffs],
  );

  return (
    <HubScreenShell
      title="INCURSION PREP // DESCENT STAGING"
      subtitle="Lock loadout on Safehouse, then breach the Veil from this terminal."
    >
      <HubSectionHeader title="STAGING MANIFEST" color={headerColor} />

      <View style={styles.grid}>
        <View style={styles.gridColumn}>
          <HubDataField
            title="OPERATIVE"
            value={account.username.toUpperCase()}
            valueColor={theme.statusColor}
            mutedColor={theme.mutedColor}
            icon="person-outline"
          />
          <HubDataField
            title="CLASS PROTOCOL"
            value={`${classDef.displayName} // RANK ${account.operativeRank}`}
            valueColor={theme.textColor}
            mutedColor={theme.mutedColor}
            icon="shield-outline"
          />
        </View>

        <View style={styles.gridColumn}>
          <HubDataField
            title="CABAL"
            value={factionDef?.displayName ?? 'UNALIGNED'}
            valueColor={factionDef?.accentColor ?? theme.mutedColor}
            mutedColor={theme.mutedColor}
            icon="flag-outline"
          />
          <HubDataField
            title="STASH MANIFEST"
            value={`${stash.used}/${stash.max} SLOTS`}
            valueColor={theme.statusColor}
            mutedColor={theme.mutedColor}
            icon="cube-outline"
          />
        </View>
      </View>

      <View style={styles.buffBlock}>
        <HubDataField
          title="SHADOW WAR BUFFS"
          value={activeBuffSummary}
          valueColor={theme.statusColor}
          mutedColor={theme.mutedColor}
          icon="flash-outline"
        />
        {securedSectors.length > 0 ? (
          <Text style={[styles.buffMeta, { color: keyColor }]}>
            {`Secured: ${securedSectors.join(', ')}`}
          </Text>
        ) : null}
        {buffMods.firstTurnApBonus > 0 || buffMods.maxHpBonusPct > 0 ? (
          <Text style={[styles.buffMeta, { color: keyColor }]}>
            {`Run modifiers: +${buffMods.maxHpBonusPct}% HP, +${buffMods.firstTurnApBonus} turn-1 AP`}
          </Text>
        ) : null}
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
            <Text style={[styles.ctaSub, { color: keyColor }]}>
              {runDisabled
                ? 'Align with a Cabal to unlock descent'
                : 'Commit loadout and enter Bound Requisition'}
            </Text>
          </>
        )}
      </HapticPressable>
    </HubScreenShell>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 10,
  },
  gridColumn: {
    flex: 1,
    minWidth: 0,
    gap: 10,
  },
  buffBlock: {
    gap: 4,
    marginBottom: 12,
  },
  buffMeta: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.4,
    lineHeight: 10,
    paddingLeft: 16,
  },
  cta: {
    marginTop: 'auto',
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
