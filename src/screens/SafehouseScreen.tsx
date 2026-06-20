import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import IncursionShell from '../components/IncursionShell';
import DecryptionPanel from '../components/DecryptionPanel';
import MacroLogAnchoredLayout from '../components/MacroLogAnchoredLayout';
import AegisLoadoutEditor from '../components/AegisLoadoutEditor';
import { useRun } from '../context/RunContext';
import { usePlayerAccount } from '../context/PlayerAccountContext';
import { useTerminal } from '../context/TerminalContext';
import { useGameFlow } from '../context/GameFlowContext';
import { calculateCargoMarketValue, calculateGridOccupancy } from '../data/cargoGridEngine';
import { DISTRICT_NAMES } from '../data/districtPacing';
import type { AegisAbilityId, AegisLoadout } from '../types/aegisCombat';
import { isAbilityUnlocked } from '../data/aegisAbilityUnlockEngine';
import { validateLoadoutCommit } from '../utils/aegisLoadoutUtils';

const TERMINAL_ACCENT = '#3ecf6e';
const TERMINAL_MUTED = '#6b7c72';
const PANEL_BG = '#121416';
const BORDER = 'rgba(62, 207, 110, 0.28)';

type SafehouseTab = 'PAYLOAD' | 'LOADOUT' | 'BENCH' | 'DECRYPT' | 'INTEL';

const TRANSFER_PRESETS = [0, 25, 50, 75, 100] as const;

const CLASS_CARDS = [
  { id: 'AEGIS', label: 'AEGIS', status: 'ACTIVE' },
  { id: 'HEX_SHOT', label: 'HEX SHOT', status: 'ACTIVE' },
  { id: 'ENVOY', label: 'ENVOY', status: 'ACTIVE' },
] as const;

export default function SafehouseScreen(): React.JSX.Element {
  const { theme } = useTerminal();
  const {
    runState,
    activeIncursion,
    appendRunLog,
    transitionToNextDistrict,
    transferRunCargoToBankVault,
    restoreHealthFromBench,
    getSafehouseIntel,
    setAegisLoadout,
  } = useRun();
  const { account, depositBankedCargo, setAegisLoadout: setAccountAegisLoadout, unlockAegisAbility } = usePlayerAccount();
  const { startScanning } = useGameFlow();

  const [activeTab, setActiveTab] = useState<SafehouseTab>('PAYLOAD');
  const [transferPercent, setTransferPercent] = useState(50);
  const [statusLine, setStatusLine] = useState('>> CABAL CHECKPOINT ONLINE — AWAITING OPERATIVE INPUT.');
  const [loadoutDraft, setLoadoutDraft] = useState<AegisAbilityId[]>([...activeIncursion.aegisLoadout]);
  const [selectedSlot, setSelectedSlot] = useState<0 | 1 | 2 | 3>(0);
  const [loadoutStatus, setLoadoutStatus] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab !== 'LOADOUT') return;
    setLoadoutDraft([...activeIncursion.aegisLoadout]);
    setLoadoutStatus(null);
  }, [activeTab, activeIncursion.aegisLoadout]);

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
    transitionToNextDistrict();
    startScanning();
  }, [startScanning, transitionToNextDistrict]);

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

  return (
    <IncursionShell>
      <MacroLogAnchoredLayout
        showMacroLog={runState.runActive}
        style={{ backgroundColor: '#0b0c0d' }}
      >
        <View style={styles.root}>
          <View style={[styles.header, { borderColor: BORDER }]}>
            <Text style={styles.headerTitle}>CABAL SAFEHOUSE // CHECKPOINT TERMINAL</Text>
            <Text style={styles.headerStats}>
              {`HEALTH ${healthPct}% // SHIELD ${shieldPct}% // CARGO ${cargoPct}% // VAULT ${account.bankedCargo.totalValue}`}
            </Text>
            <Text style={[styles.headerSub, { color: TERMINAL_MUTED }]}>
              {`DISTRICT ${activeIncursion.currentDistrict - 1} SECURED — PREPARE FOR ${DISTRICT_NAMES[nextDistrict].toUpperCase()}`}
            </Text>
          </View>

          <View style={styles.tabRow}>
            {(['PAYLOAD', 'LOADOUT', 'BENCH', 'DECRYPT', 'INTEL'] as SafehouseTab[]).map((tab) => (
              <Pressable
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
              </Pressable>
            ))}
          </View>

          <View style={[styles.panel, { borderColor: BORDER }]}>
            {activeTab === 'PAYLOAD' ? (
              <>
                <Text style={styles.panelTitle}>PAYLOAD VAULT TRANSFER</Text>
                <Text style={styles.panelCopy}>
                  {`Run cargo value: ${cargoValue} CR — select slice to bank before district descent.`}
                </Text>
                <View style={styles.presetRow}>
                  {TRANSFER_PRESETS.map((preset) => (
                    <Pressable
                      key={preset}
                      onPress={() => setTransferPercent(preset)}
                      style={[
                        styles.presetBtn,
                        { borderColor: transferPercent === preset ? TERMINAL_ACCENT : BORDER },
                      ]}
                    >
                      <Text style={styles.presetLabel}>{`${preset}%`}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.panelMeta}>{`TRANSFER SLICE: ${transferPercent}% (~${Math.floor(cargoValue * transferPercent / 100)} CR)`}</Text>
                <Pressable onPress={handleTransfer} style={[styles.actionBtn, { borderColor: TERMINAL_ACCENT }]}>
                  <Text style={styles.actionLabel}>[ EXECUTE BANK TRANSFER ]</Text>
                </Pressable>
              </>
            ) : null}

            {activeTab === 'LOADOUT' ? (
              <AegisLoadoutEditor
                draft={loadoutDraft}
                selectedSlot={selectedSlot}
                onSelectSlot={setSelectedSlot}
                onAssignAbility={assignAbilityToSlot}
                onUnlockAbility={handleUnlockAbility}
                onCommit={commitLoadout}
                unlockedAbilities={account.unlockedAegisAbilities}
                resourceStash={account.resourceStash}
                theme={{
                  accentColor: TERMINAL_ACCENT,
                  borderColor: BORDER,
                  mutedColor: TERMINAL_MUTED,
                  textColor: '#d8e2dc',
                  panelBg: 'rgba(0, 0, 0, 0.35)',
                }}
                statusMessage={loadoutStatus}
              />
            ) : null}

            {activeTab === 'BENCH' ? (
              <>
                <Text style={styles.panelTitle}>THE BENCH // CLASS MODULES</Text>
                {CLASS_CARDS.map((card) => (
                  <View key={card.id} style={[styles.classCard, { borderColor: BORDER }]}>
                    <Text style={styles.classTitle}>{card.label}</Text>
                    <Text style={styles.classStatus}>{card.status}</Text>
                    {card.id === 'AEGIS' ? (
                      <View style={styles.classActions}>
                        <Pressable onPress={handleBenchRestore} style={[styles.actionBtn, { borderColor: TERMINAL_ACCENT }]}>
                          <Text style={styles.actionLabel}>[ RESTORE 25% HEALTH — 10% CARGO ]</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => setStatusLine('>> MODULE SWAP — USE ID BADGE CLASS TOGGLE BEFORE DEPLOY.')}
                          style={[styles.actionBtn, { borderColor: BORDER }]}
                        >
                          <Text style={[styles.actionLabel, { color: TERMINAL_MUTED }]}>[ SWAP PRIMARY MODULE ]</Text>
                        </Pressable>
                      </View>
                    ) : (
                      <Text style={styles.classLocked}>CLASS NOT UNLOCKED THIS CAMPAIGN.</Text>
                    )}
                  </View>
                ))}
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

          <Text style={[styles.statusLine, { color: theme.mutedColor }]}>{statusLine}</Text>

          <Pressable onPress={handleUnseal} style={[styles.unsealBtn, { borderColor: TERMINAL_ACCENT }]}>
            <Text style={styles.unsealLabel}>{`[ UNSEAL DOOR : ENTER DISTRICT ${nextDistrict} ]`}</Text>
          </Pressable>
        </View>
      </MacroLogAnchoredLayout>
    </IncursionShell>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0b0c0d',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 18,
    gap: 12,
  },
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
    borderWidth: 1,
    backgroundColor: PANEL_BG,
    padding: 14,
    gap: 12,
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
  classLocked: {
    fontFamily: 'monospace',
    fontSize: 8,
    color: TERMINAL_MUTED,
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
