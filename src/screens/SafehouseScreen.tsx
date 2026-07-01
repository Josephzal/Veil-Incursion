import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import HapticPressable from '../components/HapticPressable';
import IncursionShell from '../components/IncursionShell';
import DecryptionPanel from '../components/DecryptionPanel';
import IncursionRunLayout from '../components/IncursionRunLayout';
import RunEventScreenFrame from '../components/layout/RunEventScreenFrame';
import AegisLoadoutEditor from '../components/AegisLoadoutEditor';
import ClassLoadoutEditor from '../components/ClassLoadoutEditor';
import { useRun } from '../context/RunContext';
import { usePlayerAccount } from '../context/PlayerAccountContext';
import { useTerminal } from '../context/TerminalContext';
import { useGameFlow } from '../context/GameFlowContext';
import { useDevSandboxExit } from '../hooks/useDevSandboxExit';
import { calculateCargoMarketValue, calculateGridOccupancy } from '../data/cargoGridEngine';
import { DISTRICT_NAMES } from '../data/districtPacing';
import type { AegisAbilityId, AegisLoadout } from '../types/aegisCombat';
import { isAbilityUnlocked } from '../data/aegisAbilityUnlockEngine';
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
} from '../data/classAbilityUnlockEngine';
import { ENVOY_ABILITY_CATALOG } from '../data/envoyAbilities';
import { HEX_SHOT_ABILITY_CATALOG } from '../data/hexShotAbilities';
import { formatClassAbilityCostLine } from '../data/classAbilityResolver';
import type { EnvoyAbilityId, EnvoyLoadout, HexShotAbilityId, HexShotLoadout } from '../types/operativeClass';
import { validateLoadoutCommit } from '../utils/aegisLoadoutUtils';
import { HIDDEN_SCROLLBAR_VIEW_STYLE, HIDDEN_SCROLLVIEW_PROPS } from '../utils/hiddenScrollbarStyle';
import {
  validateEnvoyLoadoutCommit,
  validateHexShotLoadoutCommit,
} from '../utils/classLoadoutUtils';

const TERMINAL_ACCENT = '#3ecf6e';
const TERMINAL_MUTED = '#6b7c72';
const PANEL_BG = '#121416';
const BORDER = 'rgba(62, 207, 110, 0.28)';

type SafehouseTab = 'PAYLOAD' | 'LOADOUT' | 'BENCH' | 'DECRYPT' | 'INTEL';

const TRANSFER_PRESETS = [0, 25, 50, 75, 100] as const;

const EDITOR_THEME = {
  accentColor: TERMINAL_ACCENT,
  borderColor: BORDER,
  mutedColor: TERMINAL_MUTED,
  textColor: '#d8e2dc',
  panelBg: 'rgba(0, 0, 0, 0.35)',
};

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

  const [activeTab, setActiveTab] = useState<SafehouseTab>('PAYLOAD');
  const [transferPercent, setTransferPercent] = useState(50);
  const [statusLine, setStatusLine] = useState('>> CABAL CHECKPOINT ONLINE — AWAITING OPERATIVE INPUT.');
  const [loadoutDraft, setLoadoutDraft] = useState<AegisAbilityId[]>([...activeIncursion.aegisLoadout]);
  const [hexDraft, setHexDraft] = useState<HexShotAbilityId[]>([...activeIncursion.hexShotLoadout]);
  const [envoyDraft, setEnvoyDraft] = useState<EnvoyAbilityId[]>([...activeIncursion.envoyLoadout]);
  const [selectedSlot, setSelectedSlot] = useState<0 | 1 | 2 | 3>(0);
  const [selectedFlexSlot, setSelectedFlexSlot] = useState<1 | 2 | 3>(1);
  const [loadoutStatus, setLoadoutStatus] = useState<string | null>(null);

  useEffect(() => {
    const { deposited } = vaultIncursionVeilResidueToAccount();
    if (deposited <= 0) return;
    depositVeilResidueBalance(deposited);
    const line = `>> VEIL RESIDUE VAULTED — ${deposited} UNITS SECURED TO CABAL DEPOSITORY FOR SHADOW WAR DONATION.`;
    appendRunLog(line);
    setStatusLine(line);
  }, [appendRunLog, depositVeilResidueBalance, vaultIncursionVeilResidueToAccount]);

  const operativeClass = activeIncursion.activeClass ?? account.activeClass;

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

  useEffect(() => {
    if (activeTab !== 'LOADOUT') return;
    setLoadoutDraft([...activeIncursion.aegisLoadout]);
    setHexDraft([...activeIncursion.hexShotLoadout]);
    setEnvoyDraft([...activeIncursion.envoyLoadout]);
    setLoadoutStatus(null);
  }, [
    activeTab,
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
  const cargoPct = Math.round(calculateGridOccupancy(activeIncursion.cargo) * 100);
  const cargoValue = calculateCargoMarketValue(activeIncursion.cargo);
  const intel = getSafehouseIntel();
  const nextDistrict = activeIncursion.currentDistrict;

  const handleTransfer = useCallback(() => {
    const result = transferRunCargoToBankVault(transferPercent);
    appendRunLog(result.logLine);
    setStatusLine(result.logLine);
    if (result.success && 'transferredValue' in result && result.transferredValue) {
      depositBankedCargo({
        totalValue: result.transferredValue,
        lastTransferValue: result.transferredValue,
      });
    }
  }, [appendRunLog, depositBankedCargo, transferPercent, transferRunCargoToBankVault]);

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

  const assignAbilityToSlot = useCallback((abilityId: AegisAbilityId) => {
    if (abilityId === 'EVISCERATE') return;
    if (!isAbilityUnlocked(account.unlockedAegisAbilities, abilityId)) {
      setLoadoutStatus(`>> ${abilityId.replace(/_/g, ' ')} NOT UNLOCKED — DECRYPT PROTOCOL FIRST.`);
      return;
    }
    setLoadoutDraft((prev) => {
      const next = [...prev];
      next[selectedSlot] = abilityId;
      return next;
    });
    setLoadoutStatus(null);
  }, [account.unlockedAegisAbilities, selectedSlot]);

  const handleUnlockAbility = useCallback((abilityId: AegisAbilityId) => {
    const result = unlockAegisAbility(abilityId);
    appendRunLog(result.logLine);
    setLoadoutStatus(result.logLine);
  }, [appendRunLog, unlockAegisAbility]);

  const commitLoadout = useCallback(() => {
    const rejection = validateLoadoutCommit(loadoutDraft, account.unlockedAegisAbilities);
    if (rejection) {
      setLoadoutStatus(rejection);
      setStatusLine(rejection);
      return;
    }
    const committed: AegisLoadout = [
      loadoutDraft[0],
      loadoutDraft[1],
      loadoutDraft[2],
      loadoutDraft[3],
    ];
    setAegisLoadout(committed);
    setAccountAegisLoadout(committed);
    appendRunLog('>> AEGIS LOADOUT LOCKED — four active abilities staged for next descent.');
    const success = '>> LOADOUT COMMITTED — COMBAT DECK WILL DEPLOY ON NEXT INCURSION.';
    setLoadoutStatus(success);
    setStatusLine(success);
  }, [appendRunLog, account.unlockedAegisAbilities, loadoutDraft, setAccountAegisLoadout, setAegisLoadout]);

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

  const commitHexLoadout = useCallback(() => {
    const rejection = validateHexShotLoadoutCommit(hexDraft, account.unlockedHexShotAbilities);
    if (rejection) {
      setLoadoutStatus(rejection);
      setStatusLine(rejection);
      return;
    }
    const committed: HexShotLoadout = [hexDraft[0], hexDraft[1], hexDraft[2], hexDraft[3]];
    setHexShotLoadout(committed);
    setAccountHexShotLoadout(committed);
    appendRunLog('>> HEX-SHOT LOADOUT LOCKED — ballistic deck staged for next descent.');
    const success = '>> LOADOUT COMMITTED — COMBAT DECK WILL DEPLOY ON NEXT INCURSION.';
    setLoadoutStatus(success);
    setStatusLine(success);
  }, [
    account.unlockedHexShotAbilities,
    appendRunLog,
    hexDraft,
    setAccountHexShotLoadout,
    setHexShotLoadout,
  ]);

  const commitEnvoyLoadout = useCallback(() => {
    const rejection = validateEnvoyLoadoutCommit(envoyDraft, account.unlockedEnvoyAbilities);
    if (rejection) {
      setLoadoutStatus(rejection);
      setStatusLine(rejection);
      return;
    }
    const committed: EnvoyLoadout = [envoyDraft[0], envoyDraft[1], envoyDraft[2], envoyDraft[3]];
    setEnvoyLoadout(committed);
    setAccountEnvoyLoadout(committed);
    appendRunLog('>> ENVOY LOADOUT LOCKED — spell deck staged for next descent.');
    const success = '>> LOADOUT COMMITTED — COMBAT DECK WILL DEPLOY ON NEXT INCURSION.';
    setLoadoutStatus(success);
    setStatusLine(success);
  }, [
    account.unlockedEnvoyAbilities,
    appendRunLog,
    envoyDraft,
    setAccountEnvoyLoadout,
    setEnvoyLoadout,
  ]);

  return (
    <IncursionShell>
      <IncursionRunLayout style={{ backgroundColor: '#0b0c0d' }}>
        <RunEventScreenFrame
          header={(
            <>
              <View style={[styles.header, { borderColor: BORDER }]}>
                <Text style={styles.headerTitle}>CABAL SAFEHOUSE // CHECKPOINT TERMINAL</Text>
                <Text style={styles.headerStats}>
                  {`HEALTH ${healthPct}% // SHIELD ${shieldPct}% // CARGO ${cargoPct}% // VAULT ${account.bankedCargo.totalValue}`}
                </Text>
                <Text style={[styles.headerStats, { color: TERMINAL_ACCENT }]}>
                  {`${account.veilResidueBalance} VEIL RESIDUE VAULTED // SHADOW WAR DONATABLE`}
                </Text>
                <Text style={[styles.headerSub, { color: TERMINAL_MUTED }]}>
                  {`DISTRICT ${activeIncursion.currentDistrict - 1} SECURED — PREPARE FOR ${DISTRICT_NAMES[nextDistrict].toUpperCase()}`}
                </Text>
              </View>

              <View style={styles.tabRow}>
                {(['PAYLOAD', 'LOADOUT', 'BENCH', 'DECRYPT', 'INTEL'] as SafehouseTab[]).map((tab) => (
                  <HapticPressable
                    key={tab}
                    onPress={() => setActiveTab(tab)}
                    style={[
                      styles.tabBtn,
                      { borderColor: activeTab === tab ? TERMINAL_ACCENT : BORDER },
                      activeTab === tab && styles.tabBtnActive,
                    ]}
                  >
                    <Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>
                      {`[ ${tab} ]`}
                    </Text>
                  </HapticPressable>
                ))}
              </View>
            </>
          )}
          footer={(
            <>
              <Text style={[styles.statusLine, { color: theme.mutedColor }]}>{statusLine}</Text>
              <HapticPressable onPress={handleUnseal} style={[styles.unsealBtn, { borderColor: TERMINAL_ACCENT }]}>
                <Text style={styles.unsealLabel}>{`[ UNSEAL DOOR : ENTER DISTRICT ${nextDistrict} ]`}</Text>
              </HapticPressable>
            </>
          )}
        >
          <View style={[styles.panel, { borderColor: BORDER }]}>
            {activeTab === 'PAYLOAD' ? (
              <>
                <Text style={styles.panelTitle}>PAYLOAD VAULT TRANSFER</Text>
                <Text style={styles.panelCopy}>
                  {`Run cargo value: ${cargoValue} CR — select slice to bank before district descent.`}
                </Text>
                <View style={styles.presetRow}>
                  {TRANSFER_PRESETS.map((preset) => (
                    <HapticPressable
                      key={preset}
                      onPress={() => setTransferPercent(preset)}
                      style={[
                        styles.presetBtn,
                        { borderColor: transferPercent === preset ? TERMINAL_ACCENT : BORDER },
                      ]}
                    >
                      <Text style={styles.presetLabel}>{`${preset}%`}</Text>
                    </HapticPressable>
                  ))}
                </View>
                <Text style={styles.panelMeta}>{`TRANSFER SLICE: ${transferPercent}% (~${Math.floor(cargoValue * transferPercent / 100)} CR)`}</Text>
                <HapticPressable onPress={handleTransfer} style={[styles.actionBtn, { borderColor: TERMINAL_ACCENT }]}>
                  <Text style={styles.actionLabel}>[ EXECUTE BANK TRANSFER ]</Text>
                </HapticPressable>
              </>
            ) : null}

            {activeTab === 'LOADOUT' ? (
              <ScrollView
                {...HIDDEN_SCROLLVIEW_PROPS}
                style={HIDDEN_SCROLLBAR_VIEW_STYLE}
                contentContainerStyle={styles.loadoutScroll}
              >
                <Text style={styles.panelTitle}>
                  {`${operativeClass.replace(/_/g, ' ')} COMBAT LOADOUT`}
                </Text>
                {operativeClass === 'AEGIS' ? (
                  <AegisLoadoutEditor
                    draft={loadoutDraft}
                    selectedSlot={selectedSlot}
                    onSelectSlot={setSelectedSlot}
                    onAssignAbility={assignAbilityToSlot}
                    onUnlockAbility={handleUnlockAbility}
                    onCommit={commitLoadout}
                    unlockedAbilities={account.unlockedAegisAbilities}
                    resourceStash={account.resourceStash}
                    theme={EDITOR_THEME}
                    statusMessage={loadoutStatus}
                  />
                ) : null}
                {operativeClass === 'HEX_SHOT' ? (
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
                      appendRunLog(result.logLine);
                      setLoadoutStatus(result.logLine);
                    }}
                    onCommit={commitHexLoadout}
                    unlockedAbilities={account.unlockedHexShotAbilities}
                    isUnlocked={(id) => isHexShotAbilityUnlocked(account.unlockedHexShotAbilities, id)}
                    resourceStash={account.resourceStash}
                    theme={EDITOR_THEME}
                    title="HEX-SHOT COMBAT LOADOUT // 4 ACTIVE SLOTS"
                    hint="Slot 1 is Silver-Core Sidearm. Phase-Shift Reload is intrinsic; Zero-Protocol procs when overcharge and a live debuffed hostile align."
                    commitLabel="[ COMMIT LOADOUT FOR REMAINING RUN ]"
                    statusMessage={loadoutStatus}
                  />
                ) : null}
                {operativeClass === 'ENVOY' ? (
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
                      appendRunLog(result.logLine);
                      setLoadoutStatus(result.logLine);
                    }}
                    onCommit={commitEnvoyLoadout}
                    unlockedAbilities={account.unlockedEnvoyAbilities}
                    isUnlocked={(id) => isEnvoyAbilityUnlocked(account.unlockedEnvoyAbilities, id)}
                    resourceStash={account.resourceStash}
                    theme={EDITOR_THEME}
                    title="ENVOY COMBAT LOADOUT // 4 ACTIVE SLOTS"
                    hint="Slot 1 is Veil-Splinter. Rift-Ward is automatic; Catalytic Console detonates Veil Rot; Cataclysm Sigil procs at 6+ stacks."
                    anchorCostLine={formatClassAbilityCostLine('ENVOY', ENVOY_ANCHOR)}
                    commitLabel="[ COMMIT LOADOUT FOR REMAINING RUN ]"
                    statusMessage={loadoutStatus}
                  />
                ) : null}
              </ScrollView>
            ) : null}

            {activeTab === 'BENCH' ? (
              <>
                <Text style={styles.panelTitle}>THE BENCH // CLASS MODULES</Text>
                <View style={[styles.classCard, { borderColor: BORDER }]}>
                  <Text style={styles.classTitle}>{operativeClass.replace(/_/g, ' ')}</Text>
                  <Text style={styles.classStatus}>ACTIVE OPERATIVE CLASS</Text>
                  <View style={styles.classActions}>
                    <HapticPressable onPress={handleBenchRestore} style={[styles.actionBtn, { borderColor: TERMINAL_ACCENT }]}>
                      <Text style={styles.actionLabel}>[ RESTORE 25% HEALTH — 10% CARGO ]</Text>
                    </HapticPressable>
                  </View>
                </View>
              </>
            ) : null}

            {activeTab === 'DECRYPT' ? (
              <DecryptionPanel onStatus={setStatusLine} />
            ) : null}

            {activeTab === 'INTEL' ? (
              <>
                <Text style={styles.panelTitle}>UPCOMING DISTRICT INTEL</Text>
                <View style={[styles.intelBlock, { borderColor: BORDER }]}>
                  <Text style={styles.intelLine}>{`TARGET DISTRICT: ${intel.districtName.toUpperCase()} (D${intel.district})`}</Text>
                  <Text style={styles.intelLine}>{`DOMINANT FACTION: ${intel.dominantFaction.toUpperCase()}`}</Text>
                  <Text style={styles.intelLine}>{`HAZARD PROFILE: ${intel.hazardSummary}`}</Text>
                  <Text style={styles.intelWarn}>{`TACTIC NOTE: ${intel.tacticHint}`}</Text>
                </View>
              </>
            ) : null}
          </View>
        </RunEventScreenFrame>
      </IncursionRunLayout>
    </IncursionShell>
  );
}

const styles = StyleSheet.create({
  header: {
    borderWidth: 1,
    backgroundColor: PANEL_BG,
    padding: 12,
    gap: 6,
  },
  headerTitle: {
    fontFamily: 'monospace',
    fontSize: 10,
    letterSpacing: 1.1,
    color: TERMINAL_ACCENT,
  },
  headerStats: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 0.8,
    color: '#d8e2dc',
  },
  headerSub: {
    fontFamily: 'monospace',
    fontSize: 8,
    letterSpacing: 0.7,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  tabBtn: {
    flex: 1,
    borderWidth: 1,
    backgroundColor: PANEL_BG,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabBtnActive: {
    backgroundColor: 'rgba(62, 207, 110, 0.08)',
  },
  tabLabel: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: TERMINAL_MUTED,
    letterSpacing: 0.8,
  },
  tabLabelActive: {
    color: TERMINAL_ACCENT,
  },
  panel: {
    flex: 1,
    minHeight: 0,
    borderWidth: 1,
    backgroundColor: PANEL_BG,
    padding: 14,
    gap: 12,
  },
  loadoutScroll: {
    gap: 12,
    paddingBottom: 8,
  },
  panelTitle: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: TERMINAL_ACCENT,
    letterSpacing: 1,
  },
  panelCopy: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: '#b8c4bc',
    lineHeight: 14,
  },
  panelMeta: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: TERMINAL_MUTED,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetBtn: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 52,
    alignItems: 'center',
  },
  presetLabel: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: '#d8e2dc',
  },
  actionBtn: {
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  actionLabel: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 0.7,
    color: TERMINAL_ACCENT,
  },
  classCard: {
    borderWidth: 1,
    padding: 10,
    gap: 6,
  },
  classTitle: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: '#d8e2dc',
    letterSpacing: 0.8,
  },
  classStatus: {
    fontFamily: 'monospace',
    fontSize: 8,
    color: TERMINAL_MUTED,
  },
  classActions: {
    gap: 8,
    marginTop: 4,
  },
  intelBlock: {
    borderWidth: 1,
    padding: 12,
    gap: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
  },
  intelLine: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: '#c5d0c8',
    lineHeight: 14,
  },
  intelWarn: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: '#ff9f6b',
    lineHeight: 14,
    marginTop: 4,
  },
  statusLine: {
    fontFamily: 'monospace',
    fontSize: 8,
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  unsealBtn: {
    borderWidth: 2,
    backgroundColor: 'rgba(62, 207, 110, 0.1)',
    paddingVertical: 16,
    alignItems: 'center',
  },
  unsealLabel: {
    fontFamily: 'monospace',
    fontSize: 11,
    letterSpacing: 1,
    color: TERMINAL_ACCENT,
    fontWeight: '700',
  },
});
