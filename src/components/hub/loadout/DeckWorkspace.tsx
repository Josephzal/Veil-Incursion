import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import HapticPressable from '../../HapticPressable';
import TerminalText from '../../TerminalText';
import { usePlayerAccount } from '../../../context/PlayerAccountContext';
import { AEGIS_ABILITY_CATALOG, getAbilityDefinition } from '../../../data/aegisAbilities';
import { getAssignableAbilities, isAbilityUnlocked } from '../../../data/aegisAbilityUnlockEngine';
import {
  ENVOY_ANCHOR,
  ENVOY_INTRINSIC,
  formatEnvoyAbilityTags,
  formatHexShotAbilityTags,
  getAssignableEnvoyAbilities,
  getAssignableHexShotAbilities,
  HEX_SHOT_ANCHOR,
  HEX_SHOT_INTRINSIC,
  isEnvoyAbilityUnlocked,
  isHexShotAbilityUnlocked,
} from '../../../data/classAbilityUnlockEngine';
import { ENVOY_ABILITY_CATALOG } from '../../../data/envoyAbilities';
import { HEX_SHOT_ABILITY_CATALOG } from '../../../data/hexShotAbilities';
import { formatClassAbilityCostLine } from '../../../data/classAbilityResolver';
import type { AegisAbilityId, AegisLoadout } from '../../../types/aegisCombat';
import type { EnvoyAbilityId, EnvoyLoadout, HexShotAbilityId, HexShotLoadout } from '../../../types/operativeClass';
import { validateLoadoutCommit } from '../../../utils/aegisLoadoutUtils';
import {
  validateEnvoyLoadoutCommit,
  validateHexShotLoadoutCommit,
} from '../../../utils/classLoadoutUtils';
import { MUTED, TERMINAL, TEXT_PRIMARY, TEXT_SECONDARY } from './loadoutTerminalUi';
import { OccultNeonRail } from '../veilChrome';
import {
  HUB_CARD_BORDER,
  HUB_CARD_BORDER_HOVER,
  HUB_CARD_BORDER_SELECTED,
  HUB_CARD_SURFACE,
  HUB_CARD_SURFACE_HOVER,
  HUB_SELECT_SURFACE,
} from '../../../theme/hubPanelSurfaces';

export type DeckSelection =
  | { kind: 'SLOT'; index: 0 | 1 | 2 | 3 }
  | { kind: 'POOL'; abilityId: string };

export interface DeckDossierAction {
  label: string;
  disabled?: boolean;
  onPress?: () => void;
  tone?: 'primary' | 'muted' | 'danger';
}

export interface DeckInspectModel {
  title: string;
  status: string;
  typeLine: string;
  costLine: string;
  tags: string;
  description: string;
  slotLine: string;
  actions: DeckDossierAction[];
}

interface DeckWorkspaceProps {
  selection: DeckSelection | null;
  onSelect: (selection: DeckSelection) => void;
  onInspectChange: (model: DeckInspectModel | null) => void;
  compact?: boolean;
}

type PoolEntry = {
  id: string;
  label: string;
  description: string;
  costLine: string;
  tagsLine: string;
  unlocked: boolean;
  inDeckSlot: number | null;
};

export default function DeckWorkspace({
  selection,
  onSelect,
  onInspectChange,
  compact,
}: DeckWorkspaceProps): React.JSX.Element {
  const {
    account,
    setAegisLoadout,
    setHexShotLoadout,
    setEnvoyLoadout,
    unlockAegisAbility,
    unlockHexShotAbility,
    unlockEnvoyAbility,
    appendHubLog,
  } = usePlayerAccount();

  const [aegisDraft, setAegisDraft] = useState<AegisAbilityId[]>([...account.aegisLoadout]);
  const [hexDraft, setHexDraft] = useState<HexShotAbilityId[]>([...account.hexShotLoadout]);
  const [envoyDraft, setEnvoyDraft] = useState<EnvoyAbilityId[]>([...account.envoyLoadout]);

  useEffect(() => { setAegisDraft([...account.aegisLoadout]); }, [account.aegisLoadout]);
  useEffect(() => { setHexDraft([...account.hexShotLoadout]); }, [account.hexShotLoadout]);
  useEffect(() => { setEnvoyDraft([...account.envoyLoadout]); }, [account.envoyLoadout]);

  useEffect(() => {
    if (account.activeClass !== 'AEGIS') return;
    if (validateLoadoutCommit(aegisDraft, account.unlockedAegisAbilities)) return;
    const committed: AegisLoadout = [aegisDraft[0], aegisDraft[1], aegisDraft[2], aegisDraft[3]];
    if (committed.some((id, index) => id !== account.aegisLoadout[index])) {
      setAegisLoadout(committed);
    }
  }, [aegisDraft, account.activeClass, account.aegisLoadout, account.unlockedAegisAbilities, setAegisLoadout]);

  useEffect(() => {
    if (account.activeClass !== 'HEX_SHOT') return;
    if (validateHexShotLoadoutCommit(hexDraft, account.unlockedHexShotAbilities)) return;
    const committed: HexShotLoadout = [hexDraft[0], hexDraft[1], hexDraft[2], hexDraft[3]];
    if (committed.some((id, index) => id !== account.hexShotLoadout[index])) {
      setHexShotLoadout(committed);
    }
  }, [hexDraft, account.activeClass, account.hexShotLoadout, account.unlockedHexShotAbilities, setHexShotLoadout]);

  useEffect(() => {
    if (account.activeClass !== 'ENVOY') return;
    if (validateEnvoyLoadoutCommit(envoyDraft, account.unlockedEnvoyAbilities)) return;
    const committed: EnvoyLoadout = [envoyDraft[0], envoyDraft[1], envoyDraft[2], envoyDraft[3]];
    if (committed.some((id, index) => id !== account.envoyLoadout[index])) {
      setEnvoyLoadout(committed);
    }
  }, [envoyDraft, account.activeClass, account.envoyLoadout, account.unlockedEnvoyAbilities, setEnvoyLoadout]);

  const draft = account.activeClass === 'AEGIS'
    ? aegisDraft
    : account.activeClass === 'HEX_SHOT'
      ? hexDraft
      : envoyDraft;

  const pool: PoolEntry[] = useMemo(() => {
    if (account.activeClass === 'AEGIS') {
      return getAssignableAbilities().map((id) => {
        const def = AEGIS_ABILITY_CATALOG[id];
        const inDeckSlot = aegisDraft.findIndex((entry) => entry === id);
        return {
          id,
          label: def.label,
          description: def.description,
          costLine: formatClassAbilityCostLine('AEGIS', id) ?? '',
          tagsLine: getAbilityDefinition(id).tags.join(' · '),
          unlocked: isAbilityUnlocked(account.unlockedAegisAbilities, id),
          inDeckSlot: inDeckSlot >= 0 ? inDeckSlot : null,
        };
      });
    }
    if (account.activeClass === 'HEX_SHOT') {
      return getAssignableHexShotAbilities().map((id) => {
        const def = HEX_SHOT_ABILITY_CATALOG[id];
        const inDeckSlot = hexDraft.findIndex((entry) => entry === id);
        return {
          id,
          label: def.label,
          description: def.description,
          costLine: formatClassAbilityCostLine('HEX_SHOT', id),
          tagsLine: formatHexShotAbilityTags(id),
          unlocked: isHexShotAbilityUnlocked(account.unlockedHexShotAbilities, id),
          inDeckSlot: inDeckSlot >= 0 ? inDeckSlot : null,
        };
      });
    }
    return getAssignableEnvoyAbilities().map((id) => {
      const def = ENVOY_ABILITY_CATALOG[id];
      const inDeckSlot = envoyDraft.findIndex((entry) => entry === id);
      return {
        id,
        label: def.label,
        description: def.description,
        costLine: formatClassAbilityCostLine('ENVOY', id),
        tagsLine: formatEnvoyAbilityTags(id),
        unlocked: isEnvoyAbilityUnlocked(account.unlockedEnvoyAbilities, id),
        inDeckSlot: inDeckSlot >= 0 ? inDeckSlot : null,
      };
    });
  }, [
    account.activeClass,
    account.unlockedAegisAbilities,
    account.unlockedEnvoyAbilities,
    account.unlockedHexShotAbilities,
    aegisDraft,
    envoyDraft,
    hexDraft,
  ]);

  const selectedFlexSlot = selection?.kind === 'SLOT' && selection.index > 0
    ? selection.index as 1 | 2 | 3
    : 1;

  const assignToSelectedSlot = useCallback((abilityId: string) => {
    if (account.activeClass === 'AEGIS') {
      const id = abilityId as AegisAbilityId;
      if (id === 'EVISCERATE') return;
      if (!isAbilityUnlocked(account.unlockedAegisAbilities, id)) {
        const result = unlockAegisAbility(id);
        appendHubLog(result.logLine);
        return;
      }
      const target = selection?.kind === 'SLOT' ? selection.index : 0;
      if (target === 0) return;
      setAegisDraft((prev) => {
        const next = [...prev];
        next[target] = id;
        return next;
      });
      return;
    }
    if (account.activeClass === 'HEX_SHOT') {
      const id = abilityId as HexShotAbilityId;
      if (HEX_SHOT_INTRINSIC.includes(id) || id === HEX_SHOT_ANCHOR) return;
      if (!isHexShotAbilityUnlocked(account.unlockedHexShotAbilities, id)) {
        const result = unlockHexShotAbility(id);
        appendHubLog(result.logLine);
        return;
      }
      setHexDraft((prev) => {
        const next: HexShotAbilityId[] = [...prev];
        next[selectedFlexSlot] = id;
        return next;
      });
      return;
    }
    const id = abilityId as EnvoyAbilityId;
    if (ENVOY_INTRINSIC.includes(id) || id === ENVOY_ANCHOR) return;
    if (!isEnvoyAbilityUnlocked(account.unlockedEnvoyAbilities, id)) {
      const result = unlockEnvoyAbility(id);
      appendHubLog(result.logLine);
      return;
    }
    setEnvoyDraft((prev) => {
      const next: EnvoyAbilityId[] = [...prev];
      next[selectedFlexSlot] = id;
      return next;
    });
  }, [
    account.activeClass,
    account.unlockedAegisAbilities,
    account.unlockedEnvoyAbilities,
    account.unlockedHexShotAbilities,
    appendHubLog,
    selectedFlexSlot,
    selection,
    unlockAegisAbility,
    unlockEnvoyAbility,
    unlockHexShotAbility,
  ]);

  useEffect(() => {
    if (!selection) {
      onSelect({ kind: 'SLOT', index: 0 });
      return;
    }

    let abilityId: string | null = null;
    let slotIndex: number | null = null;
    if (selection.kind === 'SLOT') {
      slotIndex = selection.index;
      abilityId = draft[selection.index] ?? null;
    } else {
      abilityId = selection.abilityId;
      slotIndex = draft.findIndex((id) => id === selection.abilityId);
      if (slotIndex < 0) slotIndex = null;
    }
    if (!abilityId) {
      onInspectChange({
        title: 'EMPTY SLOT',
        status: 'EMPTY',
        typeLine: `SLOT ${(slotIndex ?? 0) + 1}`,
        costLine: '—',
        tags: '—',
        description: 'Select an ability from the pool to assign here.',
        slotLine: `SLOT ${(slotIndex ?? 0) + 1}`,
        actions: [{ label: '[ SELECT ABILITY FROM POOL ]', disabled: true, tone: 'muted' }],
      });
      return;
    }

    const poolEntry = pool.find((entry) => entry.id === abilityId);
    const isAnchor = account.activeClass === 'AEGIS'
      ? slotIndex === 0
      : account.activeClass === 'HEX_SHOT'
        ? abilityId === HEX_SHOT_ANCHOR || slotIndex === 0
        : abilityId === ENVOY_ANCHOR || slotIndex === 0;

    const actions: DeckDossierAction[] = [];
    if (isAnchor && slotIndex === 0) {
      actions.push({ label: '[ FIXED CLASS ANCHOR ]', disabled: true, tone: 'muted' });
    } else if (slotIndex != null && selection.kind === 'SLOT') {
      actions.push({
        label: `[ REMOVE FROM SLOT ${slotIndex + 1} ]`,
        disabled: true,
        tone: 'muted',
      });
      actions.push({
        label: '[ SELECT POOL ABILITY TO REPLACE ]',
        disabled: true,
        tone: 'muted',
      });
    } else if (selection.kind === 'POOL') {
      if (!poolEntry?.unlocked) {
        actions.push({
          label: '[ UNLOCK ABILITY ]',
          onPress: () => assignToSelectedSlot(abilityId!),
          tone: 'primary',
        });
      } else if (poolEntry.inDeckSlot != null) {
        actions.push({
          label: `[ ALREADY IN SLOT ${poolEntry.inDeckSlot + 1} ]`,
          disabled: true,
          tone: 'muted',
        });
        if (selectedFlexSlot !== poolEntry.inDeckSlot && selectedFlexSlot > 0) {
          actions.push({
            label: `[ MOVE TO SLOT ${selectedFlexSlot + 1} ]`,
            onPress: () => assignToSelectedSlot(abilityId!),
            tone: 'primary',
          });
        }
      } else {
        actions.push({
          label: `[ ASSIGN TO SLOT ${selectedFlexSlot + 1} ]`,
          onPress: () => assignToSelectedSlot(abilityId!),
          tone: 'primary',
        });
      }
    }

    onInspectChange({
      title: (poolEntry?.label ?? abilityId).replace(/[\[\]]/g, '').trim(),
      status: isAnchor && slotIndex === 0
        ? 'ANCHOR · FIXED'
        : slotIndex != null
          ? `IN DECK · SLOT ${slotIndex + 1}`
          : poolEntry?.unlocked ? 'AVAILABLE' : 'LOCKED',
      typeLine: account.activeClass.replace(/_/g, ' '),
      costLine: poolEntry?.costLine || '—',
      tags: poolEntry?.tagsLine || '—',
      description: poolEntry?.description || '',
      slotLine: slotIndex != null ? `SLOT ${slotIndex + 1}` : 'NOT IN DECK',
      actions,
    });
  }, [
    account.activeClass,
    assignToSelectedSlot,
    draft,
    onInspectChange,
    onSelect,
    pool,
    selectedFlexSlot,
    selection,
  ]);

  const activeSlots = [0, 1, 2, 3].map((index) => {
    const abilityId = draft[index];
    const entry = pool.find((item) => item.id === abilityId)
      ?? {
        id: abilityId,
        label: abilityId,
        description: '',
        costLine: formatClassAbilityCostLine(account.activeClass, abilityId as never) ?? '',
        tagsLine: '',
        unlocked: true,
        inDeckSlot: index,
      };
    const isAnchor = index === 0;
    const selected = selection?.kind === 'SLOT' && selection.index === index;
    return { index: index as 0 | 1 | 2 | 3, entry, isAnchor, selected, abilityId };
  });

  return (
    <View style={styles.root}>
      <View style={[styles.activeDeck, compact && styles.activeDeckCompact]}>
        {activeSlots.map((slot) => (
          <HapticPressable
            key={`slot-${slot.index}`}
            onPress={() => onSelect({ kind: 'SLOT', index: slot.index })}
            accessibilityRole="button"
            accessibilityState={{ selected: slot.selected }}
            accessibilityLabel={`Ability slot ${slot.index + 1}`}
            style={({ pressed }) => ([
              styles.deckSlot,
              slot.selected && styles.deckSlotSelected,
              pressed && { opacity: 0.92 },
            ])}
          >
            {slot.selected ? <OccultNeonRail style={styles.slotAccent} /> : null}
            <View style={styles.slotTopline}>
              <TerminalText size={7} letterSpacing={0.9} style={styles.slotMeta}>
                {`SLOT ${slot.index + 1}`}
              </TerminalText>
              <TerminalText size={7} letterSpacing={0.9} style={{ color: slot.isAnchor ? TERMINAL : MUTED, fontWeight: '700' }}>
                {slot.isAnchor ? 'ANCHOR · FIXED' : 'ACTIVE'}
              </TerminalText>
            </View>
            <TerminalText size={9.5} letterSpacing={0.3} style={styles.slotTitle} numberOfLines={1}>
              {slot.entry.label.replace(/[\[\]]/g, '').trim().toUpperCase()}
            </TerminalText>
            <TerminalText size={7.5} style={styles.slotCost} numberOfLines={1}>
              {slot.entry.costLine || '—'}
            </TerminalText>
            {slot.entry.tagsLine ? (
              <TerminalText size={7} letterSpacing={0.4} style={styles.slotTags} numberOfLines={1}>
                {slot.entry.tagsLine.toUpperCase()}
              </TerminalText>
            ) : null}
          </HapticPressable>
        ))}
      </View>

      <View style={styles.feedHeader}>
        <TerminalText size={7.5} letterSpacing={1} style={styles.feedHeaderText}>
          ABILITY POOL
        </TerminalText>
        <TerminalText size={7.5} letterSpacing={1} style={styles.feedHeaderText}>
          {`${pool.filter((entry) => entry.unlocked).length} UNLOCKED`}
        </TerminalText>
      </View>

      <ScrollView
        style={styles.feed}
        contentContainerStyle={styles.feedContent}
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
        {...(Platform.OS === 'web'
          ? ({
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(105, 200, 173, 0.24) transparent',
            } as object)
          : null)}
      >
        {pool.map((entry) => {
          const selected = selection?.kind === 'POOL' && selection.abilityId === entry.id;
          return (
            <View
              key={entry.id}
              style={styles.signal}
              {...(Platform.OS === 'web'
                ? ({ 'data-selected': selected ? 'true' : 'false' } as object)
                : null)}
            >
              {selected ? <OccultNeonRail style={styles.signalAccent} /> : null}
              <HapticPressable
                onPress={() => onSelect({ kind: 'POOL', abilityId: entry.id })}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Inspect ${entry.label}`}
                style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ([
                  styles.signalSelect,
                  selected && styles.signalSelectSelected,
                  ((hovered || pressed) && !selected) ? styles.signalSelectHover : null,
                ])}
              >
                <View style={styles.signalMain}>
                  <View style={styles.signalTopline}>
                    <TerminalText size={7} letterSpacing={0.9} style={styles.signalMeta}>
                      {entry.unlocked ? 'UNLOCKED' : 'LOCKED'}
                    </TerminalText>
                    <TerminalText size={7} letterSpacing={0.9} style={{ color: entry.inDeckSlot != null ? TERMINAL : MUTED, fontWeight: '700' }}>
                      {entry.inDeckSlot != null ? `IN DECK · SLOT ${entry.inDeckSlot + 1}` : 'AVAILABLE'}
                    </TerminalText>
                  </View>
                  <TerminalText size={11} letterSpacing={0.35} style={styles.signalTitle} numberOfLines={1}>
                    {entry.label.replace(/[\[\]]/g, '').trim().toUpperCase()}
                  </TerminalText>
                  <TerminalText size={7.5} style={styles.signalCost} numberOfLines={1}>
                    {entry.costLine || '—'}
                  </TerminalText>
                  <TerminalText size={8.5} style={styles.signalBody} numberOfLines={1}>
                    {entry.description}
                  </TerminalText>
                </View>
              </HapticPressable>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
  activeDeck: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 0,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: HUB_CARD_BORDER,
    ...Platform.select({
      web: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        columnGap: 8,
        rowGap: 8,
      } as object,
      default: {},
    }),
  },
  activeDeckCompact: { paddingVertical: 10 },
  deckSlot: {
    width: '49.6%',
    minHeight: 96,
    paddingHorizontal: 14,
    paddingVertical: 12,
    paddingLeft: 16,
    backgroundColor: HUB_CARD_SURFACE,
    borderWidth: 1,
    borderColor: HUB_CARD_BORDER,
    position: 'relative',
    overflow: 'hidden',
    ...Platform.select({
      web: {
        width: 'auto',
        minWidth: 0,
        cursor: 'pointer',
      } as object,
      default: {},
    }),
  },
  deckSlotSelected: {
    backgroundColor: HUB_SELECT_SURFACE,
    borderColor: HUB_CARD_BORDER_SELECTED,
  },
  slotAccent: {
    top: 12,
    bottom: 12,
  },
  slotTopline: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  slotMeta: { color: MUTED, fontWeight: '700' },
  slotTitle: { marginTop: 6, color: TEXT_PRIMARY, fontWeight: '700' },
  slotCost: { marginTop: 5, color: TEXT_SECONDARY, fontVariant: ['tabular-nums'] },
  slotTags: { marginTop: 4, color: MUTED, fontWeight: '700' },
  feedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 36,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: HUB_CARD_BORDER,
  },
  feedHeaderText: { color: MUTED, fontWeight: '700' },
  feed: { flex: 1, minHeight: 0 },
  feedContent: { paddingHorizontal: 0, paddingTop: 8, paddingBottom: 16 },
  signal: {
    position: 'relative',
    marginBottom: 10,
    overflow: 'hidden',
  },
  signalAccent: {
    top: 14,
    bottom: 14,
  },
  signalSelect: {
    minHeight: 108,
    paddingTop: 14,
    paddingBottom: 14,
    paddingLeft: 18,
    paddingRight: 18,
    backgroundColor: HUB_CARD_SURFACE,
    borderWidth: 1,
    borderColor: HUB_CARD_BORDER,
    ...Platform.select({ web: { cursor: 'pointer', outlineStyle: 'none' } as object, default: {} }),
  },
  signalSelectHover: {
    backgroundColor: HUB_CARD_SURFACE_HOVER,
    borderColor: HUB_CARD_BORDER_HOVER,
  },
  signalSelectSelected: {
    backgroundColor: HUB_SELECT_SURFACE,
    borderColor: HUB_CARD_BORDER_SELECTED,
  },
  signalMain: { minWidth: 0 },
  signalTopline: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  signalMeta: { color: MUTED, fontWeight: '700' },
  signalTitle: { marginTop: 5, color: TEXT_PRIMARY, fontWeight: '700' },
  signalCost: { marginTop: 4, color: TEXT_SECONDARY, fontVariant: ['tabular-nums'] },
  signalBody: { marginTop: 5, color: TEXT_SECONDARY, lineHeight: 18 },
});
