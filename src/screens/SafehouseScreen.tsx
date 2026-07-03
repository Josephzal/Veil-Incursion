import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import SafehouseBg from '../../assets/images/location images/safehouse.png';
import IncursionShell from '../components/IncursionShell';
import IncursionRunLayout from '../components/IncursionRunLayout';
import RunEventImmersiveBackdrop from '../components/layout/RunEventImmersiveBackdrop';
import RunEventNodeHeader from '../components/layout/RunEventNodeHeader';
import TacticalButton from '../components/TacticalButton';
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
import { validateLoadoutCommit } from '../utils/aegisLoadoutUtils';
import {
  validateEnvoyLoadoutCommit,
  validateHexShotLoadoutCommit,
} from '../utils/classLoadoutUtils';
import type { EnvoyAbilityId, EnvoyLoadout, HexShotAbilityId, HexShotLoadout } from '../types/operativeClass';

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
    setAegisLoadout,
    setHexShotLoadout,
    setEnvoyLoadout,
    relocateCargoItem,
  } = useRun();
  const {
    account,
    depositBankedCargo,
    depositVeilResidueBalance,
    setAegisLoadout: setAccountAegisLoadout,
    setHexShotLoadout: setAccountHexShotLoadout,
    setEnvoyLoadout: setAccountEnvoyLoadout,
    unlockAegisAbility,
    unlockHexShotAbility,
    unlockEnvoyAbility,
  } = usePlayerAccount();
  const { startScanning } = useGameFlow();
  const { exitToDevTestHub } = useDevSandboxExit();
  const { isDesktop, fontScale, gap, screenHeight } = useResponsiveLayout();

  const activeCabal = getFactionAccent(activeIncursion.alignedFaction ?? account.alignedFaction);
  const horizontalPad = 24 * fontScale;
  const panelMinHeight = Math.max(520 * fontScale, screenHeight * 0.58);
  const descentReserve = 128 * fontScale;

  const [statusLine, setStatusLine] = useState('>> CABAL CHECKPOINT ONLINE — AWAITING OPERATIVE INPUT.');
  const [loadoutDraft, setLoadoutDraft] = useState<AegisAbilityId[]>([...activeIncursion.aegisLoadout]);
  const [hexDraft, setHexDraft] = useState<HexShotAbilityId[]>([...activeIncursion.hexShotLoadout]);
  const [envoyDraft, setEnvoyDraft] = useState<EnvoyAbilityId[]>([...activeIncursion.envoyLoadout]);
  const [selectedSlot, setSelectedSlot] = useState(
    () => (activeIncursion.activeClass ?? account.activeClass) === 'AEGIS' ? 0 : 1,
  );
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
    setLoadoutDraft([...activeIncursion.aegisLoadout]);
    setHexDraft([...activeIncursion.hexShotLoadout]);
    setEnvoyDraft([...activeIncursion.envoyLoadout]);
    setLoadoutStatus(null);
  }, [
    activeIncursion.aegisLoadout,
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

  const commitAegisLoadout = useCallback((draft: readonly AegisAbilityId[]) => {
    const rejection = validateLoadoutCommit(draft, account.unlockedAegisAbilities);
    if (rejection) {
      setLoadoutStatus(rejection);
      setStatusLine(rejection);
      return false;
    }
    const committed: AegisLoadout = [draft[0], draft[1], draft[2], draft[3]];
    setAegisLoadout(committed);
    setAccountAegisLoadout(committed);
    appendRunLog('>> AEGIS LOADOUT LOCKED — four active abilities staged for next descent.');
    const success = '>> LOADOUT COMMITTED — COMBAT DECK WILL DEPLOY ON NEXT INCURSION.';
    setLoadoutStatus(success);
    setStatusLine(success);
    return true;
  }, [account.unlockedAegisAbilities, appendRunLog, setAccountAegisLoadout, setAegisLoadout]);

  const commitHexLoadout = useCallback((draft: readonly HexShotAbilityId[]) => {
    const rejection = validateHexShotLoadoutCommit(draft, account.unlockedHexShotAbilities);
    if (rejection) {
      setLoadoutStatus(rejection);
      setStatusLine(rejection);
      return false;
    }
    const committed: HexShotLoadout = [draft[0], draft[1], draft[2], draft[3]];
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
    const committed: EnvoyLoadout = [draft[0], draft[1], draft[2], draft[3]];
    setEnvoyLoadout(committed);
    setAccountEnvoyLoadout(committed);
    appendRunLog('>> ENVOY LOADOUT LOCKED — spell deck staged for next descent.');
    const success = '>> LOADOUT COMMITTED — COMBAT DECK WILL DEPLOY ON NEXT INCURSION.';
    setLoadoutStatus(success);
    setStatusLine(success);
    return true;
  }, [account.unlockedEnvoyAbilities, appendRunLog, setAccountEnvoyLoadout, setEnvoyLoadout]);

  const handleAssignAbility = useCallback((abilityId: string, slotIndex: number) => {
    if (operativeClass === 'AEGIS') {
      const id = abilityId as AegisAbilityId;
      if (id === 'EVISCERATE') return;
      if (!isAbilityUnlocked(account.unlockedAegisAbilities, id)) return;
      const next = [...loadoutDraft];
      next[slotIndex] = id;
      setLoadoutDraft(next);
      commitAegisLoadout(next);
      return;
    }
    if (operativeClass === 'HEX_SHOT') {
      const id = abilityId as HexShotAbilityId;
      if (HEX_SHOT_INTRINSIC.includes(id) || id === HEX_SHOT_ANCHOR || slotIndex === 0) return;
      if (!isHexShotAbilityUnlocked(account.unlockedHexShotAbilities, id)) return;
      const next: HexShotAbilityId[] = [...hexDraft];
      next[slotIndex] = id;
      setHexDraft(next);
      commitHexLoadout(next);
      return;
    }
    const id = abilityId as EnvoyAbilityId;
    if (ENVOY_INTRINSIC.includes(id) || id === ENVOY_ANCHOR || slotIndex === 0) return;
    if (!isEnvoyAbilityUnlocked(account.unlockedEnvoyAbilities, id)) return;
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
        editable: true,
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
      label: slotIndex === 0
        ? ENVOY_ABILITY_CATALOG[ENVOY_ANCHOR].label
        : (ENVOY_ABILITY_CATALOG[abilityId]?.label ?? abilityId),
      abilityId,
      editable: slotIndex > 0,
      anchor: slotIndex === 0,
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
    if (result.success && 'transferredValue' in result && result.transferredValue) {
      depositBankedCargo({
        totalValue: result.transferredValue,
        lastTransferValue: result.transferredValue,
      });
    }
  }, [appendRunLog, depositBankedCargo, transferRunCargoToBankVault]);

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
          scrimOpacity={0.85}
          contentPadding={isDesktop ? 16 * fontScale : 8}
        >
          <View style={styles.stage}>
            <RunEventNodeHeader
              title="CABAL SAFEHOUSE"
              subtitle={`DEPTH ${activeIncursion.currentDistrict - 1} SECURED — PREPARE FOR ${DISTRICT_NAMES[nextDistrict].toUpperCase()}`}
              fontScale={fontScale}
            />

            <View
              style={[
                styles.masterRow,
                {
                  flexDirection: isDesktop ? 'row' : 'column',
                  paddingHorizontal: horizontalPad,
                  paddingBottom: descentReserve,
                  gap,
                  minHeight: panelMinHeight,
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
                activeCabal={activeCabal}
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

            <View
              style={[
                styles.floatingDescentWrap,
                {
                  bottom: 16 * fontScale,
                  paddingHorizontal: horizontalPad,
                },
              ]}
            >
              <TacticalButton
                label="[ INITIATE DESCENT ]"
                active
                onPress={handleUnseal}
                accentColor={activeCabal}
                mutedColor="#94A3B8"
                variant="cta"
                style={[
                  styles.unsealBtn,
                  {
                    borderColor: activeCabal,
                    borderLeftColor: activeCabal,
                    borderRightColor: activeCabal,
                    backgroundColor: 'rgba(9, 9, 11, 0.95)',
                  },
                  Platform.select({
                    web: { boxShadow: `0 8px 32px rgba(0, 0, 0, 0.65), 0 0 24px ${activeCabal}33` },
                    default: {
                      elevation: 12,
                      shadowColor: '#000',
                      shadowOpacity: 0.55,
                      shadowRadius: 16,
                      shadowOffset: { width: 0, height: 6 },
                    },
                  }),
                ]}
                labelSize={12 * fontScale}
                labelLineHeight={15 * fontScale}
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
  },
  masterRow: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'stretch',
  },
  floatingDescentWrap: {
    position: 'absolute',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 600,
    zIndex: 10,
  },
  unsealBtn: {
    width: '100%',
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRightWidth: 4,
  },
});
