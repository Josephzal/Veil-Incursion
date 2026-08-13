import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import HapticPressable from '../../HapticPressable';
import TerminalText from '../../TerminalText';
import { usePlayerAccount } from '../../../context/PlayerAccountContext';
import { getAssignableAbilities } from '../../../data/aegisAbilityUnlockEngine';
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
import type { AegisTechniqueId, AegisTechniqueLoadout } from '../../../types/aegisCombat';
import type {
  EnvoyAbilityId,
  EnvoyFlexAbilityId,
  EnvoyLoadout,
  HexShotAbilityId,
  HexShotLoadout,
} from '../../../types/operativeClass';
import { validateAegisTechniqueLoadoutCommit } from '../../../utils/aegisLoadoutUtils';
import { getAegisTechniqueDefinition, isAegisTechniqueId } from '../../../data/aegisTechniqueCatalog';
import {
  validateEnvoyLoadoutCommit,
  validateHexShotLoadoutCommit,
} from '../../../utils/classLoadoutUtils';
import { getEquippedWeaponForClass } from '../../../data/weaponProgressionEngine';
import {
  deriveAegisWeaponActions,
  isAegisWeaponFamilyId,
} from '../../../data/aegisWeaponActionRegistry';
import {
  aegisWeaponActionTags,
  formatAegisWeaponActionLabel,
  getAegisWeaponActionDefinition,
} from '../../../data/aegisWeaponActionCatalog';
import {
  deriveHexWeaponActions,
  isHexWeaponFamilyId,
} from '../../../data/hexWeaponActionRegistry';
import {
  formatHexWeaponActionLabel,
  getHexWeaponActionDefinition,
} from '../../../data/hexWeaponActionCatalog';
import {
  deriveEnvoyWeaponActions,
  isEnvoyWeaponFamilyId,
} from '../../../data/envoyWeaponActionRegistry';
import {
  formatEnvoyWeaponActionLabel,
  getEnvoyWeaponActionDefinition,
} from '../../../data/envoyWeaponActionCatalog';
import { getEnvoyAbilityTags } from '../../../data/envoyAbilities';
import { sanitizeEnvoyFlexLoadout } from '../../../data/envoyFlexLoadoutEngine';
import { resolveAbilityGuidanceForWeapon } from '../../../data/weaponPlayerFacing/weaponPlayerFacingEngine';
import type { OperativeAbilityId } from '../../../types/weaponLoadoutRecommendation';
import type { WeaponAbilityGuidanceLabel } from '../../../types/weaponPlayerFacing';
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
  | { kind: 'POOL'; abilityId: string }
  | { kind: 'WA'; abilityId: string };

type ReadOnlyWeaponActionCard = {
  id: string;
  label: string;
  costLine: string;
  description: string;
  tagsLine: string;
};

const AEGIS_TECHNIQUE_SLOT_INDICES = [0, 1, 2] as const;

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
  guidanceLine?: string | null;
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
  guidanceLabel: WeaponAbilityGuidanceLabel | null;
  guidanceReason: string | null;
};

export default function DeckWorkspace({
  selection,
  onSelect,
  onInspectChange,
  compact,
}: DeckWorkspaceProps): React.JSX.Element {
  const {
    account,
    setAegisTechniqueLoadout,
    setHexShotLoadout,
    setEnvoyLoadout,
    unlockHexShotAbility,
    unlockEnvoyAbility,
    appendHubLog,
  } = usePlayerAccount();

  /** Local draft may include emptied slots (`null`) until the player refills a valid triple. */
  const [aegisDraft, setAegisDraft] = useState<(AegisTechniqueId | null)[]>([
    ...account.aegisTechniqueLoadout,
  ]);
  const [hexDraft, setHexDraft] = useState<(HexShotAbilityId | null)[]>([...account.hexShotLoadout]);
  const [envoyDraft, setEnvoyDraft] = useState<(EnvoyAbilityId | null)[]>([
    ...sanitizeEnvoyFlexLoadout(account.envoyLoadout),
  ]);

  useEffect(() => { setAegisDraft([...account.aegisTechniqueLoadout]); }, [account.aegisTechniqueLoadout]);
  useEffect(() => { setHexDraft([...account.hexShotLoadout]); }, [account.hexShotLoadout]);
  useEffect(() => {
    setEnvoyDraft([...sanitizeEnvoyFlexLoadout(account.envoyLoadout)]);
  }, [account.envoyLoadout]);

  useEffect(() => {
    if (account.activeClass !== 'AEGIS') return;
    if (aegisDraft.some((id) => id == null)) return;
    if (validateAegisTechniqueLoadoutCommit(aegisDraft as string[])) return;
    const committed: AegisTechniqueLoadout = [
      aegisDraft[0] as AegisTechniqueId,
      aegisDraft[1] as AegisTechniqueId,
      aegisDraft[2] as AegisTechniqueId,
    ];
    if (committed.some((id, index) => id !== account.aegisTechniqueLoadout[index])) {
      setAegisTechniqueLoadout(committed);
    }
  }, [aegisDraft, account.activeClass, account.aegisTechniqueLoadout, setAegisTechniqueLoadout]);

  useEffect(() => {
    if (account.activeClass !== 'HEX_SHOT') return;
    if (hexDraft.some((id) => id == null)) return;
    if (validateHexShotLoadoutCommit(hexDraft as string[], account.unlockedHexShotAbilities)) return;
    const committed: HexShotLoadout = [
      hexDraft[0] as HexShotAbilityId,
      hexDraft[1] as HexShotAbilityId,
      hexDraft[2] as HexShotAbilityId,
    ];
    if (committed.some((id, index) => id !== account.hexShotLoadout[index])) {
      setHexShotLoadout(committed);
    }
  }, [hexDraft, account.activeClass, account.hexShotLoadout, account.unlockedHexShotAbilities, setHexShotLoadout]);

  useEffect(() => {
    if (account.activeClass !== 'ENVOY') return;
    if (envoyDraft.some((id) => id == null)) return;
    if (validateEnvoyLoadoutCommit(envoyDraft as string[], account.unlockedEnvoyAbilities)) return;
    const committed: EnvoyLoadout = [
      envoyDraft[0] as EnvoyFlexAbilityId,
      envoyDraft[1] as EnvoyFlexAbilityId,
      envoyDraft[2] as EnvoyFlexAbilityId,
    ];
    const current = sanitizeEnvoyFlexLoadout(account.envoyLoadout);
    if (committed.some((id, index) => id !== current[index])) {
      setEnvoyLoadout(committed);
    }
  }, [envoyDraft, account.activeClass, account.envoyLoadout, account.unlockedEnvoyAbilities, setEnvoyLoadout]);

  const draft = account.activeClass === 'AEGIS'
    ? aegisDraft
    : account.activeClass === 'HEX_SHOT'
      ? hexDraft
      : envoyDraft;

  const equippedWeaponId = useMemo(
    () => getEquippedWeaponForClass({
      weaponUnlocks: account.weaponUnlocks,
      equippedWeaponByClass: account.equippedWeaponByClass,
    }, account.activeClass),
    [account.activeClass, account.equippedWeaponByClass, account.weaponUnlocks],
  );

  const aegisReadOnlyWeaponActions = useMemo((): ReadOnlyWeaponActionCard[] | null => {
    if (account.activeClass !== 'AEGIS' || !equippedWeaponId) return null;
    if (!isAegisWeaponFamilyId(equippedWeaponId)) return null;
    const actions = deriveAegisWeaponActions(equippedWeaponId);
    if (!actions) return null;
    return actions.map((id) => {
      const def = getAegisWeaponActionDefinition(id);
      return {
        id,
        label: def?.label ?? formatAegisWeaponActionLabel(id),
        costLine: formatClassAbilityCostLine('AEGIS', id) ?? '',
        description: def?.description ?? '',
        tagsLine: aegisWeaponActionTags(id).join(' · '),
      };
    });
  }, [account.activeClass, equippedWeaponId]);

  const hexReadOnlyWeaponActions = useMemo((): ReadOnlyWeaponActionCard[] | null => {
    if (account.activeClass !== 'HEX_SHOT' || !equippedWeaponId) return null;
    if (!isHexWeaponFamilyId(equippedWeaponId)) return null;
    const actions = deriveHexWeaponActions(equippedWeaponId);
    if (!actions) return null;
    return actions.map((id) => {
      const def = getHexWeaponActionDefinition(id);
      return {
        id,
        label: def?.label ?? formatHexWeaponActionLabel(id),
        costLine: formatClassAbilityCostLine('HEX_SHOT', id) ?? '',
        description: def?.description ?? '',
        tagsLine: def?.tags?.join(' · ') ?? 'WEAPON ACTION',
      };
    });
  }, [account.activeClass, equippedWeaponId]);

  const envoyReadOnlyWeaponActions = useMemo((): ReadOnlyWeaponActionCard[] | null => {
    if (account.activeClass !== 'ENVOY' || !equippedWeaponId) return null;
    if (!isEnvoyWeaponFamilyId(equippedWeaponId)) return null;
    const actions = deriveEnvoyWeaponActions(equippedWeaponId);
    if (!actions) return null;
    return actions.map((id) => {
      const def = getEnvoyWeaponActionDefinition(id);
      return {
        id,
        label: def?.displayName ?? formatEnvoyWeaponActionLabel(id),
        costLine: formatClassAbilityCostLine('ENVOY', id) ?? '',
        description: def?.description ?? '',
        tagsLine: getEnvoyAbilityTags(id).join(' · ') || 'WEAPON ACTION',
      };
    });
  }, [account.activeClass, equippedWeaponId]);

  const readOnlyWeaponActions = useMemo(
    () => aegisReadOnlyWeaponActions ?? hexReadOnlyWeaponActions ?? envoyReadOnlyWeaponActions,
    [aegisReadOnlyWeaponActions, hexReadOnlyWeaponActions, envoyReadOnlyWeaponActions],
  );

  const pool: PoolEntry[] = useMemo(() => {
    const withGuidance = (id: string, base: Omit<PoolEntry, 'guidanceLabel' | 'guidanceReason'>): PoolEntry => {
      const guidance = equippedWeaponId
        ? resolveAbilityGuidanceForWeapon(equippedWeaponId, id as OperativeAbilityId)
        : null;
      return {
        ...base,
        guidanceLabel: guidance?.label ?? null,
        guidanceReason: guidance?.reason ?? null,
      };
    };
    if (account.activeClass === 'AEGIS') {
      return getAssignableAbilities().map((id) => {
        const def = getAegisTechniqueDefinition(id);
        const inDeckSlot = aegisDraft.findIndex((entry) => entry === id);
        return withGuidance(id, {
          id,
          label: def.label,
          description: def.description,
          costLine: formatClassAbilityCostLine('AEGIS', id) ?? '',
          tagsLine: def.category === 'BRAND' ? 'BRAND TECHNIQUE' : 'AP UTILITY',
          unlocked: true,
          inDeckSlot: inDeckSlot >= 0 ? inDeckSlot : null,
        });
      });
    }
    if (account.activeClass === 'HEX_SHOT') {
      return getAssignableHexShotAbilities().map((id) => {
        const def = HEX_SHOT_ABILITY_CATALOG[id];
        const inDeckSlot = hexDraft.findIndex((entry) => entry === id);
        return withGuidance(id, {
          id,
          label: def.label,
          description: def.description,
          costLine: formatClassAbilityCostLine('HEX_SHOT', id),
          tagsLine: formatHexShotAbilityTags(id),
          unlocked: isHexShotAbilityUnlocked(account.unlockedHexShotAbilities, id),
          inDeckSlot: inDeckSlot >= 0 ? inDeckSlot : null,
        });
      });
    }
    return getAssignableEnvoyAbilities().map((id) => {
      const def = ENVOY_ABILITY_CATALOG[id];
      const inDeckSlot = envoyDraft.findIndex((entry) => entry === id);
      return withGuidance(id, {
        id,
        label: def.label,
        description: def.description,
        costLine: formatClassAbilityCostLine('ENVOY', id),
        tagsLine: formatEnvoyAbilityTags(id),
        unlocked: isEnvoyAbilityUnlocked(account.unlockedEnvoyAbilities, id),
        inDeckSlot: inDeckSlot >= 0 ? inDeckSlot : null,
      });
    });
  }, [
    account.activeClass,
    account.unlockedAegisAbilities,
    account.unlockedEnvoyAbilities,
    account.unlockedHexShotAbilities,
    aegisDraft,
    envoyDraft,
    equippedWeaponId,
    hexDraft,
  ]);

  const selectedAegisSlot = selection?.kind === 'SLOT'
    && AEGIS_TECHNIQUE_SLOT_INDICES.includes(selection.index as 0 | 1 | 2)
    ? selection.index as 0 | 1 | 2
    : 0;

  /** Hex / Envoy — three editable flex slots at indices 0–2. */
  const selectedHexFlexSlot = selection?.kind === 'SLOT'
    && AEGIS_TECHNIQUE_SLOT_INDICES.includes(selection.index as 0 | 1 | 2)
    ? selection.index as 0 | 1 | 2
    : 0;

  const selectedEnvoyFlexSlot = selection?.kind === 'SLOT'
    && AEGIS_TECHNIQUE_SLOT_INDICES.includes(selection.index as 0 | 1 | 2)
    ? selection.index as 0 | 1 | 2
    : 0;

  const assignToSelectedSlot = useCallback((abilityId: string) => {
    if (account.activeClass === 'AEGIS') {
      if (!isAegisTechniqueId(abilityId)) return;
      setAegisDraft((prev) => {
        const next = [...prev] as (AegisTechniqueId | null)[];
        const existing = next.indexOf(abilityId);
        if (existing >= 0 && existing !== selectedAegisSlot) {
          next[existing] = next[selectedAegisSlot];
        }
        next[selectedAegisSlot] = abilityId;
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
        const next = [...prev] as (HexShotAbilityId | null)[];
        const existing = next.indexOf(id);
        if (existing >= 0 && existing !== selectedHexFlexSlot) {
          next[existing] = next[selectedHexFlexSlot];
        }
        next[selectedHexFlexSlot] = id;
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
      const next = [...prev] as (EnvoyAbilityId | null)[];
      const existing = next.indexOf(id);
      if (existing >= 0 && existing !== selectedEnvoyFlexSlot) {
        next[existing] = next[selectedEnvoyFlexSlot];
      }
      next[selectedEnvoyFlexSlot] = id;
      return next;
    });
  }, [
    account.activeClass,
    account.unlockedEnvoyAbilities,
    account.unlockedHexShotAbilities,
    appendHubLog,
    selectedAegisSlot,
    selectedHexFlexSlot,
    selectedEnvoyFlexSlot,
    unlockEnvoyAbility,
    unlockHexShotAbility,
  ]);

  const removeFromSlot = useCallback((slotIndex: 0 | 1 | 2) => {
    if (account.activeClass === 'AEGIS') {
      setAegisDraft((prev) => {
        const next = [...prev] as (AegisTechniqueId | null)[];
        next[slotIndex] = null;
        return next;
      });
      return;
    }
    if (account.activeClass === 'HEX_SHOT') {
      setHexDraft((prev) => {
        const next = [...prev] as (HexShotAbilityId | null)[];
        next[slotIndex] = null;
        return next;
      });
      return;
    }
    setEnvoyDraft((prev) => {
      const next = [...prev] as (EnvoyAbilityId | null)[];
      next[slotIndex] = null;
      return next;
    });
  }, [account.activeClass]);

  useEffect(() => {
    if (!selection) {
      onSelect({ kind: 'SLOT', index: 0 });
      return;
    }

    if (selection.kind === 'WA') {
      const wa = readOnlyWeaponActions?.find((entry) => entry.id === selection.abilityId);
      onInspectChange({
        title: (wa?.label ?? selection.abilityId).replace(/[\[\]]/g, '').trim(),
        status: 'FIXED · WEAPON ACTION',
        typeLine: account.activeClass.replace(/_/g, ' '),
        costLine: wa?.costLine || '—',
        tags: wa?.tagsLine || 'WEAPON ACTION',
        description: wa?.description
          || 'Fixed weapon action — derived from the equipped chassis. Not editable.',
        slotLine: 'WEAPON ACTIONS',
        guidanceLine: null,
        actions: [{
          label: '[ FIXED WEAPON ACTION ]',
          disabled: true,
          tone: 'muted',
        }],
      });
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
        description: 'Select an ability from the pool, then assign it to this slot.',
        slotLine: `SLOT ${(slotIndex ?? 0) + 1}`,
        guidanceLine: null,
        actions: [],
      });
      return;
    }

    const poolEntry = pool.find((entry) => entry.id === abilityId);
    const assignSlotLabel = (
      account.activeClass === 'AEGIS'
        ? selectedAegisSlot
        : account.activeClass === 'HEX_SHOT'
          ? selectedHexFlexSlot
          : selectedEnvoyFlexSlot
    ) + 1;

    const actions: DeckDossierAction[] = [];
    if (slotIndex != null && selection.kind === 'SLOT') {
      const flexIndex = slotIndex as 0 | 1 | 2;
      actions.push({
        label: `[ REMOVE FROM SLOT ${slotIndex + 1} ]`,
        onPress: () => removeFromSlot(flexIndex),
        tone: 'danger',
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
        if (assignSlotLabel !== poolEntry.inDeckSlot + 1) {
          actions.push({
            label: `[ MOVE TO SLOT ${assignSlotLabel} ]`,
            onPress: () => assignToSelectedSlot(abilityId!),
            tone: 'primary',
          });
        }
      } else {
        actions.push({
          label: `[ ASSIGN TO SLOT ${assignSlotLabel} ]`,
          onPress: () => assignToSelectedSlot(abilityId!),
          tone: 'primary',
        });
      }
    }

    onInspectChange({
      title: (poolEntry?.label ?? abilityId).replace(/[\[\]]/g, '').trim(),
      status: slotIndex != null
        ? `IN DECK · SLOT ${slotIndex + 1}`
        : poolEntry?.unlocked ? 'AVAILABLE' : 'LOCKED',
      typeLine: account.activeClass.replace(/_/g, ' '),
      costLine: poolEntry?.costLine || '—',
      tags: poolEntry?.tagsLine || '—',
      description: poolEntry?.description || '',
      slotLine: slotIndex != null ? `SLOT ${slotIndex + 1}` : 'NOT IN DECK',
      guidanceLine: poolEntry?.guidanceLabel
        ? `${poolEntry.guidanceLabel} — ${poolEntry.guidanceReason ?? 'Supports the equipped chassis loop.'}`
        : null,
      actions,
    });
  }, [
    account.activeClass,
    assignToSelectedSlot,
    draft,
    onInspectChange,
    onSelect,
    pool,
    readOnlyWeaponActions,
    removeFromSlot,
    selectedAegisSlot,
    selectedHexFlexSlot,
    selectedEnvoyFlexSlot,
    selection,
  ]);

  const slotIndices = [0, 1, 2];
  const activeSlots = slotIndices.map((index) => {
    const abilityId = draft[index];
    const entry = abilityId
      ? (pool.find((item) => item.id === abilityId)
        ?? {
          id: abilityId,
          label: abilityId,
          description: '',
          costLine: formatClassAbilityCostLine(account.activeClass, abilityId as never) ?? '',
          tagsLine: '',
          unlocked: true,
          inDeckSlot: index,
          guidanceLabel: null,
          guidanceReason: null,
        })
      : {
        id: 'EMPTY',
        label: 'EMPTY',
        description: '',
        costLine: '',
        tagsLine: '',
        unlocked: true,
        inDeckSlot: index,
        guidanceLabel: null,
        guidanceReason: null,
      };
    const isAnchor = false;
    const selected = selection?.kind === 'SLOT' && selection.index === index;
    return { index: index as 0 | 1 | 2 | 3, entry, isAnchor, selected, abilityId };
  });

  return (
    <View style={styles.root}>
      {readOnlyWeaponActions ? (
        <View style={[styles.activeDeck, compact && styles.activeDeckCompact, { marginBottom: 8 }]}>
          {readOnlyWeaponActions.map((wa) => {
            const selected = selection?.kind === 'WA' && selection.abilityId === wa.id;
            return (
              <HapticPressable
                key={wa.id}
                onPress={() => onSelect({ kind: 'WA', abilityId: wa.id })}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Fixed weapon action ${wa.label}`}
                style={({ pressed }) => ([
                  styles.deckSlot,
                  selected && styles.deckSlotSelected,
                  !selected && { opacity: 0.92 },
                  pressed && { opacity: 0.88 },
                ])}
              >
                {selected ? <OccultNeonRail style={styles.slotAccent} /> : null}
                <View style={styles.slotTopline}>
                  <TerminalText size={7} letterSpacing={0.9} style={styles.slotMeta}>
                    WA
                  </TerminalText>
                  <TerminalText size={7} letterSpacing={0.9} style={{ color: MUTED, fontWeight: '700' }}>
                    FIXED
                  </TerminalText>
                </View>
                <TerminalText size={9.5} letterSpacing={0.3} style={styles.slotTitle} numberOfLines={1}>
                  {wa.label.replace(/[\[\]]/g, '').trim().toUpperCase()}
                </TerminalText>
                <TerminalText size={7.5} style={styles.slotCost} numberOfLines={1}>
                  {wa.costLine || '—'}
                </TerminalText>
              </HapticPressable>
            );
          })}
        </View>
      ) : null}
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
                {account.activeClass === 'AEGIS'
                  ? 'TECHNIQUE'
                  : account.activeClass === 'HEX_SHOT' || account.activeClass === 'ENVOY'
                    ? 'FLEX'
                    : 'ACTIVE'}
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
                  {entry.guidanceLabel ? (
                    <TerminalText size={7} letterSpacing={0.7} style={styles.guidanceChip} numberOfLines={1}>
                      {entry.guidanceLabel}
                    </TerminalText>
                  ) : null}
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
  // Top spacing owned by Loadout catalogHeader (matches Black Market section rhythm).
  feedContent: { paddingHorizontal: 0, paddingTop: 0, paddingBottom: 16 },
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
  guidanceChip: {
    marginTop: 5,
    alignSelf: 'flex-start',
    color: MUTED,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: 'rgba(105, 200, 173, 0.22)',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  signalCost: { marginTop: 4, color: TEXT_SECONDARY, fontVariant: ['tabular-nums'] },
  signalBody: { marginTop: 5, color: TEXT_SECONDARY, lineHeight: 18 },
});
