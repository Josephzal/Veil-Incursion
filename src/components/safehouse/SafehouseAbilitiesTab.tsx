import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AegisLoadoutEditor from '../AegisLoadoutEditor';
import ClassLoadoutEditor from '../ClassLoadoutEditor';
import { SELECT_ACCENT } from '../../constants/dossierSurface';
import { usePlayerAccount } from '../../context/PlayerAccountContext';
import { useTerminal } from '../../context/TerminalContext';
import { isAbilityUnlocked } from '../../data/aegisAbilityUnlockEngine';
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
import type { AegisAbilityId, AegisLoadout } from '../../types/aegisCombat';
import type { EnvoyAbilityId, EnvoyLoadout, HexShotAbilityId, HexShotLoadout } from '../../types/operativeClass';
import { validateLoadoutCommit } from '../../utils/aegisLoadoutUtils';
import {
  validateEnvoyLoadoutCommit,
  validateHexShotLoadoutCommit,
} from '../../utils/classLoadoutUtils';

export default function SafehouseAbilitiesTab(): React.JSX.Element {
  const { theme } = useTerminal();
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
  const [selectedSlot, setSelectedSlot] = useState<0 | 1 | 2 | 3>(0);
  const [selectedFlexSlot, setSelectedFlexSlot] = useState<1 | 2 | 3>(1);
  const [loadoutStatus, setLoadoutStatus] = useState<string | null>(null);

  useEffect(() => {
    setAegisDraft([...account.aegisLoadout]);
  }, [account.aegisLoadout]);

  useEffect(() => {
    setHexDraft([...account.hexShotLoadout]);
  }, [account.hexShotLoadout]);

  useEffect(() => {
    setEnvoyDraft([...account.envoyLoadout]);
  }, [account.envoyLoadout]);

  // Auto-save: persist a valid draft immediately so the player never manages a save state.
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

  const editorTheme = {
    accentColor: SELECT_ACCENT,
    borderColor: theme.borderColor,
    mutedColor: theme.mutedColor,
    textColor: theme.textColor,
  };

  const assignAegisAbility = useCallback((abilityId: AegisAbilityId) => {
    if (abilityId === 'EVISCERATE') return;
    if (!isAbilityUnlocked(account.unlockedAegisAbilities, abilityId)) {
      setLoadoutStatus(`>> ${abilityId.replace(/_/g, ' ')} NOT UNLOCKED — DECRYPT PROTOCOL FIRST.`);
      return;
    }
    setAegisDraft((prev) => {
      const next = [...prev];
      next[selectedSlot] = abilityId;
      return next;
    });
    setLoadoutStatus(null);
  }, [account.unlockedAegisAbilities, selectedSlot]);

  const assignHexAbility = useCallback((abilityId: HexShotAbilityId) => {
    if (HEX_SHOT_INTRINSIC.includes(abilityId) || abilityId === HEX_SHOT_ANCHOR) return;
    if (!isHexShotAbilityUnlocked(account.unlockedHexShotAbilities, abilityId)) {
      setLoadoutStatus(`>> ${abilityId.replace(/_/g, ' ')} NOT UNLOCKED — DECRYPT PROTOCOL FIRST.`);
      return;
    }
    setHexDraft((prev) => {
      const next: HexShotAbilityId[] = [...prev];
      next[selectedFlexSlot] = abilityId;
      return next;
    });
    setLoadoutStatus(null);
  }, [account.unlockedHexShotAbilities, selectedFlexSlot]);

  const assignEnvoyAbility = useCallback((abilityId: EnvoyAbilityId) => {
    if (ENVOY_INTRINSIC.includes(abilityId) || abilityId === ENVOY_ANCHOR) return;
    if (!isEnvoyAbilityUnlocked(account.unlockedEnvoyAbilities, abilityId)) {
      setLoadoutStatus(`>> ${abilityId.replace(/_/g, ' ')} NOT UNLOCKED — DECRYPT PROTOCOL FIRST.`);
      return;
    }
    setEnvoyDraft((prev) => {
      const next: EnvoyAbilityId[] = [...prev];
      next[selectedFlexSlot] = abilityId;
      return next;
    });
    setLoadoutStatus(null);
  }, [account.unlockedEnvoyAbilities, selectedFlexSlot]);

  const commitAegisLoadout = useCallback(() => {
    const rejection = validateLoadoutCommit(aegisDraft, account.unlockedAegisAbilities);
    if (rejection) {
      setLoadoutStatus(rejection);
      return;
    }
    const committed: AegisLoadout = [aegisDraft[0], aegisDraft[1], aegisDraft[2], aegisDraft[3]];
    setAegisLoadout(committed);
    appendHubLog('>> AEGIS LOADOUT LOCKED — combat deck staged for next incursion.');
    setLoadoutStatus('>> LOADOUT COMMITTED — CARRIES INTO NEXT RUN.');
  }, [aegisDraft, account.unlockedAegisAbilities, appendHubLog, setAegisLoadout]);

  const commitHexLoadout = useCallback(() => {
    const rejection = validateHexShotLoadoutCommit(hexDraft, account.unlockedHexShotAbilities);
    if (rejection) {
      setLoadoutStatus(rejection);
      return;
    }
    const committed: HexShotLoadout = [hexDraft[0], hexDraft[1], hexDraft[2], hexDraft[3]];
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
    const committed: EnvoyLoadout = [envoyDraft[0], envoyDraft[1], envoyDraft[2], envoyDraft[3]];
    setEnvoyLoadout(committed);
    appendHubLog('>> ENVOY LOADOUT LOCKED — spell deck staged for next incursion.');
    setLoadoutStatus('>> LOADOUT COMMITTED — CARRIES INTO NEXT RUN.');
  }, [account.unlockedEnvoyAbilities, appendHubLog, envoyDraft, setEnvoyLoadout]);

  return (
    <>
        {account.activeClass === 'AEGIS' ? (
          <AegisLoadoutEditor
            draft={aegisDraft}
            selectedSlot={selectedSlot}
            onSelectSlot={setSelectedSlot}
            onAssignAbility={assignAegisAbility}
            onUnlockAbility={(abilityId) => {
              const result = unlockAegisAbility(abilityId);
              appendHubLog(result.logLine);
              setLoadoutStatus(result.logLine);
            }}
            onCommit={commitAegisLoadout}
            unlockedAbilities={account.unlockedAegisAbilities}
            resourceStash={account.resourceStash}
            theme={editorTheme}
            title=""
            hint=""
            commitLabel="[ SAVE LOADOUT FOR NEXT RUN ]"
            statusMessage={loadoutStatus}
            hideCommit
          />
        ) : null}

        {account.activeClass === 'HEX_SHOT' ? (
          <ClassLoadoutEditor
            draft={hexDraft}
            anchorId={HEX_SHOT_ANCHOR}
            anchorLabel={HEX_SHOT_ABILITY_CATALOG[HEX_SHOT_ANCHOR].label}
            anchorCostLine={formatClassAbilityCostLine('HEX_SHOT', HEX_SHOT_ANCHOR)}
            assignableIds={getAssignableHexShotAbilities()}
            catalog={hexCatalog}
            selectedSlot={selectedFlexSlot}
            onSelectSlot={setSelectedFlexSlot}
            onAssignAbility={assignHexAbility}
            onUnlockAbility={(abilityId) => {
              const result = unlockHexShotAbility(abilityId);
              appendHubLog(result.logLine);
              setLoadoutStatus(result.logLine);
            }}
            onCommit={commitHexLoadout}
            unlockedAbilities={account.unlockedHexShotAbilities}
            isUnlocked={(id) => isHexShotAbilityUnlocked(account.unlockedHexShotAbilities, id)}
            resourceStash={account.resourceStash}
            theme={editorTheme}
            title=""
            hint=""
            commitLabel="[ SAVE LOADOUT FOR NEXT RUN ]"
            statusMessage={loadoutStatus}
            hideCommit
          />
        ) : null}

        {account.activeClass === 'ENVOY' ? (
          <ClassLoadoutEditor
            draft={envoyDraft}
            anchorId={ENVOY_ANCHOR}
            anchorLabel={ENVOY_ABILITY_CATALOG[ENVOY_ANCHOR].label}
            assignableIds={getAssignableEnvoyAbilities()}
            catalog={envoyCatalog}
            selectedSlot={selectedFlexSlot}
            onSelectSlot={setSelectedFlexSlot}
            onAssignAbility={assignEnvoyAbility}
            onUnlockAbility={(abilityId) => {
              const result = unlockEnvoyAbility(abilityId);
              appendHubLog(result.logLine);
              setLoadoutStatus(result.logLine);
            }}
            onCommit={commitEnvoyLoadout}
            unlockedAbilities={account.unlockedEnvoyAbilities}
            isUnlocked={(id) => isEnvoyAbilityUnlocked(account.unlockedEnvoyAbilities, id)}
            resourceStash={account.resourceStash}
            theme={editorTheme}
            title=""
            hint=""
            anchorCostLine={formatClassAbilityCostLine('ENVOY', ENVOY_ANCHOR)}
            commitLabel="[ SAVE LOADOUT FOR NEXT RUN ]"
            statusMessage={loadoutStatus}
            hideCommit
          />
        ) : null}
    </>
  );
}
