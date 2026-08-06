import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import SafehouseBg from '../../assets/images/location images/safehouse.png';
import IncursionShell from '../components/IncursionShell';
import IncursionRunLayout from '../components/IncursionRunLayout';
import RunEventImmersiveBackdrop from '../components/layout/RunEventImmersiveBackdrop';
import RunEventNodeHeader from '../components/layout/RunEventNodeHeader';
import RunActionRail from '../components/runField/RunActionRail';
import { RUN_FIELD } from '../theme/runFieldTokens';
import SafehouseTelemetryPanel from '../components/safehouse/SafehouseTelemetryPanel';
import SafehouseBenchPanel, {
  type BenchArsenalEntry,
  type BenchSlotView,
} from '../components/safehouse/SafehouseBenchPanel';
import SafehousePayloadRouter from '../components/safehouse/SafehousePayloadRouter';
import { useRun } from '../context/RunContext';
import { usePlayerAccount } from '../context/PlayerAccountContext';
import { useTerminal } from '../context/TerminalContext';
import { useGameFlow } from '../context/GameFlowContext';
import { useDevSandboxExit } from '../hooks/useDevSandboxExit';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { DISTRICT_NAMES } from '../data/districtPacing';
import { getFactionAccent } from '../data/factions';
import type { AegisAbilityId, AegisLoadout } from '../types/aegisCombat';
import { isAbilityUnlocked, getAssignableAbilities, formatAbilityUnlockCost } from '../data/aegisAbilityUnlockEngine';
import { AEGIS_ABILITY_CATALOG } from '../data/aegisAbilities';
import {
  ENVOY_ANCHOR,
  ENVOY_INTRINSIC,
  getAssignableEnvoyAbilities,
  getAssignableHexShotAbilities,
  HEX_SHOT_ANCHOR,
  HEX_SHOT_INTRINSIC,
  isEnvoyAbilityUnlocked,
  isHexShotAbilityUnlocked,
} from '../data/classAbilityUnlockEngine';
import { ENVOY_ABILITY_CATALOG } from '../data/envoyAbilities';
import { HEX_SHOT_ABILITY_CATALOG } from '../data/hexShotAbilities';
import { sanitizeAegisTechniqueLoadout } from '../utils/aegisLoadoutUtils';
import {
  validateEnvoyLoadoutCommit,
  validateHexShotLoadoutCommit,
} from '../utils/classLoadoutUtils';
import { sanitizeEnvoyFlexLoadout } from '../data/envoyFlexLoadoutEngine';
import type {
  EnvoyAbilityId,
  EnvoyFlexAbilityId,
  EnvoyLoadout,
  HexShotAbilityId,
  HexShotLoadout,
} from '../types/operativeClass';

export default function SafehouseScreen(): React.JSX.Element {
  const { theme } = useTerminal();
  const {
    runState,
    activeIncursion,
    appendRunLog,
    transitionToNextDistrict,
    transferRunCargoToBankVault,
    vaultIncursionVeilResidueToAccount,
    restoreHealthFromBench,
    getSafehouseIntel,
    setAegisTechniqueLoadout,
    setHexShotLoadout,
    setEnvoyLoadout,
    relocateCargoItem,
  } = useRun();
  const {
    account,
    depositVeilResidueBalance,
    setHexShotLoadout: setAccountHexShotLoadout,
    setEnvoyLoadout: setAccountEnvoyLoadout,
    unlockAegisAbility,
    unlockHexShotAbility,
    unlockEnvoyAbility,
  } = usePlayerAccount();
  const { startScanning } = useGameFlow();
  const { exitToDevTestHub } = useDevSandboxExit();
  const { isDesktop, fontScale, gap } = useResponsiveLayout();

  const activeCabal = getFactionAccent(activeIncursion.alignedFaction ?? account.alignedFaction);
  const horizontalPad = 24 * fontScale;

  const [statusLine, setStatusLine] = useState('>> CABAL CHECKPOINT ONLINE — AWAITING OPERATIVE INPUT.');
  const [loadoutDraft, setLoadoutDraft] = useState<AegisAbilityId[]>([
    ...sanitizeAegisTechniqueLoadout(activeIncursion.aegisTechniqueLoadout),
  ]);
  const [hexDraft, setHexDraft] = useState<HexShotAbilityId[]>([...activeIncursion.hexShotLoadout]);
  const [envoyDraft, setEnvoyDraft] = useState<EnvoyAbilityId[]>([
    ...sanitizeEnvoyFlexLoadout(activeIncursion.envoyLoadout),
  ]);
  const [selectedSlot, setSelectedSlot] = useState(0);
  const [loadoutStatus, setLoadoutStatus] = useState<string | null>(null);

  const operativeClass = activeIncursion.activeClass ?? account.activeClass;
  const intel = getSafehouseIntel();
  const nextDistrict = activeIncursion.currentDistrict;
  const hasLockedContainers = account.unidentifiedStash.some((item) => item.state !== 'REVEALED');

  useEffect(() => {
    const { deposited } = vaultIncursionVeilResidueToAccount();
    if (deposited <= 0) return;
    depositVeilResidueBalance(deposited);
    const line = `>> VEIL RESIDUE VAULTED — ${deposited} UNITS SECURED TO OPERATIVE VAULT.`;
    appendRunLog(line);
    setStatusLine(line);
  }, [appendRunLog, depositVeilResidueBalance, vaultIncursionVeilResidueToAccount]);

  useEffect(() => {
    setLoadoutDraft([...sanitizeAegisTechniqueLoadout(activeIncursion.aegisTechniqueLoadout)]);
    setHexDraft([...activeIncursion.hexShotLoadout]);
    setEnvoyDraft([...sanitizeEnvoyFlexLoadout(activeIncursion.envoyLoadout)]);
    setLoadoutStatus(
      operativeClass === 'AEGIS'
        ? '>> AEGIS TECHNIQUES LOCKED AT DESCENT — SAFEHOUSE CANNOT REWRITE SNAPSHOT.'
        : null,
    );
  }, [
    activeIncursion.aegisTechniqueLoadout,
    activeIncursion.hexShotLoadout,
    activeIncursion.envoyLoadout,
    operativeClass,
  ]);

  const healthPct = useMemo(() => {
    if (runState.maxSoulAnchor <= 0) return 0;
    return Math.round((runState.soulAnchorIntegrity / runState.maxSoulAnchor) * 100);
  }, [runState.soulAnchorIntegrity, runState.maxSoulAnchor]);

  const shieldPct = Math.max(0, Math.min(100, healthPct + 8));
  const resonancePct = Math.round(activeIncursion.resonance.percent);

  const commitAegisLoadout = useCallback((_draft: readonly AegisAbilityId[]) => {
    // Phase A contract: technique snapshot is immutable during an active incursion.
    setAegisTechniqueLoadout(_draft as never);
    const locked = '>> AEGIS TECHNIQUES LOCKED — DESCENT SNAPSHOT IMMUTABLE.';
    setLoadoutStatus(locked);
    setStatusLine(locked);
    return false;
  }, [setAegisTechniqueLoadout]);

  const commitHexLoadout = useCallback((draft: readonly HexShotAbilityId[]) => {
    const rejection = validateHexShotLoadoutCommit(draft, account.unlockedHexShotAbilities);
    if (rejection) {
      setLoadoutStatus(rejection);
      setStatusLine(rejection);
      return false;
    }
    const committed: HexShotLoadout = [draft[0], draft[1], draft[2]];
    setHexShotLoadout(committed);
    setAccountHexShotLoadout(committed);
    appendRunLog('>> HEX-SHOT LOADOUT LOCKED — ballistic deck staged for next descent.');
    const success = '>> LOADOUT COMMITTED — COMBAT DECK WILL DEPLOY ON NEXT INCURSION.';
    setLoadoutStatus(success);
    setStatusLine(success);
    return true;
  }, [account.unlockedHexShotAbilities, appendRunLog, setAccountHexShotLoadout, setHexShotLoadout]);

  const commitEnvoyLoadout = useCallback((draft: readonly EnvoyAbilityId[]) => {
    const rejection = validateEnvoyLoadoutCommit(draft, account.unlockedEnvoyAbilities);
    if (rejection) {
      setLoadoutStatus(rejection);
      setStatusLine(rejection);
      return false;
    }
    const committed: EnvoyLoadout = [
      draft[0]! as EnvoyFlexAbilityId,
      draft[1]! as EnvoyFlexAbilityId,
      draft[2]! as EnvoyFlexAbilityId,
    ];
    setEnvoyLoadout(committed);
    setAccountEnvoyLoadout(committed);
    appendRunLog('>> ENVOY LOADOUT LOCKED — three flex abilities staged for next descent.');
    const success = '>> LOADOUT COMMITTED — COMBAT DECK WILL DEPLOY ON NEXT INCURSION.';
    setLoadoutStatus(success);
    setStatusLine(success);
    return true;
  }, [account.unlockedEnvoyAbilities, appendRunLog, setAccountEnvoyLoadout, setEnvoyLoadout]);

  const handleAssignAbility = useCallback((abilityId: string, slotIndex: number) => {
    if (operativeClass === 'AEGIS') {
      // Techniques locked at descent — never rewrite mid-incursion.
      commitAegisLoadout(loadoutDraft);
      return;
    }
    if (operativeClass === 'HEX_SHOT') {
      const id = abilityId as HexShotAbilityId;
      if (HEX_SHOT_INTRINSIC.includes(id) || id === HEX_SHOT_ANCHOR) return;
      if (!isHexShotAbilityUnlocked(account.unlockedHexShotAbilities, id)) return;
      if (slotIndex < 0 || slotIndex > 2) return;
      const next: HexShotAbilityId[] = [...hexDraft];
      next[slotIndex] = id;
      setHexDraft(next);
      commitHexLoadout(next);
      return;
    }
    const id = abilityId as EnvoyAbilityId;
    if (ENVOY_INTRINSIC.includes(id) || id === ENVOY_ANCHOR) return;
    if (!isEnvoyAbilityUnlocked(account.unlockedEnvoyAbilities, id)) return;
    if (slotIndex < 0 || slotIndex > 2) return;
    const next: EnvoyAbilityId[] = [...envoyDraft];
    next[slotIndex] = id;
    setEnvoyDraft(next);
    commitEnvoyLoadout(next);
  }, [
    account.unlockedAegisAbilities,
    account.unlockedEnvoyAbilities,
    account.unlockedHexShotAbilities,
    commitAegisLoadout,
    commitEnvoyLoadout,
    commitHexLoadout,
    envoyDraft,
    hexDraft,
    loadoutDraft,
    operativeClass,
  ]);

  const handleUnlockAbility = useCallback((abilityId: string) => {
    if (operativeClass === 'AEGIS') {
      const result = unlockAegisAbility(abilityId as AegisAbilityId);
      appendRunLog(result.logLine);
      setLoadoutStatus(result.logLine);
      return;
    }
    if (operativeClass === 'HEX_SHOT') {
      const result = unlockHexShotAbility(abilityId as HexShotAbilityId);
      appendRunLog(result.logLine);
      setLoadoutStatus(result.logLine);
      return;
    }
    const result = unlockEnvoyAbility(abilityId as EnvoyAbilityId);
    appendRunLog(result.logLine);
    setLoadoutStatus(result.logLine);
  }, [appendRunLog, operativeClass, unlockAegisAbility, unlockEnvoyAbility, unlockHexShotAbility]);

  const benchSlots = useMemo((): BenchSlotView[] => {
    if (operativeClass === 'AEGIS') {
      return loadoutDraft.map((abilityId, slotIndex) => ({
        slotIndex,
        label: AEGIS_ABILITY_CATALOG[abilityId].label,
        abilityId,
        editable: slotIndex > 0,
        anchor: slotIndex === 0,
      }));
    }
    if (operativeClass === 'HEX_SHOT') {
      return hexDraft.map((abilityId, slotIndex) => ({
        slotIndex,
        label: slotIndex === 0
          ? HEX_SHOT_ABILITY_CATALOG[HEX_SHOT_ANCHOR].label
          : (HEX_SHOT_ABILITY_CATALOG[abilityId]?.label ?? abilityId),
        abilityId,
        editable: slotIndex > 0,
        anchor: slotIndex === 0,
      }));
    }
    return envoyDraft.map((abilityId, slotIndex) => ({
      slotIndex,
      label: ENVOY_ABILITY_CATALOG[abilityId]?.label ?? abilityId,
      abilityId,
      editable: true,
      anchor: false,
    }));
  }, [envoyDraft, hexDraft, loadoutDraft, operativeClass]);

  const benchArsenal = useMemo((): BenchArsenalEntry[] => {
    if (operativeClass === 'AEGIS') {
      return getAssignableAbilities().map((abilityId) => {
        const def = AEGIS_ABILITY_CATALOG[abilityId];
        const unlocked = isAbilityUnlocked(account.unlockedAegisAbilities, abilityId);
        return {
          abilityId,
          label: def.label,
          description: def.description,
          unlocked,
          unlockHint: unlocked ? undefined : `LOCKED // ${formatAbilityUnlockCost(def.unlockCost)}`,
          assignedSlot: loadoutDraft.indexOf(abilityId),
        };
      });
    }
    if (operativeClass === 'HEX_SHOT') {
      return getAssignableHexShotAbilities().map((abilityId) => {
        const def = HEX_SHOT_ABILITY_CATALOG[abilityId];
        const unlocked = isHexShotAbilityUnlocked(account.unlockedHexShotAbilities, abilityId);
        return {
          abilityId,
          label: def.label,
          description: def.description,
          unlocked,
          unlockHint: unlocked ? undefined : `LOCKED // ${formatAbilityUnlockCost(def.unlockCost)}`,
          assignedSlot: hexDraft.indexOf(abilityId),
        };
      });
    }
    return getAssignableEnvoyAbilities().map((abilityId) => {
      const def = ENVOY_ABILITY_CATALOG[abilityId];
      const unlocked = isEnvoyAbilityUnlocked(account.unlockedEnvoyAbilities, abilityId);
      return {
        abilityId,
        label: def.label,
        description: def.description,
        unlocked,
        unlockHint: unlocked ? undefined : `LOCKED // ${formatAbilityUnlockCost(def.unlockCost)}`,
        assignedSlot: envoyDraft.indexOf(abilityId),
      };
    });
  }, [
    account.unlockedAegisAbilities,
    account.unlockedEnvoyAbilities,
    account.unlockedHexShotAbilities,
    envoyDraft,
    hexDraft,
    loadoutDraft,
    operativeClass,
  ]);

  const handleBankCargo = useCallback(() => {
    const result = transferRunCargoToBankVault(100);
    appendRunLog(result.logLine);
    setStatusLine(result.logLine);
  }, [appendRunLog, transferRunCargoToBankVault]);

  const handleBenchRestore = useCallback(() => {
    const result = restoreHealthFromBench();
    appendRunLog(result.logLine);
    setStatusLine(result.logLine);
  }, [appendRunLog, restoreHealthFromBench]);

  const handleUnseal = useCallback(() => {
    if (exitToDevTestHub()) return;
    transitionToNextDistrict();
    startScanning();
  }, [exitToDevTestHub, startScanning, transitionToNextDistrict]);

  return (
    <IncursionShell>
      <IncursionRunLayout hideRunChrome style={{ backgroundColor: '#09090b' }}>
        <RunEventImmersiveBackdrop
          backgroundImage={SafehouseBg}
          scrimOpacity={RUN_FIELD.environmentScrim}
          contentPadding={isDesktop ? 16 * fontScale : 8}
        >
          <View style={styles.stage}>
            <RunEventNodeHeader
              eyebrow="CABAL SAFEHOUSE // CHECKPOINT"
              title={DISTRICT_NAMES[nextDistrict].toUpperCase()}
              subtitle={`Depth ${activeIncursion.currentDistrict - 1} secured`}
              fontScale={fontScale}
              showRunChrome
            />

            <View
              style={[
                styles.masterRow,
                {
                  flexDirection: isDesktop ? 'row' : 'column',
                  paddingHorizontal: horizontalPad,
                  gap,
                },
              ]}
            >
              <SafehouseTelemetryPanel
                healthPct={healthPct}
                shieldPct={shieldPct}
                resonancePct={resonancePct}
                intel={intel}
                activeCabal={activeCabal}
                fontScale={fontScale}
                isDesktop={isDesktop}
                hasLockedContainers={hasLockedContainers}
                onBenchRestore={handleBenchRestore}
                onStatus={setStatusLine}
              />

              <SafehouseBenchPanel
                fontScale={fontScale}
                gap={gap}
                isDesktop={isDesktop}
                slots={benchSlots}
                arsenal={benchArsenal}
                selectedSlot={selectedSlot}
                onSelectSlot={setSelectedSlot}
                onAssign={handleAssignAbility}
                onUnlock={handleUnlockAbility}
                statusMessage={loadoutStatus ?? statusLine}
              />

              <SafehousePayloadRouter
                cargo={activeIncursion.cargo}
                theme={theme}
                activeCabal={activeCabal}
                fontScale={fontScale}
                isDesktop={isDesktop}
                onRelocateItem={relocateCargoItem}
                onBankCargo={handleBankCargo}
              />
            </View>

            <View style={[styles.descentRail, { paddingHorizontal: horizontalPad }]}>
              <RunActionRail
                mode="screen"
                primaryLabel="INITIATE DESCENT"
                onPrimary={handleUnseal}
              />
            </View>
          </View>
        </RunEventImmersiveBackdrop>
      </IncursionRunLayout>
    </IncursionShell>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    justifyContent: 'space-between',
  },
  masterRow: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'stretch',
  },
  descentRail: {
    width: '100%',
    flexShrink: 0,
    paddingBottom: 12,
    paddingTop: 10,
    zIndex: 6,
  },
});
