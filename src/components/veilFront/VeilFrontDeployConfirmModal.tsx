import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type View as ViewType,
} from 'react-native';
import HapticPressable from '../HapticPressable';
import TerminalText from '../TerminalText';
import HubPrimaryCta from '../hub/HubPrimaryCta';
import { usePlayerAccount } from '../../context/PlayerAccountContext';
import { useWorldState } from '../../context/WorldStateContext';
import { CLASS_DEFINITIONS } from '../../data/classes';
import { getEquippedWeaponForClass, resolveWeaponState } from '../../data/weaponProgressionEngine';
import { getWeaponPlayerFacingSummary } from '../../data/weaponPlayerFacing/weaponPlayerFacingEngine';
import { formatAbilityLabel, getActiveClassSnapshot } from '../../data/classLoadoutEngine';
import { getActiveAnchorInstance } from '../../data/anchorLifecycleEngine';
import { buildPreliminaryRunWorldContext } from '../../data/runWorldBriefEngine';
import { formatBreachGradeLabel, getBreachGradeTuning } from '../../data/breachGradeEngine';
import { resolvePlayerBadgePortrait } from '../../utils/combatPlayerPortrait';
import { describeEmployerPerks } from '../../utils/employerContractUi';
import { hazardLabel } from '../../utils/veilFrontSectorUi';
import {
  formatCompactContractObjective,
  formatCompactContractPayout,
  formatCompactContractValidSectors,
  formatDeploymentContractStatus,
  formatIncompatibleContractDeployConsequence,
  sponsorDisplayName,
  type ContractSectorCompatibility,
} from '../../utils/contractUi';
import type { PlayerAccount } from '../../types/game';
import type { OperativeProfile } from '../../types/profile';
import type { SectorState } from '../../types/worldState';
import type { SelectedContractState } from '../../types/contract';
import type { BreachGradeId } from '../../types/progression';
import type { TerminalTheme } from '../../types/theme';
import { useVeilFrontLayout } from './useVeilFrontLayout';

import { VEIL } from '../../theme/veilTerminalTokens';

const RAIL = {
  bg: VEIL.bg,
  textPrimary: VEIL.text,
  textSecondary: VEIL.textSoft,
  textMuted: VEIL.textMuted,
  terminal: VEIL.mint,
  terminalBright: VEIL.mintBright,
  incompat: VEIL.blood,
  line: VEIL.lineFaint,
  lineStrong: VEIL.line,
} as const;

interface VeilFrontDeployConfirmModalProps {
  visible: boolean;
  theme: TerminalTheme;
  profile: OperativeProfile;
  account: PlayerAccount;
  sector: SectorState;
  selectedContract: SelectedContractState;
  sectorCompatibility: ContractSectorCompatibility;
  selectedBreachGrade: BreachGradeId;
  launching: boolean;
  onContinue: () => void;
  onAbort: () => void;
}

function formatBreachGradeEffectLine(grade: BreachGradeId): string | null {
  const tuning = getBreachGradeTuning(grade);
  const parts: string[] = [];
  if (tuning.creditBonusPct > 0) parts.push(`+${tuning.creditBonusPct}% Credits`);
  if (tuning.rareLootBonusPct > 0) parts.push(`+${tuning.rareLootBonusPct}% Rare Loot`);
  if (tuning.eliteWeightDelta > 0) parts.push('Denser elites');
  return parts.length > 0 ? parts.join(' · ') : null;
}

function formatWeaponLine(weaponLine: string): string {
  return weaponLine.replace(/^WEAPON:\s*/i, '').trim().toUpperCase();
}

function resolveEquippedChassisLine(account: PlayerAccount): string {
  const progression = {
    weaponUnlocks: account.weaponUnlocks,
    equippedWeaponByClass: account.equippedWeaponByClass,
  };
  const familyId = getEquippedWeaponForClass(progression, account.activeClass);
  if (!familyId) return formatWeaponLine(CLASS_DEFINITIONS[account.activeClass].weaponLine);
  const facing = getWeaponPlayerFacingSummary(familyId);
  const display = resolveWeaponState(familyId).displayName;
  return `${display.toUpperCase()} · ${facing.roleLabel.toUpperCase()}`;
}

function ConditionItem({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string | null;
}): React.JSX.Element {
  return (
    <View style={styles.conditionItem}>
      <TerminalText size={7} letterSpacing={0.9} style={styles.conditionLabel}>
        {label}
      </TerminalText>
      <TerminalText size={8.5} style={styles.conditionValue}>
        {value}
      </TerminalText>
      {detail ? (
        <TerminalText size={7.5} style={styles.conditionDetail}>
          {detail}
        </TerminalText>
      ) : null}
    </View>
  );
}

function getFocusableElements(root: HTMLElement): HTMLElement[] {
  const nodes = root.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
  );
  return Array.from(nodes).filter((el) => {
    if (el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  });
}

export default function VeilFrontDeployConfirmModal({
  visible,
  theme: _theme,
  profile,
  account,
  sector,
  selectedContract,
  sectorCompatibility,
  selectedBreachGrade,
  launching,
  onContinue,
  onAbort,
}: VeilFrontDeployConfirmModalProps): React.JSX.Element {
  const { scaleSpacing, isCompactHeight } = useVeilFrontLayout();
  const { cycleActiveClass } = usePlayerAccount();
  const { persisted } = useWorldState();
  const dialogRef = useRef<ViewType | null>(null);
  const returnBtnRef = useRef<ViewType | null>(null);
  const previousFocusRef = useRef<Element | null>(null);

  const classDef = CLASS_DEFINITIONS[account.activeClass];
  const portraitSource = useMemo(
    () => resolvePlayerBadgePortrait(account.activeClass),
    [account.activeClass],
  );
  const canCycleClass = account.unlockedClasses.length > 1;
  const loadoutLine = useMemo(() => {
    const snapshot = getActiveClassSnapshot(account);
    return snapshot.loadout
      .map((abilityId) => (
        formatAbilityLabel(account.activeClass, abilityId)
          .replace(/^\[\s*/, '')
          .replace(/\s*\]$/, '')
      ))
      .join(' · ');
  }, [account]);

  const crisisPreview = useMemo(() => {
    const anchor = getActiveAnchorInstance(persisted, sector.id);
    return buildPreliminaryRunWorldContext({
      persisted,
      sectorState: sector,
      operation: sector.activeOperation,
      anchor,
    });
  }, [persisted, sector]);

  const isSponsor = selectedContract.kind === 'SPONSOR';
  const contract = isSponsor ? selectedContract.contract : null;
  const status = formatDeploymentContractStatus(sectorCompatibility);
  const incompatible = status === 'INCOMPATIBLE';
  const compatible = status === 'COMPATIBLE';
  const gradeEffect = formatBreachGradeEffectLine(selectedBreachGrade);
  const deployEffects = isSponsor ? describeEmployerPerks(contract!.sponsorId) : [];
  const deployEffectsLine = deployEffects.length > 0 && deployEffects[0] !== 'Standard sponsor terms'
    ? deployEffects.join(' · ')
    : null;
  const anomalyName = crisisPreview.crisisDisplayName?.trim()
    || sector.activeAnchor?.displayName
    || null;
  const runnerName = (profile.operative_profile.credentials.username || 'RUNNER').toUpperCase();
  const clearance = account.progressionProfile.runner.clearanceRank;

  const primaryLabel = launching ? '[ DEPLOYING... ]' : '[ CONFIRM ]';

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return undefined;
    const styleId = 'deployment-modal-focus-styles';
    if (document.getElementById(styleId)) return undefined;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
[data-deployment-modal] button:focus-visible,
[data-deployment-modal] [role="button"]:focus-visible,
[data-deployment-modal] a:focus-visible {
  outline: 2px solid ${RAIL.terminalBright} !important;
  outline-offset: 2px !important;
}
@media (prefers-reduced-motion: reduce) {
  [data-deployment-modal] {
    transition: none !important;
  }
}`;
    document.head.appendChild(style);
    return undefined;
  }, []);

  useEffect(() => {
    if (!visible || Platform.OS !== 'web') {
      if (!visible && Platform.OS === 'web' && previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus();
      }
      if (!visible) previousFocusRef.current = null;
      return undefined;
    }

    previousFocusRef.current = document.activeElement;

    const focusReturn = () => {
      const node = returnBtnRef.current as unknown as HTMLElement | null;
      if (!node?.focus) return;
      try {
        node.focus({ focusVisible: true } as FocusOptions);
      } catch {
        node.focus();
      }
    };
    const id = requestAnimationFrame(focusReturn);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!launching) onAbort();
        return;
      }

      if (event.key !== 'Tab') return;
      const root = dialogRef.current as unknown as HTMLElement | null;
      if (!root) return;
      const focusable = getFocusableElements(root);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey) {
        if (!active || active === first || !root.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (!active || active === last || !root.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [visible, launching, onAbort]);

  const compact = isCompactHeight;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onAbort}>
      <View style={[styles.backdrop, compact && styles.backdropCompact]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => {
            if (!launching) onAbort();
          }}
          accessibilityRole="button"
          accessibilityLabel="Dismiss deployment confirmation"
        />
        <View
          ref={dialogRef}
          style={[styles.modal, compact && styles.modalCompact]}
          // Keep clicks inside the dialog from hitting the dismiss layer.
          onStartShouldSetResponder={() => true}
          {...(Platform.OS === 'web'
            ? ({
                role: 'dialog',
                'aria-modal': true,
                'aria-labelledby': 'deployment-confirmation-title',
                'data-deployment-modal': 'true',
              } as object)
            : {
                accessibilityViewIsModal: true,
                accessibilityLabel: 'Confirm Breach',
              })}
        >
          <View style={[styles.header, compact && styles.headerCompact]}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <TerminalText size={7.5} letterSpacing={1} style={styles.eyebrow}>
                DEPLOYMENT AUTHORIZATION
              </TerminalText>
              <TerminalText
                nativeID="deployment-confirmation-title"
                size={13.5}
                letterSpacing={0.7}
                style={styles.title}
                {...(Platform.OS === 'web' ? ({ id: 'deployment-confirmation-title' } as object) : {})}
              >
                CONFIRM BREACH
              </TerminalText>
            </View>
            <View style={styles.target}>
              <TerminalText size={8.5} letterSpacing={0.7} style={styles.targetSector} numberOfLines={1}>
                {sector.displayName.replace(/^The\s+/i, '').toUpperCase()}
              </TerminalText>
              <TerminalText size={7.5} letterSpacing={0.8} style={styles.targetGrade}>
                {`BREACH GRADE ${formatBreachGradeLabel(selectedBreachGrade, true).replace(/^Grade\s+/i, '')}`}
              </TerminalText>
            </View>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={[
              styles.bodyContent,
              { padding: scaleSpacing(compact ? 15 : 20) },
            ]}
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="handled"
            {...(Platform.OS === 'web'
              ? ({
                  // Keep noninteractive body out of the tab order (avoids blue body outline).
                  tabIndex: -1,
                } as object)
              : null)}
          >
            {!isSponsor ? (
              <View style={styles.contractBlock}>
                <TerminalText size={7.5} letterSpacing={1} style={styles.sectionLabel}>
                  CURRENT CONTRACT
                </TerminalText>
                <TerminalText size={8.5} letterSpacing={0.4} style={styles.contractIdentity}>
                  NO CONTRACT SELECTED
                </TerminalText>
                <TerminalText size={8} style={styles.contractDetail}>
                  Deployment will not advance Cabal reputation
                </TerminalText>
              </View>
            ) : (
              <View
                style={[
                  styles.contractBlock,
                  compatible && styles.contractCompatible,
                  incompatible && styles.contractIncompatible,
                ]}
              >
                <View style={styles.contractTopline}>
                  <TerminalText size={7.5} letterSpacing={1} style={styles.sectionLabel}>
                    CURRENT CONTRACT
                  </TerminalText>
                  <TerminalText
                    size={7}
                    letterSpacing={0.8}
                    style={[
                      styles.contractStatus,
                      compatible && styles.contractStatusCompatible,
                      incompatible && styles.contractStatusIncompatible,
                    ]}
                  >
                    {status}
                  </TerminalText>
                </View>
                <TerminalText
                  size={8.5}
                  letterSpacing={0.4}
                  numberOfLines={2}
                  style={styles.contractIdentity}
                >
                  {`${sponsorDisplayName(contract!.sponsorId).toUpperCase()} · ${contract!.title.toUpperCase()}`}
                </TerminalText>
                <TerminalText size={8} numberOfLines={2} style={styles.contractDetail}>
                  {incompatible
                    ? formatIncompatibleContractDeployConsequence(contract!, sector.displayName)
                    : formatCompactContractObjective(contract!)}
                </TerminalText>
                {incompatible ? (
                  <TerminalText size={8} numberOfLines={2} style={styles.contractDetail}>
                    {formatCompactContractValidSectors(contract!)}
                  </TerminalText>
                ) : null}
                <TerminalText size={8} style={styles.contractPayout}>
                  {formatCompactContractPayout(contract!)}
                </TerminalText>
              </View>
            )}

            <View style={[styles.runner, compact && styles.runnerCompact]}>
              <Image
                source={portraitSource}
                style={styles.portrait}
                resizeMode="contain"
                accessible
                accessibilityLabel={`${runnerName} portrait`}
              />
              <View style={styles.runnerIdentity}>
                <TerminalText size={10.5} style={styles.runnerName} numberOfLines={1}>
                  {runnerName}
                </TerminalText>
                <TerminalText size={8} letterSpacing={0.5} style={styles.runnerMeta} numberOfLines={1}>
                  {`${classDef.displayName.toUpperCase()} · CLEARANCE ${clearance}`}
                </TerminalText>
                <TerminalText size={8} style={styles.runnerWeapon} numberOfLines={1}>
                  {resolveEquippedChassisLine(account)}
                </TerminalText>
              </View>
              {canCycleClass ? (
                <View style={styles.runnerControls}>
                  <HapticPressable
                    onPress={() => cycleActiveClass(-1)}
                    accessibilityRole="button"
                    accessibilityLabel="Previous runner"
                    style={({ pressed }) => [styles.runnerControl, pressed && { opacity: 0.75 }]}
                  >
                    <TerminalText size={9} style={{ color: RAIL.textSecondary, fontWeight: '800' }}>
                      {'<'}
                    </TerminalText>
                  </HapticPressable>
                  <HapticPressable
                    onPress={() => cycleActiveClass(1)}
                    accessibilityRole="button"
                    accessibilityLabel="Next runner"
                    style={({ pressed }) => [styles.runnerControl, pressed && { opacity: 0.75 }]}
                  >
                    <TerminalText size={9} style={{ color: RAIL.textSecondary, fontWeight: '800' }}>
                      {'>'}
                    </TerminalText>
                  </HapticPressable>
                </View>
              ) : null}
            </View>

            <View style={styles.loadout}>
              <TerminalText size={7.5} letterSpacing={1} style={styles.sectionLabel}>
                LOADOUT
              </TerminalText>
              <TerminalText size={8} style={styles.loadoutAbilities}>
                {loadoutLine.toUpperCase()}
              </TerminalText>
            </View>

            <View style={[styles.conditions, compact && styles.conditionsCompact]}>
              <TerminalText size={7.5} letterSpacing={1} style={styles.sectionLabel}>
                DEPLOYMENT CONDITIONS
              </TerminalText>
              <View style={styles.conditionsGrid}>
                <ConditionItem
                  label="THREAT"
                  value={hazardLabel(sector.hazardLevel).toUpperCase()}
                />
                {anomalyName ? (
                  <ConditionItem
                    label="SECTOR ANOMALY"
                    value={anomalyName.toUpperCase()}
                  />
                ) : null}
                {deployEffectsLine ? (
                  <ConditionItem
                    label="DEPLOYMENT EFFECTS"
                    value={deployEffectsLine}
                  />
                ) : null}
                <ConditionItem
                  label="OPERATION"
                  value={`Contributes to ${sector.activeOperation.title}`}
                />
                {gradeEffect ? (
                  <ConditionItem
                    label="BREACH MODIFIERS"
                    value={gradeEffect}
                  />
                ) : null}
              </View>
            </View>
          </ScrollView>

          <View style={[styles.footer, compact && styles.footerCompact]}>
            <View style={styles.footerActions}>
              <View ref={returnBtnRef} style={styles.button} collapsable={false}>
                <HubPrimaryCta
                  label="[ ABORT ]"
                  onPress={onAbort}
                  disabled={launching}
                  variant="danger"
                  accessibilityLabel="Abort"
                  minHeight={54}
                />
              </View>
              <HubPrimaryCta
                label={primaryLabel}
                onPress={onContinue}
                disabled={launching}
                variant="glow"
                accessibilityLabel="Confirm"
                minHeight={54}
                style={styles.button}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
    backgroundColor: 'rgba(0, 3, 3, 0.78)',
    position: 'relative',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(1.5px) brightness(0.52)',
      } as object,
      default: {},
    }),
  },
  backdropCompact: {
    paddingVertical: 24,
  },
  modal: {
    width: '100%',
    maxWidth: 820,
    maxHeight: '100%',
    zIndex: 1,
    ...Platform.select({
      web: {
        maxHeight: 'calc(100dvh - 80px)',
        width: 'min(820px, calc(100vw - 48px))',
      } as object,
      default: { maxHeight: '92%' },
    }),
    overflow: 'hidden',
    backgroundColor: RAIL.bg,
    borderWidth: 1,
    borderColor: RAIL.lineStrong,
    ...Platform.select({
      web: {
        display: 'grid',
        gridTemplateRows: 'auto minmax(0, 1fr) auto',
        backgroundImage:
          'linear-gradient(180deg, rgba(13, 25, 23, 0.3), rgba(4, 8, 9, 0) 160px), #040809',
        boxShadow:
          '0 24px 80px rgba(0, 0, 0, 0.65), inset 0 1px rgba(255, 255, 255, 0.02)',
        outlineStyle: 'none',
      } as object,
      default: {},
    }),
  },
  modalCompact: {
    ...Platform.select({
      web: { maxHeight: 'calc(100dvh - 48px)' } as object,
      default: {},
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 24,
    paddingHorizontal: 26,
    paddingTop: 22,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: RAIL.line,
    flexShrink: 0,
  },
  headerCompact: {
    paddingTop: 17,
    paddingBottom: 14,
  },
  eyebrow: {
    color: RAIL.textMuted,
    fontWeight: '700',
  },
  title: {
    marginTop: 6,
    color: RAIL.textPrimary,
    fontWeight: '700',
  },
  target: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  targetSector: {
    color: RAIL.terminalBright,
    fontWeight: '700',
  },
  targetGrade: {
    marginTop: 4,
    color: RAIL.textMuted,
    fontWeight: '700',
  },
  body: {
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
  },
  bodyContent: {
    paddingBottom: 8,
  },
  sectionLabel: {
    color: RAIL.textMuted,
    fontWeight: '700',
  },
  contractBlock: {
    paddingVertical: 12,
    paddingHorizontal: 15,
    backgroundColor: 'rgba(105, 200, 173, 0.04)',
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(105, 200, 173, 0.48)',
  },
  contractCompatible: {
    borderLeftColor: 'rgba(105, 200, 173, 0.48)',
  },
  contractIncompatible: {
    backgroundColor: 'rgba(201, 98, 98, 0.05)',
    borderLeftColor: 'rgba(201, 98, 98, 0.7)',
  },
  contractTopline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  contractStatus: {
    color: RAIL.textMuted,
    fontWeight: '800',
  },
  contractStatusCompatible: {
    color: RAIL.terminal,
  },
  contractStatusIncompatible: {
    color: RAIL.incompat,
  },
  contractIdentity: {
    marginTop: 7,
    color: RAIL.textPrimary,
    fontWeight: '700',
  },
  contractDetail: {
    marginTop: 4,
    color: RAIL.textSecondary,
    lineHeight: 18,
  },
  contractPayout: {
    marginTop: 5,
    color: '#afbfba',
    fontVariant: ['tabular-nums'],
  },
  runner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 18,
    paddingBottom: 14,
  },
  runnerCompact: {
    marginTop: 14,
    paddingBottom: 12,
  },
  portrait: {
    width: 76,
    height: 76,
    backgroundColor: 'rgba(108, 137, 132, 0.055)',
    borderWidth: 1,
    borderColor: 'rgba(137, 170, 163, 0.2)',
  },
  runnerIdentity: {
    flex: 1,
    minWidth: 0,
  },
  runnerName: {
    color: RAIL.textPrimary,
    fontWeight: '800',
  },
  runnerMeta: {
    marginTop: 4,
    color: RAIL.textSecondary,
    fontWeight: '700',
  },
  runnerWeapon: {
    marginTop: 4,
    color: RAIL.textSecondary,
  },
  runnerControls: {
    flexDirection: 'row',
    gap: 6,
  },
  runnerControl: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(105, 200, 173, 0.025)',
    borderWidth: 1,
    borderColor: 'rgba(137, 170, 163, 0.18)',
    ...Platform.select({
      web: { cursor: 'pointer', outlineStyle: 'none' } as object,
      default: {},
    }),
  },
  loadout: {
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: RAIL.line,
  },
  loadoutAbilities: {
    marginTop: 6,
    color: RAIL.textSecondary,
    lineHeight: 19,
  },
  conditions: {
    marginTop: 18,
  },
  conditionsCompact: {
    marginTop: 14,
  },
  conditionsGrid: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    ...Platform.select({
      web: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        columnGap: 28,
        rowGap: 14,
      } as object,
      default: {},
    }),
  },
  conditionItem: {
    ...Platform.select({
      default: { width: '47%', minWidth: 160 },
      web: { width: 'auto', minWidth: 0 } as object,
    }),
  },
  conditionLabel: {
    color: RAIL.textMuted,
    fontWeight: '700',
  },
  conditionValue: {
    marginTop: 4,
    color: RAIL.textPrimary,
    lineHeight: 19,
  },
  conditionDetail: {
    marginTop: 2,
    color: RAIL.textMuted,
    lineHeight: 16,
  },
  footer: {
    flexShrink: 0,
    paddingHorizontal: 26,
    paddingTop: 16,
    paddingBottom: 22,
    backgroundColor: 'rgba(3, 7, 8, 0.96)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(137, 190, 179, 0.22)',
  },
  footerCompact: {
    paddingTop: 13,
    paddingBottom: 15,
  },
  footerActions: {
    flexDirection: 'row',
    gap: 11,
    ...Platform.select({
      web: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
      } as object,
      default: {},
    }),
  },
  button: {
    flex: 1,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        outlineStyle: 'none',
      } as object,
      default: {},
    }),
  },
  buttonSecondary: {
    backgroundColor: 'rgba(112, 139, 133, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(137, 170, 163, 0.25)',
  },
  buttonFocused: {
    borderColor: RAIL.terminalBright,
    ...Platform.select({
      web: {
        outlineStyle: 'solid',
        outlineWidth: 2,
        outlineColor: RAIL.terminalBright,
        outlineOffset: 2,
      } as object,
      default: {},
    }),
  },
  buttonSecondaryText: {
    color: RAIL.textPrimary,
    fontWeight: '800',
    textAlign: 'center',
  },
});
