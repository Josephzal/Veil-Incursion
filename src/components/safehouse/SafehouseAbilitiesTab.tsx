import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AegisLoadoutEditor from '../AegisLoadoutEditor';
import ClassLoadoutEditor from '../ClassLoadoutEditor';
import { SELECT_ACCENT } from '../../constants/dossierSurface';
import { usePlayerAccount } from '../../context/PlayerAccountContext';
import { useTerminal } from '../../context/TerminalContext';
import { getAssignableAbilities } from '../../data/aegisAbilityUnlockEngine';
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
} from '../../data/classAbilityUnlockEngine';
import { ENVOY_ABILITY_CATALOG } from '../../data/envoyAbilities';
import { HEX_SHOT_ABILITY_CATALOG } from '../../data/hexShotAbilities';
import { formatClassAbilityCostLine } from '../../data/classAbilityResolver';
import { getAegisTechniqueDefinition, isAegisTechniqueId } from '../../data/aegisTechniqueCatalog';
import {
  deriveHexWeaponActions,
  isHexWeaponFamilyId,
} from '../../data/hexWeaponActionRegistry';
import {
  formatHexWeaponActionLabel,
  getHexWeaponActionDefinition,
} from '../../data/hexWeaponActionCatalog';
import {
  deriveEnvoyWeaponActions,
  isEnvoyWeaponFamilyId,
} from '../../data/envoyWeaponActionRegistry';
import {
  formatEnvoyWeaponActionLabel,
  getEnvoyWeaponActionDefinition,
} from '../../data/envoyWeaponActionCatalog';
import { sanitizeEnvoyFlexLoadout } from '../../data/envoyFlexLoadoutEngine';
import { getEquippedWeaponForClass } from '../../data/weaponProgressionEngine';
import type { AegisTechniqueId, AegisTechniqueLoadout } from '../../types/aegisCombat';
import type {
  EnvoyAbilityId,
  EnvoyFlexAbilityId,
  EnvoyLoadout,
  HexShotAbilityId,
  HexShotLoadout,
} from '../../types/operativeClass';
import {
  validateAegisTechniqueLoadoutCommit,
} from '../../utils/aegisLoadoutUtils';
import {
  validateEnvoyLoadoutCommit,
  validateHexShotLoadoutCommit,
} from '../../utils/classLoadoutUtils';

export default function SafehouseAbilitiesTab(): React.JSX.Element {
  const { theme } = useTerminal();
  const {
    account,
    setAegisTechniqueLoadout,
    setHexShotLoadout,
    setEnvoyLoadout,
    unlockHexShotAbility,
    unlockEnvoyAbility,
    appendHubLog,
  } = usePlayerAccount();

  const [aegisDraft, setAegisDraft] = useState<AegisTechniqueId[]>([...account.aegisTechniqueLoadout]);
  const [hexDraft, setHexDraft] = useState<HexShotAbilityId[]>([...account.hexShotLoadout]);
  const [envoyDraft, setEnvoyDraft] = useState<EnvoyAbilityId[]>([
    ...sanitizeEnvoyFlexLoadout(account.envoyLoadout),
  ]);
  const [selectedSlot, setSelectedSlot] = useState<0 | 1 | 2>(0);
  const [loadoutStatus, setLoadoutStatus] = useState<string | null>(null);

  useEffect(() => {
    setAegisDraft([...account.aegisTechniqueLoadout]);
  }, [account.aegisTechniqueLoadout]);

  useEffect(() => {
    setHexDraft([...account.hexShotLoadout]);
  }, [account.hexShotLoadout]);

  useEffect(() => {
    setEnvoyDraft([...sanitizeEnvoyFlexLoadout(account.envoyLoadout)]);
  }, [account.envoyLoadout]);

  useEffect(() => {
    if (account.activeClass !== 'AEGIS') return;
    if (validateAegisTechniqueLoadoutCommit(aegisDraft)) return;
    const committed: AegisTechniqueLoadout = [aegisDraft[0]!, aegisDraft[1]!, aegisDraft[2]!];
    if (committed.some((id, index) => id !== account.aegisTechniqueLoadout[index])) {
      setAegisTechniqueLoadout(committed);
    }
  }, [
    aegisDraft,
    account.activeClass,
    account.aegisTechniqueLoadout,
    setAegisTechniqueLoadout,
  ]);

  useEffect(() => {
    if (account.activeClass !== 'HEX_SHOT') return;
    if (validateHexShotLoadoutCommit(hexDraft, account.unlockedHexShotAbilities)) return;
    const committed: HexShotLoadout = [hexDraft[0]!, hexDraft[1]!, hexDraft[2]!];
    if (committed.some((id, index) => id !== account.hexShotLoadout[index])) {
      setHexShotLoadout(committed);
    }
  }, [hexDraft, account.activeClass, account.hexShotLoadout, account.unlockedHexShotAbilities, setHexShotLoadout]);

  useEffect(() => {
    if (account.activeClass !== 'ENVOY') return;
    if (validateEnvoyLoadoutCommit(envoyDraft, account.unlockedEnvoyAbilities)) return;
    const committed: EnvoyLoadout = [
      envoyDraft[0]! as EnvoyFlexAbilityId,
      envoyDraft[1]! as EnvoyFlexAbilityId,
      envoyDraft[2]! as EnvoyFlexAbilityId,
    ];
    const current = sanitizeEnvoyFlexLoadout(account.envoyLoadout);
    if (committed.some((id, index) => id !== current[index])) {
      setEnvoyLoadout(committed);
    }
  }, [envoyDraft, account.activeClass, account.envoyLoadout, account.unlockedEnvoyAbilities, setEnvoyLoadout]);

  const hexCatalog = useMemo(
    () => Object.fromEntries(
      getAssignableHexShotAbilities().map((id) => [
        id,
        {
          label: HEX_SHOT_ABILITY_CATALOG[id].label,
          description: HEX_SHOT_ABILITY_CATALOG[id].description,
          unlockCost: HEX_SHOT_ABILITY_CATALOG[id].unlockCost,
          tagsLine: formatHexShotAbilityTags(id),
          costLine: formatClassAbilityCostLine('HEX_SHOT', id),
        },
      ]),
    ),
    [],
  );

  const hexReadOnlyWeaponActions = useMemo(() => {
    if (account.activeClass !== 'HEX_SHOT') return undefined;
    const familyId = getEquippedWeaponForClass({
      weaponUnlocks: account.weaponUnlocks,
      weaponTiers: account.weaponTiers,
      equippedWeaponByClass: account.equippedWeaponByClass,
    }, 'HEX_SHOT');
    if (!isHexWeaponFamilyId(familyId)) return undefined;
    const actions = deriveHexWeaponActions(familyId);
    if (!actions) return undefined;
    return actions.map((id) => {
      const def = getHexWeaponActionDefinition(id);
      return {
        id,
        label: def?.label ?? formatHexWeaponActionLabel(id),
        costLine: formatClassAbilityCostLine('HEX_SHOT', id) ?? '',
        description: def?.description ?? 'Fixed weapon action.',
      };
    });
  }, [
    account.activeClass,
    account.equippedWeaponByClass,
    account.weaponTiers,
    account.weaponUnlocks,
  ]);

  const envoyCatalog = useMemo(
    () => Object.fromEntries(
      getAssignableEnvoyAbilities().map((id) => [
        id,
        {
          label: ENVOY_ABILITY_CATALOG[id].label,
          description: ENVOY_ABILITY_CATALOG[id].description,
          unlockCost: ENVOY_ABILITY_CATALOG[id].unlockCost,
          tagsLine: formatEnvoyAbilityTags(id),
          costLine: formatClassAbilityCostLine('ENVOY', id),
        },
      ]),
    ),
    [],
  );

  const envoyReadOnlyWeaponActions = useMemo(() => {
    if (account.activeClass !== 'ENVOY') return undefined;
    const familyId = getEquippedWeaponForClass({
      weaponUnlocks: account.weaponUnlocks,
      weaponTiers: account.weaponTiers,
      equippedWeaponByClass: account.equippedWeaponByClass,
    }, 'ENVOY');
    if (!isEnvoyWeaponFamilyId(familyId)) return undefined;
    const actions = deriveEnvoyWeaponActions(familyId);
    if (!actions) return undefined;
    return actions.map((id) => {
      const def = getEnvoyWeaponActionDefinition(id);
      return {
        id,
        label: def?.label ?? formatEnvoyWeaponActionLabel(id),
        costLine: formatClassAbilityCostLine('ENVOY', id) ?? '',
        description: def?.description ?? 'Fixed weapon action.',
      };
    });
  }, [
    account.activeClass,
    account.equippedWeaponByClass,
    account.weaponTiers,
    account.weaponUnlocks,
  ]);

  const editorTheme = {
    accentColor: SELECT_ACCENT,
    borderColor: theme.borderColor,
    mutedColor: theme.mutedColor,
    textColor: theme.textColor,
  };

  const assignAegisTechnique = useCallback((abilityId: string) => {
    if (!isAegisTechniqueId(abilityId)) {
      setLoadoutStatus('>> ONLY SHARED TECHNIQUES MAY FILL THESE SLOTS.');
      return;
    }
    setAegisDraft((prev) => {
      const next = [...prev] as AegisTechniqueId[];
      // Swap if already equipped elsewhere.
      const existing = next.indexOf(abilityId);
      if (existing >= 0 && existing !== selectedSlot) {
        next[existing] = next[selectedSlot]!;
      }
      next[selectedSlot] = abilityId;
      return next;
    });
    setLoadoutStatus(null);
  }, [selectedSlot]);

  const assignHexAbility = useCallback((abilityId: HexShotAbilityId) => {
    if (HEX_SHOT_INTRINSIC.includes(abilityId) || abilityId === HEX_SHOT_ANCHOR) return;
    if (!isHexShotAbilityUnlocked(account.unlockedHexShotAbilities, abilityId)) {
      setLoadoutStatus(`>> ${abilityId.replace(/_/g, ' ')} NOT UNLOCKED — DECRYPT PROTOCOL FIRST.`);
      return;
    }
    setHexDraft((prev) => {
      const next: HexShotAbilityId[] = [...prev];
      const existing = next.indexOf(abilityId);
      if (existing >= 0 && existing !== selectedSlot) {
        next[existing] = next[selectedSlot]!;
      }
      next[selectedSlot] = abilityId;
      return next;
    });
    setLoadoutStatus(null);
  }, [account.unlockedHexShotAbilities, selectedSlot]);

  const assignEnvoyAbility = useCallback((abilityId: EnvoyAbilityId) => {
    if (ENVOY_INTRINSIC.includes(abilityId) || abilityId === ENVOY_ANCHOR) return;
    if (!isEnvoyAbilityUnlocked(account.unlockedEnvoyAbilities, abilityId)) {
      setLoadoutStatus(`>> ${abilityId.replace(/_/g, ' ')} NOT UNLOCKED — DECRYPT PROTOCOL FIRST.`);
      return;
    }
    setEnvoyDraft((prev) => {
      const next: EnvoyAbilityId[] = [...prev];
      const existing = next.indexOf(abilityId);
      if (existing >= 0 && existing !== selectedSlot) {
        next[existing] = next[selectedSlot]!;
      }
      next[selectedSlot] = abilityId;
      return next;
    });
    setLoadoutStatus(null);
  }, [account.unlockedEnvoyAbilities, selectedSlot]);

  const commitAegisLoadout = useCallback(() => {
    const rejection = validateAegisTechniqueLoadoutCommit(aegisDraft);
    if (rejection) {
      setLoadoutStatus(rejection);
      return;
    }
    const committed: AegisTechniqueLoadout = [aegisDraft[0]!, aegisDraft[1]!, aegisDraft[2]!];
    setAegisTechniqueLoadout(committed);
    appendHubLog('>> AEGIS TECHNIQUES LOCKED — three techniques staged for next descent.');
    setLoadoutStatus('>> LOADOUT COMMITTED — CARRIES INTO NEXT RUN.');
  }, [aegisDraft, appendHubLog, setAegisTechniqueLoadout]);

  const commitHexLoadout = useCallback(() => {
    const rejection = validateHexShotLoadoutCommit(hexDraft, account.unlockedHexShotAbilities);
    if (rejection) {
      setLoadoutStatus(rejection);
      return;
    }
    const committed: HexShotLoadout = [hexDraft[0], hexDraft[1], hexDraft[2]];
    setHexShotLoadout(committed);
    appendHubLog('>> HEX-SHOT LOADOUT LOCKED — ballistic deck staged for next incursion.');
    setLoadoutStatus('>> LOADOUT COMMITTED — CARRIES INTO NEXT RUN.');
  }, [account.unlockedHexShotAbilities, appendHubLog, hexDraft, setHexShotLoadout]);

  const commitEnvoyLoadout = useCallback(() => {
    const rejection = validateEnvoyLoadoutCommit(envoyDraft, account.unlockedEnvoyAbilities);
    if (rejection) {
      setLoadoutStatus(rejection);
      return;
    }
    const committed: EnvoyLoadout = [
      envoyDraft[0]! as EnvoyFlexAbilityId,
      envoyDraft[1]! as EnvoyFlexAbilityId,
      envoyDraft[2]! as EnvoyFlexAbilityId,
    ];
    setEnvoyLoadout(committed);
    appendHubLog('>> ENVOY LOADOUT LOCKED — three flex abilities staged for next incursion.');
    setLoadoutStatus('>> LOADOUT COMMITTED — CARRIES INTO NEXT RUN.');
  }, [account.unlockedEnvoyAbilities, appendHubLog, envoyDraft, setEnvoyLoadout]);

  const techniquePoolIds = useMemo(() => getAssignableAbilities(), []);

  return (
    <>
        {account.activeClass === 'AEGIS' ? (
          <AegisLoadoutEditor
            draft={aegisDraft}
            selectedSlot={selectedSlot}
            onSelectSlot={(slot) => setSelectedSlot(slot as 0 | 1 | 2)}
            onAssignAbility={assignAegisTechnique}
            onCommit={commitAegisLoadout}
            theme={editorTheme}
            unlockedAbilities={[...techniquePoolIds]}
            resourceStash={account.resourceStash}
            title="AEGIS TECHNIQUES // 3 OF 12"
            hint="Select three techniques. At least one Brand technique required. Weapon actions and Ultimate derive from equipped weapon."
            commitLabel="[ COMMIT TECHNIQUES ]"
            statusMessage={loadoutStatus}
            hideCommit
            techniqueMode
            techniquePool={techniquePoolIds.map((id) => ({
              id,
              label: getAegisTechniqueDefinition(id).label,
              description: getAegisTechniqueDefinition(id).description,
            }))}
          />
        ) : null}

        {account.activeClass === 'HEX_SHOT' ? (
          <ClassLoadoutEditor
            draft={hexDraft}
            anchorId={HEX_SHOT_ANCHOR}
            anchorLabel={HEX_SHOT_ABILITY_CATALOG[HEX_SHOT_ANCHOR].label}
            assignableIds={getAssignableHexShotAbilities()}
            catalog={hexCatalog}
            selectedSlot={selectedSlot}
            onSelectSlot={(slot) => setSelectedSlot(slot as 0 | 1 | 2)}
            onAssignAbility={assignHexAbility}
            onCommit={commitHexLoadout}
            theme={editorTheme}
            unlockedAbilities={account.unlockedHexShotAbilities}
            isUnlocked={(id) => isHexShotAbilityUnlocked(account.unlockedHexShotAbilities, id)}
            resourceStash={account.resourceStash}
            onUnlockAbility={(id) => {
              const result = unlockHexShotAbility(id);
              appendHubLog(result.logLine);
              setLoadoutStatus(result.logLine);
            }}
            statusMessage={loadoutStatus}
            hideCommit
            flexOnly
            readOnlyWeaponActions={hexReadOnlyWeaponActions}
            title="HEX FLEX // 3 OF 11"
            hint="Select three flex abilities. Weapon actions derive from the equipped family (Revolver kit live in W.2)."
          />
        ) : null}

        {account.activeClass === 'ENVOY' ? (
          <ClassLoadoutEditor
            draft={envoyDraft}
            anchorId={ENVOY_ANCHOR}
            anchorLabel={ENVOY_ABILITY_CATALOG[ENVOY_ANCHOR].label}
            assignableIds={getAssignableEnvoyAbilities()}
            catalog={envoyCatalog}
            selectedSlot={selectedSlot}
            onSelectSlot={(slot) => setSelectedSlot(slot as 0 | 1 | 2)}
            onAssignAbility={assignEnvoyAbility}
            onCommit={commitEnvoyLoadout}
            theme={editorTheme}
            unlockedAbilities={account.unlockedEnvoyAbilities}
            isUnlocked={(id) => isEnvoyAbilityUnlocked(account.unlockedEnvoyAbilities, id)}
            resourceStash={account.resourceStash}
            onUnlockAbility={(id) => {
              const result = unlockEnvoyAbility(id);
              appendHubLog(result.logLine);
              setLoadoutStatus(result.logLine);
            }}
            statusMessage={loadoutStatus}
            hideCommit
            flexOnly
            readOnlyWeaponActions={envoyReadOnlyWeaponActions}
            title="ENVOY FLEX // 3 OF 11"
            hint="Select three flex abilities. Weapon actions derive from the equipped family. Rift Ward and Ultimates stay outside the strip."
          />
        ) : null}
    </>
  );
}
