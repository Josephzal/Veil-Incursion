import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CLASS_DEFINITIONS, RESTRICTED_CLASS_TAG } from '../data/classes';
import { FACTION_DEFINITIONS, getFactionDefinition } from '../data/factions';
import { DECRYPT_PHASES, formatItemStatLines } from '../data/inventory';
import { usePlayerAccount, xpProgressForAccount } from '../context/PlayerAccountContext';
import { useRun } from '../context/RunContext';
import { useGameFlow } from '../context/GameFlowContext';
import { useTerminal } from '../context/TerminalContext';
import { ClassType, FactionType, InventoryItem } from '../types/game';

const { width } = Dimensions.get('window');
const FACTION_ORDER: FactionType[] = ['TERRAN_GRID', 'LEGION', 'SOLARIS'];
const ALL_CLASSES: ClassType[] = ['AEGIS', 'RIFTSHOT', 'ENVOY'];

const ITEM_CATEGORIES: Array<{ key: InventoryItem['type']; label: string }> = [
  { key: 'WEAPON', label: 'WEAPONS' },
  { key: 'SHROUD', label: 'SHROUDS' },
  { key: 'TRINKET', label: 'TRINKETS' },
];

export default function OverworldHubScreen(): React.JSX.Element {
  const { theme, updateCabalAlignment, alignment } = useTerminal();
  const {
    account,
    isHydrated,
    hubLog,
    commitFactionAlignment,
    equipInventoryItem,
    decryptTier1Cache,
    appendHubLog,
  } = usePlayerAccount();
  const { startNewRun } = useRun();
  const { startScanning } = useGameFlow();

  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptReadout, setDecryptReadout] = useState<string | null>(null);

  const factionDef = account.alignedFaction ? getFactionDefinition(account.alignedFaction) : null;
  const accent = factionDef?.accentColor ?? '#00ff33';
  const hubBg = factionDef?.backgroundColor ?? '#0a0b0f';
  const hubBorder = factionDef?.borderColor ?? theme.borderColor;
  const hubText = factionDef?.typographyColor ?? theme.primaryColor;

  const xpProgress = useMemo(() => xpProgressForAccount(account), [account]);
  const activeClassDef = CLASS_DEFINITIONS[account.activeClass];
  const needsFactionSelection = account.alignedFaction === null;

  useEffect(() => {
    if (!account.alignedFaction || account.alignedFaction === alignment) return;
    updateCabalAlignment(account.alignedFaction);
  }, [account.alignedFaction, alignment, updateCabalAlignment]);

  const handleInitializeRun = () => {
    if (needsFactionSelection) return;
    startNewRun({
      factionPerks: account.factionPerks,
      unlockedBiomes: account.unlockedBiomes,
    });
    startScanning();
  };

  const handleSelectFaction = (faction: FactionType) => {
    commitFactionAlignment(faction);
    updateCabalAlignment(faction);
  };

  const handleDecryptCache = async () => {
    if (isDecrypting || account.inventory.unopenedCaches.tier1Caches <= 0) return;
    setIsDecrypting(true);
    setDecryptReadout(null);

    for (let i = 0; i < DECRYPT_PHASES.length; i += 1) {
      setDecryptReadout(DECRYPT_PHASES[i]);
      appendHubLog(`>> ${DECRYPT_PHASES[i]}`);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    const resultLines = await decryptTier1Cache();
    for (const line of resultLines) {
      appendHubLog(line);
      await new Promise((resolve) => setTimeout(resolve, 280));
    }

    setDecryptReadout('DECRYPTION SEQUENCE COMPLETE.');
    setIsDecrypting(false);
  };

  const tier1Caches = account.inventory.unopenedCaches.tier1Caches;

  if (!isHydrated) {
    return (
      <View style={[styles.loadingRoot, { backgroundColor: hubBg }]}>
        <ActivityIndicator color={accent} />
        <Text style={[styles.loadingText, { color: theme.mutedColor }]}>
          LOADING OPERATIVE ACCOUNT...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: hubBg }]}>
      {/* Scanline grid backdrop */}
      <View style={styles.gridBackdrop} pointerEvents="none">
        {Array.from({ length: 10 }).map((_, row) => (
          <View key={`g-${row}`} style={styles.gridRow}>
            {Array.from({ length: 5 }).map((__, col) => (
              <View
                key={`c-${row}-${col}`}
                style={[styles.gridCell, { borderColor: `${hubBorder}33` }]}
              />
            ))}
          </View>
        ))}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Agency header strip */}
        <View style={[styles.agencyStrip, { borderColor: hubBorder }]}>
          <Text style={[styles.agencyStripText, { color: theme.mutedColor }]}>
            OVERWORLD HUB TERMINAL // VEIL INCURSION AGENCY // SLAYER TELEMETRY ACTIVE
          </Text>
        </View>

        {/* Top data banner */}
        <View style={[styles.dataBanner, { borderColor: accent, backgroundColor: '#050608' }]}>
          <View style={styles.bannerRow}>
            <View style={styles.bannerCell}>
              <Text style={[styles.bannerLabel, { color: theme.mutedColor }]}>OPERATIVE RANK</Text>
              <Text style={[styles.bannerValue, { color: accent }]}>RANK {account.operativeRank}</Text>
            </View>
            <View style={styles.bannerCell}>
              <Text style={[styles.bannerLabel, { color: theme.mutedColor }]}>CABAL WALLET</Text>
              <Text style={[styles.bannerValue, { color: factionDef?.secondaryColor ?? '#fbbf24' }]}>
                {account.cabalCredits} CR
              </Text>
            </View>
            <View style={styles.bannerCell}>
              <Text style={[styles.bannerLabel, { color: theme.mutedColor }]}>CABAL BADGE</Text>
              <Text style={[styles.bannerValue, { color: hubText }]}>
                {factionDef?.displayName ?? 'UNALIGNED'}
              </Text>
            </View>
          </View>

          <View style={styles.xpSection}>
            <View style={styles.xpHeader}>
              <Text style={[styles.bannerLabel, { color: theme.mutedColor }]}>XP PROGRESS</Text>
              <Text style={[styles.xpNumbers, { color: accent }]}>
                {xpProgress.current} / {xpProgress.required} XP
              </Text>
            </View>
            <View style={[styles.xpTrack, { borderColor: hubBorder }]}>
              <View
                style={[styles.xpFill, { backgroundColor: accent, width: `${xpProgress.percent}%` }]}
              />
            </View>
          </View>

          <View style={[styles.protocolBanner, { borderColor: accent }]}>
            <Text style={[styles.protocolLabel, { color: accent }]}>
              {activeClassDef.protocolLabel}
            </Text>
          </View>
        </View>

        {/* Operative Protocol Systems */}
        <View style={[styles.panel, { borderColor: hubBorder }]}>
          <Text style={[styles.panelTitle, { color: hubText }]}>OPERATIVE PROTOCOL SYSTEMS</Text>
          {ALL_CLASSES.map((classId) => {
            const def = CLASS_DEFINITIONS[classId];
            const isActive = account.activeClass === classId && account.unlockedClasses.includes(classId);
            const isLocked = !account.unlockedClasses.includes(classId);

            return (
              <View
                key={classId}
                style={[
                  styles.classSlot,
                  {
                    borderColor: isActive ? accent : hubBorder,
                    opacity: isLocked ? 0.3 : 1,
                    backgroundColor: isActive ? `${accent}11` : 'transparent',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.className,
                    { color: isActive ? accent : theme.mutedColor },
                  ]}
                >
                  {def.displayName} {isActive ? '[ACTIVE]' : ''}
                </Text>
                {isActive ? (
                  <>
                    <Text style={[styles.classSub, { color: theme.mutedColor }]}>
                      {def.weaponLine} // {def.interactionLine}
                    </Text>
                  </>
                ) : (
                  <Text style={[styles.restrictedTag, { color: theme.mutedColor }]}>
                    {RESTRICTED_CLASS_TAG}
                  </Text>
                )}
              </View>
            );
          })}
        </View>

        {/* Veil Cache Decryption Terminal */}
        <View style={[styles.panel, { borderColor: hubBorder }]}>
          <Text style={[styles.panelTitle, { color: hubText }]}>VEIL CACHE DECRYPTION TERMINAL</Text>
          <Text style={[styles.materialRow, { color: theme.mutedColor }]}>
            UNOPENED TIER 1 CACHES: {tier1Caches}
          </Text>
          <Text style={[styles.materialRow, { color: theme.mutedColor }]}>
            RIFT IRON: {account.inventory.materials.riftIron} // VOID FILAMENT: {account.inventory.materials.voidFilament}
          </Text>

          {tier1Caches > 0 && (
            <Pressable
              onPress={handleDecryptCache}
              disabled={isDecrypting || needsFactionSelection}
              style={({ pressed }) => [
                styles.decryptModule,
                {
                  borderColor: accent,
                  backgroundColor: pressed ? `${accent}22` : '#0a0b0f',
                  opacity: isDecrypting || needsFactionSelection ? 0.55 : 1,
                },
              ]}
            >
              <Text style={[styles.decryptTitle, { color: accent }]}>
                {isDecrypting ? decryptReadout ?? 'DECRYPTING...' : '[ DECRYPT CACHE ]'}
              </Text>
            </Pressable>
          )}

          {(hubLog.length > 0 || decryptReadout) && (
            <View style={[styles.hubLogBox, { borderColor: hubBorder }]}>
              {hubLog.slice(-8).map((line, idx) => (
                <Text key={`${line}-${idx}`} style={[styles.hubLogLine, { color: accent }]}>
                  {line}
                </Text>
              ))}
            </View>
          )}
        </View>

        {/* Operative Armory */}
        <View style={[styles.panel, { borderColor: hubBorder }]}>
          <Text style={[styles.panelTitle, { color: hubText }]}>OPERATIVE ARMORY</Text>
          {ITEM_CATEGORIES.map(({ key, label }) => {
            const categoryItems = account.inventory.items.filter((i) => i.type === key);
            return (
              <View key={key} style={styles.armoryCategory}>
                <Text style={[styles.armoryCategoryLabel, { color: theme.mutedColor }]}>{label}</Text>
                {categoryItems.length === 0 ? (
                  <Text style={[styles.armoryEmpty, { color: theme.mutedColor }]}>
                    // NO {label} ON FILE
                  </Text>
                ) : (
                  categoryItems.map((item) => (
                    <Pressable
                      key={item.id}
                      onPress={() => item.type === 'WEAPON' && !item.isEquipped && equipInventoryItem(item.id)}
                      disabled={item.isEquipped || item.type !== 'WEAPON'}
                      style={[
                        styles.armoryCard,
                        {
                          borderColor: item.isEquipped ? accent : hubBorder,
                          backgroundColor: item.isEquipped ? `${accent}14` : 'transparent',
                          opacity: item.type === 'WEAPON' ? 1 : 0.45,
                        },
                      ]}
                    >
                      <Text style={[styles.armoryItemName, { color: item.isEquipped ? accent : hubText }]}>
                        {item.name} [{item.rarity}]
                      </Text>
                      {item.isEquipped && (
                        <Text style={[styles.equippedTag, { color: accent }]}>
                          [EQUIPPED // BRANDED CONNECTOR ON]
                        </Text>
                      )}
                      <Text style={[styles.armoryDesc, { color: theme.mutedColor }]}>{item.description}</Text>
                      {formatItemStatLines(item).map((stat) => (
                        <Text key={stat} style={[styles.armoryStat, { color: factionDef?.secondaryColor ?? accent }]}>
                          {stat}
                        </Text>
                      ))}
                    </Pressable>
                  ))
                )}
              </View>
            );
          })}
        </View>

        {/* Unlocked biomes readout */}
        <View style={[styles.panel, { borderColor: hubBorder }]}>
          <Text style={[styles.panelTitle, { color: hubText }]}>AUTHORIZED INCURSION ZONES</Text>
          <Text style={[styles.biomeList, { color: theme.mutedColor }]}>
            {account.unlockedBiomes.join(' // ')}
          </Text>
        </View>

        {/* Incursion module */}
        <Pressable
          onPress={handleInitializeRun}
          disabled={needsFactionSelection}
          style={({ pressed }) => [
            styles.incursionModule,
            {
              borderColor: accent,
              backgroundColor: pressed ? `${accent}22` : '#0a0b0f',
              opacity: needsFactionSelection ? 0.4 : 1,
            },
          ]}
        >
          <Text style={[styles.incursionTitle, { color: accent }]}>
            ACCESS RADAR SCANNER / INITIALIZE RUN
          </Text>
          <Text style={[styles.incursionSub, { color: theme.mutedColor }]}>
            Deploy to anomaly sweep grid — 2–5 signal vectors from authorized biomes
          </Text>
        </Pressable>

        <Text style={[styles.footerMeta, { color: theme.mutedColor }]}>
          OPERATIVE ID: {account.username} // TIER {account.progressionMatrix.maxTierUnlocked}
        </Text>
      </ScrollView>

      {/* Faction onboarding overlay */}
      {needsFactionSelection && (
        <View style={styles.factionOverlay}>
          <View style={[styles.factionModal, { borderColor: theme.borderColor, backgroundColor: '#050608' }]}>
            <Text style={[styles.factionModalTitle, { color: '#00ff33' }]}>
              CABal ALIGNMENT MATRIX
            </Text>
            <Text style={[styles.factionModalSub, { color: theme.mutedColor }]}>
              Select permanent allegiance to unlock hub systems and receive +200 Cabal Credits.
            </Text>

            {FACTION_ORDER.map((factionId) => {
              const def = FACTION_DEFINITIONS[factionId];
              return (
                <Pressable
                  key={factionId}
                  onPress={() => handleSelectFaction(factionId)}
                  style={({ pressed }) => [
                    styles.factionBlock,
                    {
                      borderColor: def.borderColor,
                      backgroundColor: pressed ? def.backgroundColor : `${def.backgroundColor}cc`,
                    },
                  ]}
                >
                  <Text style={[styles.factionName, { color: def.typographyColor }]}>
                    [{def.displayName}]
                  </Text>
                  <Text style={[styles.factionTagline, { color: def.secondaryColor }]}>
                    {def.tagline}
                  </Text>
                  <Text style={[styles.factionPerks, { color: def.accentColor }]}>
                    {factionId === 'TERRAN_GRID' && '+25 Max HP // 15% Passive Damage Mitigation'}
                    {factionId === 'LEGION' && '+15 Max Stamina // +10% Crit Chance'}
                    {factionId === 'SOLARIS' && '+20% Stamina Regen // +5 Signal Calibration'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loadingRoot: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontFamily: 'monospace', fontSize: 10, letterSpacing: 1 },
  gridBackdrop: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.35,
  },
  gridRow: { flex: 1, flexDirection: 'row' },
  gridCell: { flex: 1, borderWidth: 0.5 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 32, paddingTop: 8 },
  agencyStrip: {
    borderBottomWidth: 1,
    paddingVertical: 8,
    marginBottom: 12,
  },
  agencyStripText: {
    fontFamily: 'monospace',
    fontSize: 8,
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  dataBanner: {
    borderWidth: 2,
    padding: 14,
    marginBottom: 14,
  },
  bannerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 8,
  },
  bannerCell: { minWidth: (width - 64) / 3 - 8 },
  bannerLabel: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 1,
    marginBottom: 4,
  },
  bannerValue: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  xpSection: { marginBottom: 12 },
  xpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  xpNumbers: { fontFamily: 'monospace', fontSize: 9, fontWeight: '700' },
  xpTrack: { height: 8, borderWidth: 1, padding: 1 },
  xpFill: { height: '100%' },
  protocolBanner: {
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginTop: 4,
  },
  protocolLabel: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  panel: {
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  panelTitle: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  classSlot: {
    borderWidth: 1,
    padding: 10,
    marginBottom: 8,
  },
  className: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  classSub: {
    fontFamily: 'monospace',
    fontSize: 8,
    letterSpacing: 0.3,
    lineHeight: 12,
  },
  restrictedTag: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.5,
  },
  biomeList: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 0.5,
    lineHeight: 14,
  },
  incursionModule: {
    borderWidth: 2,
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  incursionTitle: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 6,
  },
  incursionSub: {
    fontFamily: 'monospace',
    fontSize: 8,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  footerMeta: {
    fontFamily: 'monospace',
    fontSize: 8,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  factionOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.88)',
    justifyContent: 'center',
    paddingHorizontal: 20,
    zIndex: 100,
  },
  factionModal: {
    borderWidth: 2,
    padding: 16,
  },
  factionModalTitle: {
    fontFamily: 'monospace',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.5,
    textAlign: 'center',
    marginBottom: 8,
  },
  factionModalSub: {
    fontFamily: 'monospace',
    fontSize: 9,
    textAlign: 'center',
    lineHeight: 14,
    marginBottom: 16,
  },
  factionBlock: {
    borderWidth: 2,
    padding: 12,
    marginBottom: 10,
  },
  factionName: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
  },
  factionTagline: {
    fontFamily: 'monospace',
    fontSize: 8,
    lineHeight: 12,
    marginBottom: 6,
  },
  factionPerks: {
    fontFamily: 'monospace',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  materialRow: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  decryptModule: {
    borderWidth: 2,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 10,
  },
  decryptTitle: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textAlign: 'center',
  },
  hubLogBox: {
    borderWidth: 1,
    padding: 10,
    marginTop: 4,
    maxHeight: 120,
  },
  hubLogLine: {
    fontFamily: 'monospace',
    fontSize: 8,
    letterSpacing: 0.3,
    marginBottom: 3,
  },
  armoryCategory: { marginBottom: 12 },
  armoryCategoryLabel: {
    fontFamily: 'monospace',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 6,
  },
  armoryEmpty: {
    fontFamily: 'monospace',
    fontSize: 8,
    marginBottom: 6,
  },
  armoryCard: {
    borderWidth: 1,
    padding: 10,
    marginBottom: 8,
  },
  armoryItemName: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
  },
  equippedTag: {
    fontFamily: 'monospace',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  armoryDesc: {
    fontFamily: 'monospace',
    fontSize: 8,
    lineHeight: 12,
    marginBottom: 4,
  },
  armoryStat: {
    fontFamily: 'monospace',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
