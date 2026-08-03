import React, { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { StyleSheet, View, Text, Animated, Easing, Dimensions, Vibration, PanResponder } from 'react-native';
import { USE_NATIVE_DRIVER } from '../utils/platformMotion';
import HapticPressable from './HapticPressable';
import {
  cancelAnimation,
  Easing as ReanimatedEasing,
  runOnJS,
  runOnUI,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTerminal } from '../context/TerminalContext';
import { advanceEnemyIntent } from '../data/enemies';
import { markEnemyRecentlyDamaged } from '../data/enemyAiMemory';
import { resolveEffectiveEnemyIntent, isEvadePostureActive } from '../data/enemyIntentUtils';
import { resolveActiveEnemyStatuses } from '../utils/enemyStatusEffects';
import type { PlayerAIState } from '../data/AIDecisionEngine';
import {
  computeBloodFrenzyHeal,
  scaleKineticDamage,
  type KineticDamageSource,
} from '../data/combatEnvironmentEngine';
import { bossStrikeDamage, rollBossIntent, shouldShiftBossPhase } from '../data/bossCombat';
import {
  ENEMY_ROSTER,
  factionForDistrict,
  resolveEnemyThreatTier,
  type EnemyRosterId,
} from '../data/enemyRoster';
import { COMBAT_ACTION, ENEMY_ABYSSAL_SIPHON_REQUEST, EnemyCombatProfile, EnemyIntent } from '../types/run';
import type { IncursionConsumableUseResult } from '../types/incursionInventory';
import {
  applyCritMultiplier,
  resolveEnemyAttackHit,
  resolvePlayerAttackHit,
} from '../data/combatChanceEngine';
import {
  COMBAT_CHANCE,
  createDefaultCombatChanceState,
  type CombatChanceEncounterState,
  type CombatFeedbackEvent,
} from '../types/combatChance';
import CombatFloatingFeedback from './combat/CombatFloatingFeedback';
import CombatCenterStatusFloat from './combat/CombatCenterStatusFloat';
import { DEFAULT_AEGIS_LOADOUT, PLAYER_ACTION_POINTS_PER_TURN, RUNIC_BRAND_CAP, VOID_WARD_AP_COST, VOID_WARD_PERFECT_RESERVE_GAIN, type AegisAbilityId, type AegisLoadout } from '../types/aegisCombat';
import { getAbilityDefinition } from '../data/aegisAbilities';
import { buildGraftCastPlan, canAffordGraftResources, scaleGraftDamage } from '../data/veilGraftEngine';
import { getVeilGraftDefinition } from '../data/veilGraftDatabase';
import type { GraftCastPlan } from '../types/veilGraft';
import {
  APEX_TRIGGER_AP_REFUND_CAP_PER_ENCOUNTER,
  accrueGraftSalvageCredits,
  canRefundApexTriggerAp,
  createDefaultGraftEncounterSafetyState,
  recordApexTriggerApRefund,
} from '../data/graftSynergy/graftEncounterSafety';
import { COMBAT_CONSUMABLE_AP_COST, resolveHostileHpHit } from '../data/aegisAbilityResolver';
import { stripKineticArmor, stripOccultWards } from '../data/combatDefenseLayerEngine';
import { DEFENSE_TELEGRAPH_PROFILES } from '../data/combatArenaDefenseTelegraphEngine';
import { resolveAbilityUiCategory } from '../data/combatAbilityDefenseTags';
import { COMBAT_DEFENSE_BALANCE } from '../data/balance/combatDefenseBalanceConfig';
import { resolveAbilityDefenseTags } from '../data/combatAbilityDefenseTags';
import {
  estimateTurnsRemaining,
  getIntentSeverity,
  getIntentType,
} from '../data/enemyIntentCatalog';
import {
  applyIntentCounterplayToEnemy,
  enemyIsTelegraphing,
  isIntentParryable,
  resolveIntentCounterplay,
} from '../data/enemyIntentCounterplayEngine';
import {
  createEmptyIntentTelemetry,
  recordIntentCountered,
  recordIntentGenerated,
  recordIntentResolved,
  type CombatIntentTelemetry,
} from '../data/balance/combatIntentTelemetryEngine';
import {
  createEmptyClassLoopTelemetry,
  type ClassLoopTelemetry,
} from '../data/balance/classLoopTelemetryEngine';
import {
  createEmptyObjectiveTelemetry,
  type EncounterObjectiveTelemetry,
} from '../data/balance/encounterObjectiveTelemetryEngine';
import {
  buildEncounterObjectiveSession,
  createEmptyEncounterObjectiveSession,
  formatObjectiveBriefing,
  formatObjectiveHudLine,
  getIncomingDamageMitigationFromStamp,
  progressObjectiveOnChannelInterrupt,
  progressObjectiveOnEnemyTurnEnd,
  progressObjectiveOnMarkedKill,
  progressObjectiveOnSquadCleared,
} from '../data/encounterObjectiveEngine';
import type { EncounterObjectiveSession } from '../types/encounterObjective';
import {
  buildCombatJuiceEvent,
  createEmptyJuiceTelemetry,
  recordJuiceEvent,
  type CombatJuiceTelemetry,
} from '../data/combatJuiceFeedbackEngine';
import type { CombatJuiceFeedbackEvent } from '../types/combatJuiceFeedback';
import { resolveStartOfTurnDangerPulse } from '../data/combatDangerPulseEngine';
import { formatHexAmmoCounterHint, getHexAmmoProfileForAbility } from '../data/hexShotAmmoProfiles';
import {
  applyEnvoyCatalystPayoffToTarget,
  catalystForEnvoyAbility,
  formatCatalystChip,
  primeEnvoyCatalyst,
  resolveEnvoyCatalystSequence,
} from '../data/envoyCatalystEngine';
import { formatIntentWarningBanner } from '../utils/enemyIntentDescriptions';

/** Player-side kinetic armor bonus — soft % mitigation (not enemy stack model). */
function mitigatePlayerKineticArmorBonus(raw: number, layers: number): number {
  if (layers <= 0 || raw <= 0) return raw;
  const reduction = Math.min(
    0.35,
    COMBAT_DEFENSE_BALANCE.defaultKineticArmorReductionPercent + (layers - 1) * 0.05,
  );
  return Math.max(0, Math.floor(raw * (1 - reduction)));
}
import { combatConsumableApCost } from '../data/cargoGridEngine';
import type { CargoItemId } from '../types/cargoGrid';
import type { CombatGridSlotId } from '../types/combatGrid';
import {
  executeExtendedAbility,
  getAegisAbilityDisableReason,
  isExtendedAbilityEnabled,
  type PlayerCombatBuffState,
} from '../data/aegisAbilityExecutor';
import {
  aggregateMutationModifiers,
  boonMatchesAction,
  createDefaultBoonEncounterState,
  hasMutation,
  modifierForAction,
  targetIsExposed,
  type MutationCombatModifiers,
} from '../data/boonEngine';
import {
  applyAbyssalResonanceDamage,
  applyVoidResonanceDamage,
  resolveVoidResonanceOnAbilityResolve,
  runOnEvadeSuccess,
  runOnFracturedKill,
  runOnParryFail,
  runOnParryPerfect,
  runOnReserveGenerate,
  type AegisBoonHookContext,
} from '../data/aegisBoonHookRunner';
import { getAbilityTags } from '../data/aegisAbilities';
import type { LeyLineMutationId } from '../types/leyLineMutation';
import type { EnvoyBoonId, HexShotBoonId } from '../types/classBoon';
import { createDefaultClassBoonEncounterState } from '../types/classBoon';
import type {
  EnvoyAbilityGraftMap,
  HexShotAbilityGraftMap,
  ClassGraftCastPlan,
} from '../types/classGraft';
import {
  buildClassGraftCastPlan,
  effectiveGraftAmmoCost,
  isClassUltimateDisabledForEncounter,
  isDeadMansSwitchReloadGraft,
  scaleClassGraftDamage,
} from '../data/classGraftEngine';
import {
  aggregateEnvoyBoonModifiers,
  aggregateHexShotBoonModifiers,
  boonMatchesEnvoyAction,
  boonMatchesHexAction,
  hasEnvoyBoon,
  hasHexShotBoon,
  isUsingWraithglassAmmo,
} from '../data/classBoonEngine';
import {
  runClassTakeDamageBoons,
  runEnvoyEvadeSuccessBoons,
  runEnvoyRiftWardSuccessBoons,
  runEnvoyRiftWardTriggerBoons,
  runEnvoyTurnStartBoons,
  runHexShotKillBoons,
} from '../data/classBoonHookRunner';
import {
  adjustHexShotOutgoingDamage,
  applyVoidBleedDot,
  getHexShotCritOverrides,
  isOverwatchMasteryActive,
  runHexShotOnReloadResolveBoons,
  runHexShotKillBurstBoons,
  runHexShotOnAbilityResolveBoons,
  runHexShotOnHitBoons,
  applyHexShotTacticalReloadDiscount,
  tickHexShotChemicalWarfare,
  tryHexShotPanicButton,
} from '../data/hexShotBoonHookRunner';
import {
  adjustEnvoyOutgoingDamage,
  applyEnvoyHeavyGravityApDrain,
  applyEnvoyWardWeaverApDiscount,
  getCataclysmicEchoDamageBonus,
  getEnvoyVolatileMagicCritBonus,
  resolveEnvoyAethericBulwarkArmor,
  runAgonizingHexOnEnemyTurn,
  runEnvoyKillBoonsExtended,
  runEnvoyOnAbilityResolveBoons,
  runEnvoyOnHitBoons,
  runEnvoyVoidSiphonedEntryBoons,
  runHexBreakerOnRotPurge,
  syncEnvoyFleshRotArmorDebuff,
  tryEnvoyBloodMagicCast,
  markEnemyCursed,
} from '../data/envoyBoonHookRunner';
import {
  applyClassGraftEnemyApDrains,
  applyClassGraftTargetPatch,
  collectClassGraftCastSideEffects,
  finalizeClassGraftAfterAbility,
  resolveClassGraftFailDebuff,
  resolveClassGraftSurviveDebuff,
  resolveClassGraftStrikeTargetIds,
} from '../data/classGraftRuntime';
import { getHexShotAbilityTags } from '../data/hexShotAbilities';
import { shouldApplyPhantomFeed } from '../data/hexShotIntrinsics';
import { resolveHexShotAbilityGraftId } from '../data/hexShotMigration';
import { getEnvoyAbilityTags } from '../data/envoyAbilities';
import { normalizeSquad, spawnCombatSquad, squadFromSingleEnemy } from '../data/combatSpawnEngine';
import {
  allUnitsDefeated,
  adjacentAliveUnits,
  aliveUnits,
  canUnitAct,
  getUnitById,
  isUnitAlive,
  nextDefaultTarget,
  primaryAliveUnit,
  reconcileSquadGridSlots,
  updateUnit as patchSquadUnit,
} from '../data/combatSquadEngine';
import {
  abilityRequiresTarget,
  abilityTargetMode,
  canTargetWithAbility,
  isUnitBlockedForAbility,
  isUnitHookValid,
  validTargetsForAbility,
} from '../data/combatTargeting';
import {
  BREACHER_STAMINA_DRAIN,
  SPOTTER_ARTILLERY_TRUE_DAMAGE,
} from '../data/rivalMercCombatConstants';
import {
  pickThreatBudgetActions,
  recoverFracturedUnits,
  THREAT_BUDGET_AMBUSH,
  THREAT_BUDGET_ELITE,
  THREAT_BUDGET_STANDARD,
} from '../data/combatThreatBudget';
import {
  addCombatTag,
  applyDamageWithFractureBonus,
  applyFractureDamage,
  applyFracturedState,
  willFractureBreak,
  doomedPulseStacks,
  fractureRatio,
  initEnemyCombatLayers,
  isEnemyFractured,
  recoverFromFracture,
  stackDoomedTag,
} from '../data/combatFractureEngine';
import type { WeaponFamilyId, WeaponTierNumber } from '../types/weapon';
import {
  applyWeaponBallisticDamageMultiplier,
  applyWeaponOccultDamageMultiplier,
  applyWeaponArmorPierceToTarget,
  buildResolvedWeaponForRun,
  consumeWeaponPostReloadBonus,
  didWeaponPostReloadBonus,
  resolveWeaponMagazineBonus,
  runWeaponOnBallisticHitHooks,
  runWeaponOnFractureHooks,
  runWeaponOnMeleeHitHooks,
  runWeaponOnOccultCastHooks,
  runWeaponOnReloadHooks,
  runWeaponOnSacrificeHpHooks,
  runWeaponOnDebuffAppliedHooks,
  scaleFractureGain,
  stripExtraArmorFromTarget,
  weaponCritChanceBonus,
  resolveWeaponArmorPressureLayers,
} from '../data/weaponCombatEngine';
import {
  armRiftEdgeTempo,
  consumeRiftEdgeTempo,
  resolveAegisStrikeBasic,
  resolveClaymoreFractureBreakReserve,
  PRISM_BASIC_HP_SACRIFICE_MAX,
  PRISM_BASIC_HP_SACRIFICE_PCT,
  PRISM_BRINK_FLUX_THRESHOLD,
} from '../data/weaponBasicEngine';
import { resolvePlayerHealReceived, scalePlayerOriginDebuffDuration } from '../data/weaponModifierResolution';
import { createDefaultWeaponRuntime } from '../data/weaponRunState';
import { CombatLifecycleManager, applyHookWeaverTetherAction, applyLeySirenTetherAction, tickThrallSlumpsAtPlayerTurnEnd } from '../data/combatLifecycleEngine';
import {
  applyAshenBreathDebt,
  applyBindingWardToAlly,
  applyBloodRushToReavers,
  applyRivalHexMark,
  applyRivalHexedOccultMultiplier,
  clampPlayerHpToEffectiveMax,
  clearPlayerMaxHpDebt,
  consumeRivalHexedDebuff,
  getEffectivePlayerMaxHp,
  hollowLungsActive,
  initPlayerMaxHpDebtTracking,
  primeReaverGuardBreak,
  recordPlayerDefendStreak,
  resolveReaverAttackDamage,
  rivalHexedStaminaTax,
  tryAbsorbRivalBindingWard,
  tryRivalEmergencySwap,
  rivalWardBreakPatch,
} from '../data/encounterMechanicsEngine';
import {
  applyCoreSickModifierToSquad,
  applyFoldedModifierToSquad,
  createEncounterModifierCombatRuntime,
  resolveBleedingCyclePulse,
  resolveEncounterModifierIntroLog,
  resolveMirroredKillPulse,
  resolveResonantOutgoingDamageMultiplier,
  type EncounterModifierCombatRuntime,
} from '../data/encounterModifierCombatEngine';
import {
  createDepthVariantCombatRuntime,
  formatDepthVariantCombatIntro,
  resolveAnchorHuskAllyDamageMultiplier,
  resolveStaticCallerMeleeStaminaMultiplier,
  resolveTarChoirOutgoingDamageMultiplier,
  resolveWeepingGargoyleFracturePulse,
  consumeTarChoirMark,
  markTarChoirOnHit,
  type DepthVariantCombatRuntime,
} from '../data/depthEnemyVariantCombatEngine';
import type { EncounterModifierId } from '../types/depthIdentity';
import { isRosterSpecificIntent, isNullShadeVoidAmbush, nullShadeVoidAmbushCleanupPatch, patchRosterAfterIntentExec, resolveRosterEnemyDamage, ROSTER_AI_WEIGHTS, syncRosterCombatState, VOID_AMBUSH_CRIT_CHANCE, VOID_AMBUSH_INTERRUPT_THRESHOLD } from '../data/combatRosterActions';
import { getAlphaMechanic } from '../data/enemyAlphaConfig';
import {
  fixerDistrictFromProfile,
  fixerRepairTarget,
  rollFixerRepairAmount,
} from '../data/fixerRepairEngine';
import type { PlayerCombatState } from '../types/combatLifecycle';
import type { CombatSessionExtras } from '../types/combatHooks';
import { createDefaultCombatSessionExtras, addStructuredDebuff, hasStructuredDebuff, removeStructuredDebuff } from '../types/combatHooks';
import { isHeavyArchetype, type EnemySpawnArchetype } from '../data/enemyCombatConfig';
import {
  getEnemyAccuracyPenalty,
  getEnemyDamageTakenMultiplier,
  patchEnemyTagsFromExtras,
  tickCombatSessionExtras,
  applyFrontlineBlinded,
} from '../data/combatHookRunner';

import { ResolvedWeaponCombatStats } from '../data/inventory';
import { BossRuntimeProfile, EnvironmentalModifiers, type ClassType } from '../types/game';
import {
  DEFAULT_MAGAZINE_SIZE,
  VEIL_FLUX_START,
  VOID_SIPHONED_SELF_DAMAGE,
  type ActiveReloadResult,
  type EnvoyCombatState,
} from '../types/classCombatResources';
import {
  createInitialEnvoyCombatState,
  evaluateEnvoyCataclysmReady,
  isEnvoyCastBlockedByVoidSiphon,
} from '../types/envoyState';
import { envoyReducer, type EnvoyReducerAction } from '../reducers/envoyReducer';
import {
  CATALYTIC_CONSOLE_AP_COST,
  CATALYTIC_SLOPPY_FLUX_PENALTY,
  CATACLYSM_ROT_GATE,
  computeCataclysmSigilDamage,
  executeCatalyticRelease,
  getVeilRotStacks,
  purgeAllVeilRotStacks,
  consumeVeilRotStacks,
  tickVeilRotEndOfEnemyTurn,
  totalCatalyticPayload,
  totalVeilRotStacks,
} from '../data/envoyRotEngine';
import {
  abilityUsesBallisticTags,
  canBeginHexShotReload,
  hexShotReducer,
  type HexShotReducerAction,
} from '../reducers/hexShotReducer';
import {
  createInitialHexShotCombatState,
  HEX_RELOAD_AP_COST,
  type HexShotCombatState,
} from '../types/hexShotState';
import {
  HEX_AMMO_META,
  HEX_MAGAZINE_CONFIG,
  type HexAmmoType,
  type ReloadQuality,
} from '../types/hexAmmo';
import {
  applyHexAmmoEffect,
  createHexAmmoCastTracker,
  recordHexAmmoEffect,
  type HexAmmoCastTracker,
  type HexAmmoEffectResult,
} from '../data/hexAmmoEffectEngine';
import ActiveReloadOverlay from './combat/ActiveReloadOverlay';
import ZeroProtocolGridOverlay from './combat/ZeroProtocolGridOverlay';
import CataclysmSigilOverlay from './combat/CataclysmSigilOverlay';
import WeaponUltimateHostChrome from './combat/WeaponUltimateHostChrome';
import EnvoyWardOverlay, { type EnvoyWardExpansionSpeed } from './combat/EnvoyWardOverlay';
import CatalyticConsoleOverlay from './combat/CatalyticConsoleOverlay';
import { ASHEN_DISSOLVE_TOTAL_MS } from './combat/CombatEnemyDissolveEffect';
import {
  FRACTURE_BREAK_PROMPT_MS,
  cataclysmSigilTraceMultiplier,
  isEnvoyProcUltimate,
  isHexShotProcUltimate,
} from '../data/combatMasteryEngine';
import {
  computeZeroProtocolPlan,
  type ZeroProtocolTarget,
} from '../data/hexZeroProtocolEngine';
import {
  gradeToZeroProtocolPerformance,
  resolveWeaponUltimateGrade,
} from '../data/weaponUltimateGradeEngine';
import {
  buildSimplifiedUltimateRawResult,
  resolveWeaponUltimateInputMode,
  shouldSkipUltimateMinigame,
} from '../data/weaponUltimateInputAdapter';
import { isWeaponUltimateMinigameHostActive } from '../data/weaponUltimateActivationEngine';
import {
  createUltimateActivationToken,
  traceUltimateActivation,
} from '../utils/ultimateActivationTrace';
import {
  sanitizeEnvoyCombatLoadout,
  sanitizeHexShotCombatLoadout,
} from '../data/classAbilityUnlockEngine';
import { normalizeAegisLoadout } from '../utils/aegisLoadoutUtils';
import { planFractureBreachStrike } from '../data/combatFractureBreachEngine';
import {
  isHitstopActive,
  triggerHitstop,
  triggerHaptic,
  triggerShake,
} from '../utils/combatJuice';
import { dispatchCombatPresentationFromJuice } from '../utils/combatPresentationBus';
import { presentResolvedWeaponHit } from '../data/weaponCombatPresentation/presentResolvedWeaponHit';
import {
  AEGIS_RIPOSTE_BONUS_KINETIC,
  abilityCarriesStrikeTag,
  canCashOutAegisRiposte,
  clearAegisRiposte,
  consumeAegisRiposte,
  expireAegisRiposteAtPlayerTurnEnd,
  grantAegisRiposte,
  type AegisRiposteState,
} from '../data/aegisRiposteEngine';
import {
  beginWardenStrikePresentation,
  cancelWardenStrikePresentation,
  contributeWardenStrikeContactDamage,
  isWardenStrikeInputGuarded,
  shouldUseWardenStrikePresentation,
  subscribeWardenStrikeContact,
  WARDEN_STRIKE_TIMELINE_MS,
  WARDEN_STRIKE_VFX_LAYER_TOGGLES,
  type WardenStrikeDefenseMaterial,
} from '../data/wardenStrikePresentation';
import {
  ABYSSAL_VERDICT_DISPLAY_NAME,
  ABYSSAL_VERDICT_TIMELINE_MS,
  beginAbyssalVerdictPresentation,
  cancelAbyssalVerdictPresentation,
  isAbyssalVerdictInputGuarded,
  shouldUseAbyssalVerdictPresentation,
  subscribeAbyssalVerdictDone,
  subscribeAbyssalVerdictImpact,
} from '../data/abyssalVerdictPresentation';
import { getCombatPresentationSettings } from '../data/weaponCombatPresentation/presentationSettings';
import {
  playCombatPresentationCue,
  setHexReloadSuppressesAttackSfx,
  unlockCombatPresentationAudio,
} from '../utils/combatPresentationAudio';
import type { UltimatePingVariant } from './combat/UltimateReadyPing';
import CombatMagazineGauge from './combat/CombatMagazineGauge';
import {
  createDefaultClassCombatEncounterState,
  type ClassCombatEncounterState,
} from '../types/classCombatAbility';
import type { EnvoyAbilityId, HexShotAbilityId } from '../types/operativeClass';
import {
  DEFAULT_ENVOY_LOADOUT,
  DEFAULT_HEX_SHOT_LOADOUT,
  type EnvoyLoadout,
  type HexShotLoadout,
} from '../types/operativeClass';
import {
  classAbilityRequiresTarget,
  classAbilityTargetMode,
  canTargetWithClassAbility,
  isUnitBlockedForClassAbility,
  isUnitHookValidForClass,
  resolveClassWardenInterceptTarget,
  validTargetsForClassAbility,
} from '../data/combatClassTargeting';
import {
  formatClassAbilityCostLine,
  resolveClassAbilityCost,
} from '../data/classAbilityResolver';
import { formatAbilityCardEffectLine } from '../data/combatAbilityPresentation';
import { formatAbilityLabel } from '../data/classLoadoutEngine';
import {
  getWeaponAnchorAttack,
  toRuntimeClassBasicId,
} from '../data/weaponAnchorAttackRegistry';
import { resolveWeaponAnchorCardPresentation } from '../data/weaponAnchorCardPresentation';
import {
  canFireLegacyClassUltimate,
  canFireWeaponUltimate,
  formatWeaponUltimateLogTag,
  getWeaponUltimate,
  getWeaponUltimateById,
  type WeaponUltimateId,
} from '../data/weaponUltimateRegistry';
import {
  isWu4NewUltimateId,
  planCrimsonRefraction,
  planFuneralKnot,
  planGravefall,
  planLastKnock,
  planRendTheVeil,
  planSixthSeal,
} from '../data/weaponUltimateNewResolveEngine';
import { resolveLanternFluxPurgePayoff } from '../data/weaponLanternRotPayoff';
import WeaponUltimateStagedSkillOverlay from './combat/WeaponUltimateStagedSkillOverlay';
import type { WeaponUltimateGrade } from '../types/weaponUltimateInteraction';
import {
  resolveWeaponUltimateDisplayName,
  resolveWeaponUltimateLegacyHookAbilityId,
  resolveWeaponUltimateActionTags,
  formatWeaponUltimatePingAccessibilityLabel,
  isWeaponUltimateActionId,
} from '../data/weaponUltimateSurfaceEngine';
import {
  detonateRiftSnareOnUnit,
  executeHexShotAbility,
  isHexShotAbilityEnabled,
  tickHexShotClassState,
} from '../data/hexShotAbilityExecutor';
import {
  executeEnvoyAbility,
  isEnvoyAbilityEnabled,
} from '../data/envoyAbilityExecutor';
import {
  applyBleedingPayloadDot,
  applyEnemyApDrainAtTurnStart,
  isEnemyHealBlocked,
  isGhostCamoBlockingAttacks,
  resolveAstralLockCrit,
} from '../data/classCombatStateEngine';
import CombatTelemetryGaugeRow from './combat/CombatHorizontalGauge';
import type { ApparitionViewportRef } from './combat/ApparitionViewport';
import type { CombatPlayerViewportRef } from './combat/CombatPlayerViewport';
import type { CombatOperativeTelemetry } from './combat/CombatOperativeHud';
import CombatCommandDeck from './CombatCommandDeck';
import CombatHostileTurnPanel from './combat/CombatHostileTurnPanel';
import ParryMatrixOverlay from './combat/ParryMatrixOverlay';
import ParrySuccessBurstOverlay from './combat/ParrySuccessBurstOverlay';
import VectorSliceOverlay, { ORIGIN_JITTER } from './combat/VectorSliceOverlay';
import {
  generateVariedSliceAngles,
  getSliceLineSegment,
  swipeHitsSliceLine,
  type SliceArenaSize,
} from '../utils/sliceLineGeometry';
import {
  CombatChromeBridge,
  useCombatEnemyChromeOptional,
} from '../context/CombatEnemyChromeContext';
import { CombatArenaOverlaySink } from '../context/CombatArenaOverlayContext';
import { CombatMinigameOverlaySink, CombatMinigameActiveBridge } from '../context/CombatMinigameOverlayContext';
import {
  type CombatTurnPhase,
  useCombatTurnOptional,
} from '../context/CombatTurnContext';
import {
  type CombatSquadUiSnapshot,
  type EnemyDeckStrikeVariant,
  formatHostileId,
  formatIntentReadout,
  isEnemyChargeIntent,
  isEnemyDamageIntent,
  isEnemySiphonIntent,
  isEnemyWindUpIntent,
  classifyEnemyTurnMotion,
  resolveEnemyTurnPhase,
  getEnemyBuffFloatLabel,
  getStatusFloatTone,
  type EnemyPortraitAnim,
  type EnemyPortraitGlow,
  type EnemyIntentShimmer,
  getEnemyDeckStrikeVariant,
  GAUGE_ABYSSAL,
  GAUGE_MAGAZINE,
  GAUGE_SOUL_ANCHOR,
  GAUGE_STAMINA,
  GAUGE_TRACK_BORDER,
  GAUGE_VEIL_FLUX,
} from '../utils/combatTelemetryFormat';
import { buildCombatTurnOrder } from '../utils/combatTurnOrder';
import {
  BACKLINE_MELEE_DASH_IMPACT_MS,
  BACKLINE_MELEE_DASH_TOTAL_MS,
  ENEMY_BACKLINE_MELEE_ANIM_MS,
  ENEMY_BUFF_ANIM_MS,
  ENEMY_MELEE_ANIM_MS,
  ENEMY_RANGED_ANIM_MS,
  FRONTLINE_MELEE_IMPACT_MS,
  RANGED_ATTACK_SPRITE_IN_MS,
  playerAttackLungeDelta,
  resolveArenaLayoutMode,
  type ArenaGridVariant,
  type ArenaLayoutMode,
} from './combat/combatEnemyBarLayout';
import VignetteFlashOverlay from './VignetteFlashOverlay';
import {
  applyAbyssalSiphon,
  formatAbyssalSiphonLog,
} from '../utils/combatResourceState';
import { useReactiveCombatStatus } from '../hooks/useReactiveCombatStatus';
import { useCombatDesktopLayout } from '../hooks/useCombatDesktopLayout';
import {
  isParryAttemptSuccessful,
  PARRY_HALO_DURATION_MS,
  PARRY_RING_SCALE_END,
  PARRY_RING_SCALE_START,
  type ParryArenaLayout,
} from '../utils/parryCollision';
import { useRun } from '../context/RunContext';
import { tryNormalizeRunItemId } from '../data/runItemIdAliases';
import { getRunItemInCombatSlot } from '../data/runItemInventoryEngine';

const TELEMETRY_DIVIDER = 'rgba(139, 92, 246, 0.2)';

const FRACTURE_HOUND_DOUBLE_STRIKE_CHANCE = 0.35;

const DEFEND_ABILITIES: AegisAbilityId[] = ['ASHEN_MANTLE', 'BLOOD_BOUND_CARAPACE'];
const BUFF_ABILITIES: AegisAbilityId[] = ['DEMONS_LUNG', 'CRIMSON_PACT'];

const { width, height: windowHeight } = Dimensions.get('window');

/** @deprecated Import from `src/constants/combatLayout`. */
export { TACTICAL_HUB_STACKED_RIGHT_INSET } from '../constants/combatLayout';
const MONO = 'monospace';
const P = {
  enemyHp: '#ef4444', unitTitle: '#ffffff', enemyPosture: '#fde68a',
  kr: '#bae6fd', krBorder: '#7dd3fc', parry: '#00ff33', defeat: '#5c0606',
};
const PARRY_DURATION = 1000;
const SLICE_HIT_HAPTIC_MS = 15;
const WARD_STRIKE_ACCENT = '#fde68a';
type CombatPhase = 'TEXT_COMBAT' | 'DEFEND_PARRY' | 'DEFEND_WARD' | 'OFFENSE_SLICE' | 'RESOLUTION';

interface TacticalCombatHubProps {
  /** Arena grid geometry for strike FX / dash math. */
  arenaGridVariant?: ArenaGridVariant;
  onOperativeTelemetryChange?: (telemetry: CombatOperativeTelemetry | null) => void;
  onWardPrimedChange?: (primed: boolean) => void;
  onAbilityPrimedChange?: (primed: boolean) => void;
  apparitionRef?: RefObject<ApparitionViewportRef | null>;
  playerViewportRef?: RefObject<CombatPlayerViewportRef | null>;
  /** Registers callback invoked after eradication dissolve completes (victory). */
  registerKillResolver?: (resolver: () => void) => void;
  /** Registers callback when a hostile finishes its dissolve VFX. */
  registerDissolveCompleteHandler?: (handler: (unitId: string) => void) => void;
  /** Registers callback to apply mid-combat healing from incursion consumables. */
  registerHealHandler?: (handler: (amount: number) => void) => void;
  /** Registers callback when a field consumable is deployed during combat. */
  registerConsumableHandler?: (handler: (result: IncursionConsumableUseResult) => void) => void;
  /** Registers preflight check before cargo is consumed (player turn + AP for item). */
  registerCanDeployCargoHandler?: (handler: (itemId: import('../types/cargoGrid').CargoItemId) => boolean) => void;
  /** Registers grid target selection from CombatScreen. */
  registerTargetHandler?: (handler: (unitId: string) => void) => void;
  /** Registers intel-only hostile focus (turn order / scouting). */
  registerIntelTargetHandler?: (handler: (unitId: string) => void) => void;
  /** Stacked layout: victory/defeat panel in the apparition viewport (hub keeps deck + gauges). */
  onResolutionPanelChange?: (
    panel: {
      outcome: 'VICTORY' | 'DEFEAT';
      onDismiss: () => void;
      playerTurns: number;
      hostilesDefeated: number;
      objectiveCallout: string | null;
    } | null,
  ) => void;
  onCombatComplete?: (r: {
    victory: boolean;
    remainingHp: number;
    remainingStamina: number;
    playerTurns: number;
    damageTaken: number;
    healingReceived: number;
    damageDealt: number;
    /** Phase 2 intent telegraph / counterplay sample. */
    intentTelemetry?: CombatIntentTelemetry;
    /** Phase 3 class loop sample. */
    classLoopTelemetry?: ClassLoopTelemetry;
    /** Phase 4 encounter objective sample. */
    objectiveTelemetry?: EncounterObjectiveTelemetry;
    /** Phase 5 combat director snapshot. */
    directorTelemetry?: {
      pressureTotal: number;
      pressureLabel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
      rewardMultiplier: number;
      adjustmentsApplied: number;
      severity: 'OK' | 'WARNING' | 'ERROR';
      debugSummary: string;
    };
    /** Phase 5 juice feedback sample. */
    juiceTelemetry?: CombatJuiceTelemetry;
  }) => void;
  /** Live run credits for cargo deck HUD. */
  runCredits?: number;
  /** Records the hostile designation that dealt the killing blow. */
  onLethalEnemyStrike?: (designation: string) => void;
  initialOperativeHp?: number; initialStamina?: number; maxStamina?: number; maxSoulAnchor?: number;
  startingAbyssalReservePercent?: number; parryMultiplierBonus?: number; parryWindowBonus?: number;
  sliceDamagePenalty?: number; onTerminalLog?: (text: string) => void;
  enemyProfile?: EnemyCombatProfile | null;
  enemySquad?: EnemyCombatProfile[];
  onSquadUiChange?: (snapshot: CombatSquadUiSnapshot) => void;
  threatBudget?: number;
  nodeIndex?: number;
  weaponCombatStats?: ResolvedWeaponCombatStats;
  environmentalModifiers?: EnvironmentalModifiers;
  bossProfile?: BossRuntimeProfile | null;
  onBossPhaseShift?: (phase: number) => void;
  aegisLoadout?: AegisLoadout;
  hexShotLoadout?: HexShotLoadout;
  envoyLoadout?: EnvoyLoadout;
  leyLineMutations?: LeyLineMutationId[];
  hexShotBoons?: HexShotBoonId[];
  envoyBoons?: EnvoyBoonId[];
  combatDistrict?: 1 | 2 | 3;
  /** Veil Front / employer first-turn-only AP bonuses (not Adrenaline Primer). */
  firstTurnBonusAp?: number;
  /** Adrenaline Primer — +1 AP for the operative's first 3 turns this encounter. */
  adrenalinePrimerActive?: boolean;
  /** VOID'S TOLL and other incursion-wide AP ceiling bonuses. */
  incursionApBonus?: number;
  /** Fired when VOID'S TOLL triggers on an ultimate kill. */
  onVoidsTollTriggered?: () => void;
  /** Employer sponsor package — flat kinetic armor layers on operative. */
  playerKineticArmorBonus?: number;
  /** Bound requisition / forge passive — defend to overcharge next strike. */
  kineticBatteryActive?: boolean;
  /** Narrative bonus boons claimed for this combat encounter. */
  narrativeCombatBoons?: import('../types/narrativeBonusReward').PendingNarrativeCombatBoons;
  /** Active weapon family locked at run start. */
  activeWeaponFamilyId?: WeaponFamilyId | null;
  /** Dev combat sandbox — start with class ultimate meter charged for every weapon. */
  primeUltimateAtStart?: boolean;
  activeWeaponTier?: WeaponTierNumber;
  /** WU-3 — Simplified Ultimate Inputs (STANDARD grade only). */
  simplifiedUltimateInputs?: boolean;
  /** Faction passive crit bonus (e.g. Solaris +10%). */
  playerCritChanceBonus?: number;
  /** Arena camera shake + global crit hooks (CombatScreen). */
  onPlayerCritImpact?: (payload: {
    unitId: string;
    channel: 'KINETIC' | 'OCCULT' | 'TRUE';
  }) => void;
  /** God Mode consumable — 1000 STRIKE damage and locked max resources. */
  godModeActive?: boolean;
  /** Crit Potion — force 100% player critical strike chance. */
  fullCritActive?: boolean;
  /** Run-scoped Veil-Grafts keyed by loadout ability. */
  abilityGrafts?: import('../types/veilGraft').AbilityGraftMap;
  hexShotAbilityGrafts?: HexShotAbilityGraftMap;
  envoyAbilityGrafts?: EnvoyAbilityGraftMap;
  /** Apex Graft — disables ultimate abilities for this encounter. */
  encounterUltimateDisabled?: boolean;
  /** Graft kill loot — e.g. Scavenger Bolt credits. */
  onGraftLootDrop?: (kind: string) => void;
  /** Active operative class — drives magazine / veil-flux resources (Phase 2). */
  operativeClass?: ClassType;
  /** Unstable cargo heal penalty/bonus multiplier (1 = neutral). */
  cargoHealReceivedMultiplier?: number;
  /** Depth-identity encounter modifier rolled onto the current node. */
  encounterModifier?: EncounterModifierId | null;
  /** Rusted Flare — temporary shield hits at combat start. */
}
interface SliceLineConfig {
  id: number;
  centerXRatio: number;
  centerYRatio: number;
  angleDeg: number;
  isSliced: boolean;
}

const isAttackIntent = (i: EnemyIntent) =>
  i === 'STRIKE'
  || i === 'WORLD_ENDER'
  || i === 'OVERDRIVE_DISCHARGE'
  || i === 'PAVEMENT_CRUSHER'
  || i === 'DOUBLE_STRIKE'
  || i === 'VOID_AMBUSH'
  || i === 'RESONANCE_OVERLOAD';

/** Hostile intents that qualify for Void Ward parry — driven by Intent 2.0 catalog. */
const isKineticMeleeEnemyStrike = (e: EnemyCombatProfile): boolean =>
  isIntentParryable(resolveEffectiveEnemyIntent(e));

const ENEMY_INTENT_READ_MS = 1800;
const ENEMY_TURN_GAP_MS = 500;
const GOD_MODE_STRIKE_DAMAGE = 1000;

type EnemyActionStage = 'reading' | 'executing' | null;

export default function TacticalCombatHub({
  arenaGridVariant = 'staggered',
  onOperativeTelemetryChange,
  onWardPrimedChange,
  onAbilityPrimedChange,
  apparitionRef,
  playerViewportRef,
  registerKillResolver,
  registerDissolveCompleteHandler,
  registerHealHandler,
  registerConsumableHandler,
  registerCanDeployCargoHandler,
  registerTargetHandler,
  registerIntelTargetHandler,
  onResolutionPanelChange,
  onCombatComplete,
  onLethalEnemyStrike,
  runCredits = 0,
  initialOperativeHp = 100, initialStamina = 100, maxStamina = 100,
  maxSoulAnchor = 100, startingAbyssalReservePercent = 0, parryMultiplierBonus = 0,
  parryWindowBonus = 0, sliceDamagePenalty = 0, onTerminalLog,
  enemyProfile = null,
  enemySquad,
  onSquadUiChange,
  threatBudget,
  nodeIndex = 0,
  weaponCombatStats,
  environmentalModifiers,
  bossProfile = null,
  onBossPhaseShift,
  aegisLoadout = DEFAULT_AEGIS_LOADOUT,
  hexShotLoadout = DEFAULT_HEX_SHOT_LOADOUT,
  envoyLoadout = DEFAULT_ENVOY_LOADOUT,
  leyLineMutations = [],
  hexShotBoons = [],
  envoyBoons = [],
  combatDistrict = 1,
  firstTurnBonusAp = 0,
  adrenalinePrimerActive = false,
  incursionApBonus = 0,
  onVoidsTollTriggered,
  playerKineticArmorBonus = 0,
  kineticBatteryActive = false,
  narrativeCombatBoons,
  activeWeaponFamilyId = null,
  activeWeaponTier = 1,
  simplifiedUltimateInputs = false,
  primeUltimateAtStart = false,
  playerCritChanceBonus = 0,
  onPlayerCritImpact,
  godModeActive = false,
  fullCritActive = false,
  abilityGrafts = {},
  hexShotAbilityGrafts = {},
  envoyAbilityGrafts = {},
  encounterUltimateDisabled = false,
  onGraftLootDrop,
  operativeClass = 'AEGIS',
  cargoHealReceivedMultiplier = 1,
  encounterModifier = null,
}: TacticalCombatHubProps): React.JSX.Element {
  const {
    notifyRunItemPlayerTurnStart,
    notifyRunItemCombatStart,
    activeIncursion,
  } = useRun();
  const activeIncursionRefLocal = useRef(activeIncursion);
  activeIncursionRefLocal.current = activeIncursion;
  const runItemCombatFlagsRef = useRef({
    bloodwireActive: false,
    bloodwireSpent: false,
    nullSpaceActive: false,
    voidglassDecoyActive: false,
    delayedCylinderTargetId: null as string | null,
    delayedCylinderDamage: 0,
    staminaLossNextTurn: 0,
    healingReceivedPenaltyPct: 0,
  });
  const hexShotBoonMods = useMemo(
    () => aggregateHexShotBoonModifiers(
      hexShotBoons,
      operativeClass === 'HEX_SHOT' ? sanitizeHexShotCombatLoadout(hexShotLoadout) : undefined,
    ),
    [hexShotBoons, hexShotLoadout, operativeClass],
  );
  const envoyBoonMods = useMemo(
    () => aggregateEnvoyBoonModifiers(envoyBoons),
    [envoyBoons],
  );
  const resolvedWeapon = useMemo(
    () => (activeWeaponFamilyId
      ? buildResolvedWeaponForRun(activeWeaponFamilyId, activeWeaponTier)
      : null),
    [activeWeaponFamilyId, activeWeaponTier],
  );
  const weaponRuntimeRef = useRef(createDefaultWeaponRuntime());
  const encounterModifierRuntimeRef = useRef<EncounterModifierCombatRuntime | null>(null);
  const depthVariantRuntimeRef = useRef<DepthVariantCombatRuntime>(createDepthVariantCombatRuntime());
  const weaponMagazineBonus = resolvedWeapon
    ? resolveWeaponMagazineBonus(resolvedWeapon.statModifiers)
    : 0;
  const weaponCritBonus = resolvedWeapon
    ? weaponCritChanceBonus(resolvedWeapon.statModifiers)
    : 0;
  const effectiveCritBonus = playerCritChanceBonus + weaponCritBonus;
  const maxAmmo = DEFAULT_MAGAZINE_SIZE + hexShotBoonMods.maxAmmoBonus + weaponMagazineBonus;
  const combatMaxSoulAnchor = operativeClass === 'HEX_SHOT'
    ? Math.floor(maxSoulAnchor * hexShotBoonMods.maxHpMultiplier)
    : maxSoulAnchor;
  const combatMaxSoulAnchorRef = useRef(combatMaxSoulAnchor);
  combatMaxSoulAnchorRef.current = combatMaxSoulAnchor;
  const getEffectiveMaxSoulAnchor = () =>
    getEffectivePlayerMaxHp(sessionExtrasRef.current, combatMaxSoulAnchorRef.current);
  const fluxMaxCap = envoyBoonMods.fluxMaxCap;
  const env = environmentalModifiers ?? {
    isEnemyPhaseShrouded: false,
    isPlayerBlinded: false,
    hasTetanusGlitch: false,
    startingStaminaPenalty: 0,
  };
  const strikeStats = weaponCombatStats ?? {
    strikeDamage: COMBAT_ACTION.ABYSSAL_STRIKE_DAMAGE,
    strikeStaminaCost: COMBAT_ACTION.ABYSSAL_STRIKE_STAMINA,
    exhaustedStrikeDamage: COMBAT_ACTION.ABYSSAL_STRIKE_EXHAUSTED_DAMAGE,
    abyssalChargePerStrike: COMBAT_ACTION.ABYSSAL_RESERVE_CHARGE,
    label: 'Standard Blade',
  };
  const { theme, profile, awardCurrencies } = useTerminal();
  const { isCombatDesktop, scaleCombatFont } = useCombatDesktopLayout();

  const [cycleState, setCycleState] = useState<CombatPhase>('TEXT_COMBAT');
  const [squad, setSquad] = useState<EnemyCombatProfile[]>([]);
  const squadRef = useRef<EnemyCombatProfile[]>([]);
  const [enemy, setEnemy] = useState<EnemyCombatProfile | null>(null);
  const enemyRef = useRef<EnemyCombatProfile | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const selectedTargetIdRef = useRef<string | null>(null);
  const focusedUnitIdRef = useRef<string | null>(null);
  const enemyActionQueueRef = useRef<string[]>([]);
  const rabidFlurryExpandedRef = useRef<Set<string>>(new Set());
  const counteringEnemyRef = useRef(false);
  const threatBudgetRef = useRef(threatBudget ?? THREAT_BUDGET_STANDARD);
  const arenaLayoutModeRef = useRef<ArenaLayoutMode>('group');
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [operativeHp, setOperativeHp] = useState(initialOperativeHp);
  const [stamina, setStamina] = useState(initialStamina);
  const [abyssalReserve, setAbyssalReserve] = useState(startingAbyssalReservePercent);
  const { isExhausted } = useReactiveCombatStatus(stamina);
  const [abyssalWardActive, setAbyssalWardActive] = useState(false);
  /** True after Aegis blocks — next Abyssal Strike gets bonus AR (deck highlight). */
  const [strikeArPrimed, setStrikeArPrimed] = useState(false);
  const [counterPrepActive, setCounterPrepActive] = useState(false);
  const [voidWardPrimed, setVoidWardPrimed] = useState(false);
  const [runicBrands, setRunicBrands] = useState(0);
  const [isSuccessState, setIsSuccessState] = useState(false);
  const [isFailureState, setIsFailureState] = useState(false);
  const [parrySuccessBurstActive, setParrySuccessBurstActive] = useState(false);
  const [parryBurstArena, setParryBurstArena] = useState<ParryArenaLayout | null>(null);
  const [parryBurstEpoch, setParryBurstEpoch] = useState(0);
  const enemyChrome = useCombatEnemyChromeOptional();
  const enemyChromeRef = useRef(enemyChrome);
  enemyChromeRef.current = enemyChrome;
  const combatTurn = useCombatTurnOptional();
  const parryBurstEpochRef = useRef(0);
  const [screenFlashActive, setScreenFlashActive] = useState(false);
  const [screenFlashColor, setScreenFlashColor] = useState(P.defeat);
  const [phaseAlert, setPhaseAlert] = useState<string | null>(null);
  const [resolutionOutcome, setResolutionOutcome] = useState<'VICTORY' | 'DEFEAT' | null>(null);
  const bossPhaseRef = useRef(bossProfile?.currentPhase ?? 1);
  const bossRuntimeRef = useRef<BossRuntimeProfile | null>(bossProfile);
  const [activeSliceIndex, setActiveSliceIndex] = useState(-1);
  const [sliceLines, setSliceLines] = useState<SliceLineConfig[]>([]);
  const [selectedAbility, setSelectedAbility] = useState<string | null>(null);
  const selectedAbilityRef = useRef<string | null>(null);
  selectedAbilityRef.current = selectedAbility;
  const executeOperativeAbilityRef = useRef<(abilityId: string) => void>(() => {});
  const [playerActionPoints, setPlayerActionPoints] = useState(PLAYER_ACTION_POINTS_PER_TURN);
  const [initiativeQueued, setInitiativeQueued] = useState(false);
  const [initiativeProcSeq, setInitiativeProcSeq] = useState(0);
  const [apRollupDisplay, setApRollupDisplay] = useState<number | null>(null);
  const [shadowstepProcActive, setShadowstepProcActive] = useState(false);
  const [enemyActionStage, setEnemyActionStage] = useState<EnemyActionStage>(null);
  const enemyActionStageRef = useRef<EnemyActionStage>(null);
  const [eviscerateTargetUnitId, setEviscerateTargetUnitId] = useState<string | null>(null);
  const [ruinVfxSeq, setRuinVfxSeq] = useState(0);
  const [currentAmmo, setCurrentAmmo] = useState(DEFAULT_MAGAZINE_SIZE);
  const [hexShotState, setHexShotState] = useState<HexShotCombatState>(() => createInitialHexShotCombatState({
    hp: initialOperativeHp,
    maxHp: maxSoulAnchor,
    stamina: initialStamina,
    maxStamina,
    ap: PLAYER_ACTION_POINTS_PER_TURN,
    ammo: DEFAULT_MAGAZINE_SIZE,
    maxAmmo: DEFAULT_MAGAZINE_SIZE,
  }));
  const [aegisOvercharged, setAegisOvercharged] = useState(false);
  const [veilFlux, setVeilFlux] = useState(VEIL_FLUX_START);
  const [envoyCombatState, setEnvoyCombatState] = useState<EnvoyCombatState>(() =>
    createInitialEnvoyCombatState(envoyBoonMods.fluxMaxCap),
  );
  const [activeReloadVisible, setActiveReloadVisible] = useState(false);
  const [hexReloadUsedThisTurn, setHexReloadUsedThisTurn] = useState(false);
  const hexReloadUsedThisTurnRef = useRef(false);
  const [zeroProtocolVisible, setZeroProtocolVisible] = useState(false);
  const zeroProtocolActiveRef = useRef(false);
  const [cataclysmSigilVisible, setCataclysmSigilVisible] = useState(false);
  const [stagedWeaponUltimateId, setStagedWeaponUltimateId] = useState<WeaponUltimateId | null>(null);
  const stagedWeaponUltimateIdRef = useRef<WeaponUltimateId | null>(null);
  const ultimateActivationTokenRef = useRef<string | null>(null);
  const ultimateCommitLockRef = useRef<string | null>(null);
  const [fractureBreakUnitId, setFractureBreakUnitId] = useState<string | null>(null);
  const fractureBreakUnitIdRef = useRef<string | null>(null);
  const executeFractureBreakRef = useRef<(unitId: string) => void>(() => {});

  const syncFractureBreakTarget = (unitId: string | null) => {
    fractureBreakUnitIdRef.current = unitId;
    setFractureBreakUnitId(unitId);
  };
  const [envoyWardSpeed, setEnvoyWardSpeed] = useState<EnvoyWardExpansionSpeed>('normal');
  const [successfulParryCount, setSuccessfulParryCount] = useState(0);
  const [cataclysmReadyUi, setCataclysmReadyUi] = useState(false);
  const [envoyRotStacksUi, setEnvoyRotStacksUi] = useState(0);
  const cataclysmReadyPrevRef = useRef(false);
  const [catalyticConsoleVisible, setCatalyticConsoleVisible] = useState(false);
  const combatPausedRef = useRef(false);
  const riftWardReadyRef = useRef(false);

  const operativeHpRef = useRef(initialOperativeHp);
  const balanceEncounterRef = useRef({
    playerTurns: 0,
    damageTaken: 0,
    healingReceived: 0,
    damageDealt: 0,
  });
  const intentTelemetryRef = useRef<CombatIntentTelemetry>(createEmptyIntentTelemetry());
  const classLoopTelemetryRef = useRef<ClassLoopTelemetry>(createEmptyClassLoopTelemetry());
  const objectiveSessionRef = useRef<EncounterObjectiveSession>(createEmptyEncounterObjectiveSession());
  const juiceTelemetryRef = useRef<CombatJuiceTelemetry>(createEmptyJuiceTelemetry());
  const [objectiveHudLine, setObjectiveHudLine] = useState<string | null>(null);
  const [timelineHudLine, setTimelineHudLine] = useState<string | null>(null);
  const [riposteReadyUi, setRiposteReadyUi] = useState(false);
  const currentAmmoRef = useRef(DEFAULT_MAGAZINE_SIZE);
  const hexShotStateRef = useRef(hexShotState);
  // Per-cast ammo-effect bookkeeping (Hex Shot ammo-type refactor v1).
  const hexAmmoCastTrackerRef = useRef<HexAmmoCastTracker>(createHexAmmoCastTracker());
  const hexAmmoHitIndexRef = useRef(0);
  const veilFluxRef = useRef(VEIL_FLUX_START);
  const envoyCombatStateRef = useRef(envoyCombatState);
  const voidSiphonedEnteredRef = useRef(false);
  const sessionExtrasRef = useRef<CombatSessionExtras>(createDefaultCombatSessionExtras());
  const graftEncounterSafetyRef = useRef(createDefaultGraftEncounterSafetyState());
  const [playerMaxAnchorDebt, setPlayerMaxAnchorDebt] = useState(0);
  const combatChanceRef = useRef<CombatChanceEncounterState>(createDefaultCombatChanceState());
  const [combatFeedback, setCombatFeedback] = useState<{
    nonce: number;
    event: CombatFeedbackEvent;
  } | null>(null);
  const feedbackNonceRef = useRef(0);
  const staminaRef = useRef(initialStamina);
  const abyssalRef = useRef(startingAbyssalReservePercent);
  const skipRegenRef = useRef(false);
  const wardStrikeBonusRef = useRef(false);
  const kineticBatteryChargedRef = useRef(false);
  const counterRef = useRef(false);
  const pendingDmgRef = useRef(0);
  const pendingUnblockRef = useRef(false);
  /** HP already applied when the red deck strike overlay appeared. */
  const preAppliedHpStrikeRef = useRef(0);
  const enemyStunPendingRef = useRef(false);
  const hitFlashSeqRef = useRef<Record<string, number>>({});
  /** Blood-burst pulse count latched with the latest hitFlash (Hex Cinder Sweep = 3). */
  const bloodBurstRepeatsRef = useRef<Record<string, number>>({});
  /** Blood mist size latched with the latest hitFlash (Black Door / Unmaker = 1.5). */
  const bloodMistScaleRef = useRef<Record<string, number>>({});
  /** Staged display HP — authoritative HP already applied; UI reveals at Warden contact. */
  const visualHpHoldRef = useRef<Record<string, number>>({});
  const wardenPendingRevealRef = useRef<{
    presentationId: string;
    unitId: string;
    revealHitFlash: boolean;
    revealEvade: boolean;
    critChannel?: 'KINETIC' | 'OCCULT' | 'TRUE';
    /** Planned kinetic delta from Riposte cash-out — labeled separately at contact. */
    riposteBonusKinetic?: number;
  } | null>(null);
  /** ABYSSAL VERDICT — deferred reveal / death / turn advance until IMPACT + DONE. */
  const abyssalPendingRef = useRef<{
    presentationId: string;
    unitId: string;
    affectedTargetIds: string[];
    evadedTargetIds: string[];
    damage: number;
    critical: boolean;
    killed: boolean;
    pendingDissolve: boolean;
    impactResolved: boolean;
    deferredLogLines: string[];
  } | null>(null);
  /** When set, combat log lines are buffered until ABYSSAL VERDICT impact. */
  const abyssalLogBufferRef = useRef<string[] | null>(null);
  /** Resolved hurt outcome for deferred ABYSSAL VERDICT presentation (hit vs evade). */
  const abyssalDeferredOutcomeRef = useRef<{
    unitId: string;
    evaded: boolean;
    damageApplied: number;
    killed: boolean;
  } | null>(null);
  /** Planned Riposte kinetic bonus for the next Warden contact float. */
  const wardenRiposteBonusRef = useRef(0);
  /** Primary target for the current Strike — Riposte only cashes vs this id. */
  const ripostePrimaryTargetIdRef = useRef<string | null>(null);
  /** Player action id that already cashed Riposte (one per action). */
  const riposteCashedActionIdRef = useRef<string | null>(null);
  /** Crit channel staged until Warden contact (same strike). */
  const wardenDeferredCritChannelRef = useRef<'KINETIC' | 'OCCULT' | 'TRUE' | null>(null);
  /** Player-intent action that owns the active Warden presentation. */
  const wardenPlayerActionIdRef = useRef<string | null>(null);
  /** Defense response latched to the owning presentation — published at contact only. */
  const wardenPendingDefenseFloatRef = useRef<{
    presentationId: string;
    resolvedResultId: string;
    unitId: string;
    kind: 'armor' | 'ward';
  } | null>(null);
  const wardenDefenseMaterialRef = useRef<WardenStrikeDefenseMaterial>('NONE');
  const wardenFractureAppliedRef = useRef(false);
  /** Golden shard VFX — only bumped on successful fracture breach execute. */
  const fractureShatterSeqRef = useRef<Record<string, number>>({});
  const classImpactFxRef = useRef<Record<string, { seq: number; kind: import('../utils/combatTelemetryFormat').CombatClassImpactKind }>>({});
  const critImpactSeqRef = useRef<Record<string, { seq: number; channel: 'KINETIC' | 'OCCULT' | 'TRUE' }>>({});
  const evadeImpactSeqRef = useRef<Record<string, number>>({});
  const statusFloatSeqRef = useRef<Record<string, number>>({});
  const damageFloatSeqRef = useRef<Record<string, number>>({});
  const damageFloatLabelsRef = useRef<Record<string, string>>({});
  const lifecycleFloatLabelsRef = useRef<Record<string, string>>({});
  const lifecycleFloatTonesRef = useRef<Record<string, import('../utils/combatTelemetryFormat').StatusFloatTone>>({});
  const skipTurnUnitIdsRef = useRef<Set<string>>(new Set());
  const [centerSkipFloatSeq, setCenterSkipFloatSeq] = useState(0);
  const backlineDashSeqRef = useRef<Record<string, number>>({});
  const backlineDashActiveRef = useRef<Record<string, boolean>>({});
  const retributionParryRef = useRef<{ unitId: string; occultDamage: number } | null>(null);
  const pendingDissolveRef = useRef<{ unitId: string; profile: EnemyCombatProfile; hp: number } | null>(null);
  const dissolveSeqRef = useRef<Record<string, number>>({});
  const dissolvedHiddenRef = useRef<Set<string>>(new Set());
  const adrenalinePrimerTurnsRef = useRef(0);
  const pendingVictoryRef = useRef(false);
  const encounterHostileCountRef = useRef(0);
  const victoryFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasEnemyTurnAtVictoryRef = useRef(false);
  const lastActiveTurnPhaseRef = useRef<CombatTurnPhase>('PLAYER_COMMAND');
  const survivedEnemyTurnsRef = useRef(0);
  const isPlayerTurnRef = useRef(isPlayerTurn);
  const resolutionRef = useRef<'VICTORY' | 'DEFEAT' | null>(null);
  const dismissedRef = useRef(false);
  const cycleRef = useRef<CombatPhase>('TEXT_COMBAT');
  const parryScaleSV = useSharedValue(2.5);
  const parryResolvedRef = useRef(false);
  const parryTapPendingRef = useRef(false);
  const parrySessionRef = useRef(0);
  const parryHaloTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const parryBurstCompleteRef = useRef<(() => void) | null>(null);
  const parryArenaRef = useRef<ParryArenaLayout | null>(null);
  const screenFlashAnim = useRef(new Animated.Value(0)).current;
  const activeSliceRef = useRef(-1);
  const sliceArenaRef = useRef<SliceArenaSize>({ width: 0, height: 0 });
  const sliceTouchStartRef = useRef<{ x: number; y: number } | null>(null);
  const crossedRef = useRef(false);
  const sliceSessionRef = useRef({
    lines: [] as SliceLineConfig[], hitCount: 0, slicedIds: new Set<number>(),
    segmentTimer: null as ReturnType<typeof setTimeout> | null,
    hitFlashTimer: null as ReturnType<typeof setTimeout> | null, evaluated: false,
  });
  const sliceHandlersRef = useRef({
    queueNext: (_i: number) => {}, validate: () => {}, evaluate: () => {}, trigger: () => {},
  });
  const enemyTurnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enemyTurnGapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enemyStrikeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voidAmbushWindowRef = useRef<{ unitId: string; damageDealt: number } | null>(null);
  const playerApRef = useRef(PLAYER_ACTION_POINTS_PER_TURN);
  const voidWardPrimedRef = useRef(false);
  const bloodBoundCarapaceRef = useRef(false);
  const shadowstepProcRef = useRef(false);
  const apRollupFrameRef = useRef<number | null>(null);
  const combatBuffRef = useRef<PlayerCombatBuffState>({
    demonLungCooldown: 0,
    crimsonPactCharges: 0,
    bonusApThisTurn: 0,
    bonusApNextTurn: 0,
    ashenMantleTurnsRemaining: 0,
    initiativeQueued: false,
  });
  const mutationModsRef = useRef<MutationCombatModifiers>(
    aggregateMutationModifiers(leyLineMutations),
  );
  const hexShotBoonModsRef = useRef(hexShotBoonMods);
  hexShotBoonModsRef.current = hexShotBoonMods;
  const envoyBoonModsRef = useRef(envoyBoonMods);
  envoyBoonModsRef.current = envoyBoonMods;
  const mutationEncounterRef = useRef(createDefaultBoonEncounterState());
  const classBoonEncounterRef = useRef(createDefaultClassBoonEncounterState());
  const activeGraftPlanRef = useRef<GraftCastPlan | null>(null);
  const activeGraftReserveSpentRef = useRef(0);
  const activeGraftApCostRef = useRef(0);
  const graftCooldownsRef = useRef<Partial<Record<AegisAbilityId, number>>>({});
  const abilityGraftsRef = useRef(abilityGrafts);
  abilityGraftsRef.current = abilityGrafts;
  const hexShotAbilityGraftsRef = useRef(hexShotAbilityGrafts);
  hexShotAbilityGraftsRef.current = hexShotAbilityGrafts;
  const envoyAbilityGraftsRef = useRef(envoyAbilityGrafts);
  envoyAbilityGraftsRef.current = envoyAbilityGrafts;
  const activeClassGraftPlanRef = useRef<ClassGraftCastPlan | null>(null);
  const activeClassGraftApCostRef = useRef(0);
  const lastPlayerAbilityRef = useRef<string | null>(null);
  const lastAegisAbilityRef = (): AegisAbilityId | undefined =>
    operativeClass === 'AEGIS'
      ? (lastPlayerAbilityRef.current as AegisAbilityId | undefined)
      : undefined;
  const classCombatRef = useRef<ClassCombatEncounterState>(createDefaultClassCombatEncounterState());

  const isCombatTerminal = () =>
    resolutionRef.current != null || operativeHpRef.current <= 0;

  const canPlayerCommand = () =>
    cycleRef.current === 'TEXT_COMBAT'
    && !shadowstepProcRef.current
    && !combatPausedRef.current
    && !activeReloadVisible
    && !zeroProtocolVisible
    && !cataclysmSigilVisible
    && !catalyticConsoleVisible
    && fractureBreakUnitId == null
    && !isAbyssalVerdictInputGuarded()
    && (isPlayerTurnRef.current || voidAmbushWindowRef.current != null);

  const buildPlayerAIState = (): PlayerAIState => ({
    hp: operativeHpRef.current,
    maxHp: getEffectiveMaxSoulAnchor(),
    stamina: staminaRef.current,
    maxStamina,
    abyssalReserve: abyssalRef.current,
    actionPoints: playerApRef.current,
  });

  const buildLifecycleContext = () => ({
    squad: squadRef.current,
    player: buildPlayerAIState() as PlayerCombatState,
    extras: {
      ...sessionExtrasRef.current,
      fleshWarpUnitIds: classCombatRef.current.fleshWarpUnits,
    },
  });

  const applyLifecycleExtras = (patch?: Partial<CombatSessionExtras>) => {
    if (!patch) return;
    sessionExtrasRef.current = {
      ...sessionExtrasRef.current,
      ...patch,
      immunePopupSeq: patch.immunePopupSeq ?? sessionExtrasRef.current.immunePopupSeq,
      leySirenTetheredUnitIds: patch.leySirenTetheredUnitIds ?? sessionExtrasRef.current.leySirenTetheredUnitIds,
      playerApPenaltyNextTurn: patch.playerApPenaltyNextTurn ?? sessionExtrasRef.current.playerApPenaltyNextTurn,
      playerApCapNextTurn: patch.playerApCapNextTurn !== undefined
        ? patch.playerApCapNextTurn
        : sessionExtrasRef.current.playerApCapNextTurn,
      ashTokens: patch.ashTokens ?? sessionExtrasRef.current.ashTokens,
      structuredDebuffs: patch.structuredDebuffs ?? sessionExtrasRef.current.structuredDebuffs,
    };
    sessionExtrasRef.current.playerDebuffs = sessionExtrasRef.current.structuredDebuffs.map((d) => d.type);
  };

  const applyLifecyclePlayerDelta = (delta?: number) => {
    if (delta == null || delta === 0) return;
    setOperativeHp((prev) => {
      const effectiveMax = getEffectiveMaxSoulAnchor();
      const next = clampPlayerHpToEffectiveMax(
        Math.max(0, prev + delta),
        sessionExtrasRef.current,
        combatMaxSoulAnchorRef.current,
      );
      operativeHpRef.current = next;
      return next;
    });
  };

  const applyLifecycleStaminaDelta = (delta?: number) => {
    if (delta == null || delta === 0) return;
    applyStamina(staminaRef.current + delta);
  };

  const smogCallerActive = () =>
    aliveUnits(squadRef.current).find((u) => u.rosterId === 'smog-caller') ?? null;

  const hookWeaverTetheredUnitId = () => {
    const weaver = aliveUnits(squadRef.current).find((u) => u.rosterId === 'hook-weaver');
    return weaver?.tetheredAllyUnitId ?? sessionExtrasRef.current.hookWeaverTetheredUnitId;
  };

  const activeHookWeaver = () =>
    aliveUnits(squadRef.current).find((u) => u.rosterId === 'hook-weaver') ?? null;

  const hasAshOnBoard = () => Object.keys(sessionExtrasRef.current.ashTokens).length > 0;

  const consumeAshToken = () => {
    const slots = Object.keys(sessionExtrasRef.current.ashTokens);
    if (slots.length === 0) return;
    const next = { ...sessionExtrasRef.current.ashTokens };
    delete next[slots[0] as keyof typeof next];
    sessionExtrasRef.current.ashTokens = next;
  };

  const markPlayerDefendedRef = useRef<() => void>(() => {});
  const resolvePlayerTurnEndDebuffsRef = useRef<() => void>(() => {});
  const isBuffOrDefendAbility = (abilityId: AegisAbilityId) =>
    DEFEND_ABILITIES.includes(abilityId) || BUFF_ABILITIES.includes(abilityId);

  const terminalLogRef = useRef(onTerminalLog);
  terminalLogRef.current = onTerminalLog;
  const log = (t: string) => {
    if (abyssalLogBufferRef.current) {
      abyssalLogBufferRef.current.push(t);
      return;
    }
    terminalLogRef.current?.(t);
  };
  const parryTimingWindowBonus = parryWindowBonus * 0.02;
  const parryTimingBlindPenalty = env.isPlayerBlinded ? 0.015 : 0;
  const counterReady = operativeClass === 'AEGIS' && voidWardPrimed;
  const sliceReady = operativeClass === 'AEGIS'
    && abyssalReserve >= COMBAT_ACTION.ABYSSAL_RESERVE_CAP
    && !isExhausted
    && canFireLegacyClassUltimate('EVISCERATE', activeWeaponFamilyId);
  const zeroProtocolReady = operativeClass === 'HEX_SHOT'
    && hexShotState.isUltimateAvailable
    && !isExhausted
    && canFireLegacyClassUltimate('ZERO_PROTOCOL', activeWeaponFamilyId);
  const cataclysmReady = operativeClass === 'ENVOY'
    && cataclysmReadyUi
    && !isExhausted
    && canFireLegacyClassUltimate('CATACLYSM_SIGIL', activeWeaponFamilyId);
  const classMeterUltimateReady = !isExhausted && (
    (operativeClass === 'AEGIS' && abyssalReserve >= COMBAT_ACTION.ABYSSAL_RESERVE_CAP)
    || (operativeClass === 'HEX_SHOT' && hexShotState.isUltimateAvailable)
    || (operativeClass === 'ENVOY' && cataclysmReadyUi)
  );
  const activeUltimateRecord = activeWeaponFamilyId
    ? getWeaponUltimate(activeWeaponFamilyId)
    : null;
  const stagedUltimateReady = classMeterUltimateReady
    && canFireWeaponUltimate(activeWeaponFamilyId)
    && activeUltimateRecord != null
    && isWu4NewUltimateId(activeUltimateRecord.id);
  const ultimatePingVariant: UltimatePingVariant | null = zeroProtocolReady || (
    stagedUltimateReady && operativeClass === 'HEX_SHOT'
  )
    ? 'zero_protocol'
    : cataclysmReady || (stagedUltimateReady && operativeClass === 'ENVOY')
      ? 'cataclysm'
      : sliceReady || (stagedUltimateReady && operativeClass === 'AEGIS')
        ? 'eviscerate'
        : null;
  const ultimatePingReady = ultimatePingVariant != null;
  const activeLoadout = useMemo((): readonly string[] => {
    if (operativeClass === 'HEX_SHOT') return sanitizeHexShotCombatLoadout(hexShotLoadout);
    if (operativeClass === 'ENVOY') return sanitizeEnvoyCombatLoadout(envoyLoadout);
    return normalizeAegisLoadout(aegisLoadout);
  }, [operativeClass, hexShotLoadout, envoyLoadout, aegisLoadout]);
  const masteryProgress = useMemo(() => {
    if (operativeClass === 'ENVOY') {
      return { visible: false, current: 0, required: CATACLYSM_ROT_GATE, accent: '#a78bfa' };
    }
    if (operativeClass !== 'HEX_SHOT') {
      return { visible: false, current: 0, required: 3, accent: '#94a3b8' };
    }
    const oc = hexShotState.overchargeMultiplier;
    if (oc <= 0 || hexShotState.isUltimateAvailable) {
      return { visible: false, current: 0, required: 5, accent: '#fbbf24' };
    }
    const steps = Math.min(5, Math.max(1, Math.round(oc / 0.1)));
    return {
      visible: isPlayerTurn && cycleState === 'TEXT_COMBAT',
      current: steps,
      required: 5,
      accent: '#fbbf24',
    };
  }, [
    operativeClass,
    cataclysmReadyUi,
    envoyRotStacksUi,
    hexShotState.overchargeMultiplier,
    hexShotState.isUltimateAvailable,
    isPlayerTurn,
    cycleState,
  ]);
  const strikeWardPrimed = strikeArPrimed || wardStrikeBonusRef.current;

  const tryPreventExhaustionBreak = (next: number): number => {
    if (next > 0 || staminaRef.current <= 0) return next;
    if (!hasMutation(leyLineMutations, 'UNSTOPPABLE_FORCE')) return next;
    if (mutationEncounterRef.current.unstoppableFractureUsed) return next;
    mutationEncounterRef.current.unstoppableFractureUsed = true;
    log('[UNSTOPPABLE FORCE] >> Fracture break absorbed — stamina holds.');
    return 1;
  };

  const applyStamina = (next: number) => {
    let clamped = Math.max(0, Math.min(next, maxStamina));
    if (clamped === 0) clamped = tryPreventExhaustionBreak(0);
    staminaRef.current = clamped;
    setStamina(clamped);
    if (clamped > 0) {
      combatChanceRef.current.momentumShiftEvadeDisabled = false;
    }
    return clamped;
  };

  const godModeRef = useRef(godModeActive);
  godModeRef.current = godModeActive;
  const fullCritRef = useRef(fullCritActive);
  fullCritRef.current = fullCritActive;

  const setMagazineAmmo = (next: number) => {
    const clamped = Math.max(0, Math.min(next, maxAmmo));
    currentAmmoRef.current = clamped;
    setCurrentAmmo(clamped);
    return clamped;
  };

  const spendAmmo = (amount: number): boolean => {
    if (amount <= 0) return true;
    if (currentAmmoRef.current < amount) return false;
    setMagazineAmmo(currentAmmoRef.current - amount);
    return true;
  };

  const emptyMagazine = () => {
    setMagazineAmmo(0);
  };

  useEffect(() => {
    hexShotStateRef.current = hexShotState;
  }, [hexShotState]);

  useEffect(() => {
    const unsubscribe = subscribeWardenStrikeContact((result) => {
      if (result.replayOnly) return;
      const pending = wardenPendingRevealRef.current;
      if (!pending || pending.presentationId !== result.presentationId) return;
      wardenPendingRevealRef.current = null;
      delete visualHpHoldRef.current[pending.unitId];

      // Response callouts are tied to this resolved-result + presentation instance.
      const pendingDefense = wardenPendingDefenseFloatRef.current;
      if (
        pendingDefense
        && pendingDefense.presentationId === result.presentationId
        && pendingDefense.resolvedResultId === result.resolvedResultId
      ) {
        wardenPendingDefenseFloatRef.current = null;
      } else {
        wardenPendingDefenseFloatRef.current = null;
      }

      if (result.outcome === 'MISS' || result.outcome === 'EVADE') {
        clearDefenseBreakFloat(pending.unitId);
      } else if (result.defenseMaterial === 'KINETIC_ARMOR') {
        pushDefenseBreakFloat(pending.unitId, 'armor');
      } else if (result.defenseMaterial === 'OCCULT_WARD') {
        pushDefenseBreakFloat(pending.unitId, 'ward');
      }

      if (pending.revealHitFlash) {
        hitFlashSeqRef.current[pending.unitId] =
          (hitFlashSeqRef.current[pending.unitId] ?? 0) + 1;
      }
      if (
        result.outcome === 'HIT'
        && result.damage > 0
        && WARDEN_STRIKE_VFX_LAYER_TOGGLES.damageCritNumbers
      ) {
        // Publish even for Armor/Ward when authoritative HP damage > 0.
        // Uses a dedicated channel so it does not overwrite ARMOR BROKEN / WARD.
        const riposteBonus = Math.max(0, pending.riposteBonusKinetic ?? 0);
        const baseShown = riposteBonus > 0
          ? Math.max(0, result.damage - riposteBonus)
          : result.damage;
        const dmgLabel = String(baseShown > 0 ? baseShown : result.damage);
        damageFloatSeqRef.current[pending.unitId] =
          (damageFloatSeqRef.current[pending.unitId] ?? 0) + 1;
        damageFloatLabelsRef.current[pending.unitId] = dmgLabel;
        setTimeout(() => {
          if (damageFloatLabelsRef.current[pending.unitId] === dmgLabel) {
            delete damageFloatLabelsRef.current[pending.unitId];
          }
        }, 900);
        if (riposteBonus > 0) {
          const riposteLabel = `RIPOSTE +${riposteBonus}`;
          statusFloatSeqRef.current[pending.unitId] =
            (statusFloatSeqRef.current[pending.unitId] ?? 0) + 1;
          lifecycleFloatLabelsRef.current[pending.unitId] = riposteLabel;
          lifecycleFloatTonesRef.current[pending.unitId] = 'neutral';
          setTimeout(() => {
            if (lifecycleFloatLabelsRef.current[pending.unitId] === riposteLabel) {
              delete lifecycleFloatLabelsRef.current[pending.unitId];
              delete lifecycleFloatTonesRef.current[pending.unitId];
            }
          }, 1100);
        }
      }
      if (
        pending.revealEvade
        && (result.outcome === 'EVADE' || result.outcome === 'MISS')
        && result.damage <= 0
      ) {
        evadeImpactSeqRef.current[pending.unitId] =
          (evadeImpactSeqRef.current[pending.unitId] ?? 0) + 1;
      }
      if (
        result.critical
        && result.damage > 0
        && (pending.critChannel || result.outcome === 'HIT')
      ) {
        const prev = critImpactSeqRef.current[pending.unitId]?.seq ?? 0;
        critImpactSeqRef.current[pending.unitId] = {
          seq: prev + 1,
          channel: pending.critChannel ?? 'KINETIC',
        };
      }
      if (result.outcome === 'HIT') {
        const settings = getCombatPresentationSettings();
        const hitStop = settings.reducedMotion
          ? Math.max(20, Math.floor(WARDEN_STRIKE_TIMELINE_MS.hitStop * 0.6))
          : WARDEN_STRIKE_TIMELINE_MS.hitStop;
        triggerHitstop(hitStop);
        if (!settings.reducedMotion) {
          triggerShake('micro');
        }
      }
      if (result.critical && result.damage > 0) {
        // Crit sting is scheduled slightly earlier in wardenStrikePresentation.
        onPlayerCritImpact?.({
          unitId: pending.unitId,
          channel: pending.critChannel ?? 'KINETIC',
        });
      }
      publishSquadUi(squadRef.current);
    });

    const unsubAbyssalImpact = subscribeAbyssalVerdictImpact((result) => {
      const pending = abyssalPendingRef.current;
      if (!pending || pending.presentationId !== result.presentationId || pending.impactResolved) {
        return;
      }
      pending.impactResolved = true;
      // Publish buffered combat-log outcome only at IMPACT (slash arrival / pass).
      for (const line of pending.deferredLogLines) {
        terminalLogRef.current?.(line);
      }
      const hitIds = pending.affectedTargetIds.filter(
        (id) => id && !pending.evadedTargetIds.includes(id),
      );
      const evadeIds = pending.evadedTargetIds.filter(Boolean);
      for (const unitId of hitIds) {
        delete visualHpHoldRef.current[unitId];
      }
      for (const unitId of evadeIds) {
        delete visualHpHoldRef.current[unitId];
        evadeImpactSeqRef.current[unitId] = (evadeImpactSeqRef.current[unitId] ?? 0) + 1;
        apparitionRef?.current?.triggerStatEvade();
      }
      // Primary cinematic target owns major hit FX; secondaries (none for single-target) get smaller bursts.
      const primaryId = pending.unitId;
      const successfulHit = pending.damage > 0 && hitIds.includes(primaryId);
      if (successfulHit) {
        // Hit flash drives blood / flash only — recoil is suppressed while Abyssal is active.
        hitFlashSeqRef.current[primaryId] = (hitFlashSeqRef.current[primaryId] ?? 0) + 1;
        damageFloatSeqRef.current[primaryId] = (damageFloatSeqRef.current[primaryId] ?? 0) + 1;
        lifecycleFloatLabelsRef.current[primaryId] = String(pending.damage);
        lifecycleFloatTonesRef.current[primaryId] = 'neutral';
        bloodBurstRepeatsRef.current[primaryId] = 1;
        bloodMistScaleRef.current[primaryId] = 1;
        const prevImpact = classImpactFxRef.current[primaryId]?.seq ?? 0;
        classImpactFxRef.current[primaryId] = {
          seq: prevImpact + 1,
          kind: 'AEGIS_SLICE',
        };
        Vibration.vibrate(18);
        if (pending.critical) {
          const prev = critImpactSeqRef.current[primaryId]?.seq ?? 0;
          critImpactSeqRef.current[primaryId] = {
            seq: prev + 1,
            channel: 'TRUE',
          };
          onPlayerCritImpact?.({ unitId: primaryId, channel: 'TRUE' });
        }
      }
      for (const unitId of hitIds) {
        if (unitId === primaryId) continue;
        hitFlashSeqRef.current[unitId] = (hitFlashSeqRef.current[unitId] ?? 0) + 1;
        const prevImpact = classImpactFxRef.current[unitId]?.seq ?? 0;
        classImpactFxRef.current[unitId] = {
          seq: prevImpact + 1,
          kind: 'AEGIS_SLICE',
        };
      }
      const settings = getCombatPresentationSettings();
      if (successfulHit) {
        const hitStop = settings.reducedMotion
          ? Math.max(20, Math.floor(ABYSSAL_VERDICT_TIMELINE_MS.hitStopMs * 0.45))
          : ABYSSAL_VERDICT_TIMELINE_MS.hitStopMs;
        triggerHitstop(hitStop);
        // No screen shake — keeps the planted enemy visually still.
      }
      if (pending.pendingDissolve && successfulHit) {
        const unit = getUnitById(squadRef.current, pending.unitId);
        if (unit && !isUnitAlive(unit)) {
          beginDissolveForUnit(pending.unitId, unit, unit.currentHp);
        }
      }
      publishSquadUi(squadRef.current);
      if (successfulHit) {
        try {
          unlockCombatPresentationAudio();
          playCombatPresentationCue('sfx.aegis.ultimate');
        } catch {
          // optional
        }
      }
    });

    const unsubAbyssalDone = subscribeAbyssalVerdictDone((result) => {
      const pending = abyssalPendingRef.current;
      if (!pending || pending.presentationId !== result.presentationId) return;
      const killed = pending.killed;
      abyssalPendingRef.current = null;
      combatPausedRef.current = false;
      cycleRef.current = 'TEXT_COMBAT';
      setCycleState('TEXT_COMBAT');
      setEviscerateTargetUnitId(null);
      if (!killed) {
        passToEnemy(false);
      }
    });

    return () => {
      unsubscribe();
      unsubAbyssalImpact();
      unsubAbyssalDone();
      cancelWardenStrikePresentation();
      cancelAbyssalVerdictPresentation();
      visualHpHoldRef.current = {};
      wardenPendingRevealRef.current = null;
      wardenPendingDefenseFloatRef.current = null;
      wardenPlayerActionIdRef.current = null;
      abyssalPendingRef.current = null;
      abyssalDeferredOutcomeRef.current = null;
      abyssalLogBufferRef.current = null;
    };
  // publishSquadUi is stable enough via refs; mount once per combat hub lifetime.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const syncHexShotFromHub = (): HexShotCombatState => ({
    ...hexShotStateRef.current,
    hp: operativeHpRef.current,
    maxHp: maxSoulAnchor,
    stamina: staminaRef.current,
    maxStamina,
    ap: playerApRef.current,
    ammo: currentAmmoRef.current,
    maxAmmo,
  });

  const applyHexShotCombatState = (next: HexShotCombatState) => {
    hexShotStateRef.current = next;
    setHexShotState(next);
    if (next.ammo !== currentAmmoRef.current) setMagazineAmmo(next.ammo);
    if (next.ap !== playerApRef.current) {
      playerApRef.current = next.ap;
      setPlayerActionPoints(next.ap);
    }
    if (next.stamina !== staminaRef.current) applyStamina(next.stamina);
  };

  const dispatchHexShot = (action: HexShotReducerAction) => {
    const next = hexShotReducer(syncHexShotFromHub(), action);
    applyHexShotCombatState(next);
    return next;
  };

  const resolveDeadMansEject = (totalDamage: number) => {
    if (totalDamage <= 0) return;
    const targets = aliveUnits(squadRef.current);
    for (const unit of targets) {
      if (!unit.unitId) continue;
      // Indirect — reload eject must not fire attack portrait / attack SFX.
      hurtEnemy(totalDamage, "[DEAD-MAN'S SWITCH]", 'STRIKE', {
        channel: 'KINETIC',
        targetId: unit.unitId,
        rollCrit: false,
        indirectDamage: true,
      });
    }
    log(`[DEAD-MAN'S SWITCH] >> ${totalDamage} kinetic eject damage to ${targets.length} hostile(s).`);
    publishSquadUi(squadRef.current);
  };

  const tryOpenReloadMinigame = (manual: boolean): boolean => {
    if (operativeClass !== 'HEX_SHOT') return false;
    if (activeReloadVisible || hexReloadUsedThisTurnRef.current) return false;
    const before = syncHexShotFromHub();
    if (!canBeginHexShotReload(before)) {
      if (before.ap < HEX_RELOAD_AP_COST) {
        log('[REJECTED] >> Insufficient AP for Phase-Shift Reload.');
      }
      return false;
    }
    const deadMansSwitch = manual
      && isDeadMansSwitchReloadGraft(hexShotAbilityGraftsRef.current)
      && before.ammo > 0;
    hexReloadUsedThisTurnRef.current = true;
    setHexReloadUsedThisTurn(true);
    const ejectDamage = deadMansSwitch ? before.ammo * 10 : 0;
    const next = dispatchHexShot({ type: 'HEX_BEGIN_RELOAD', manual, deadMansSwitch });
    if (next.ap === before.ap) return false;
    // Block Hex attack SFX for the entire reload minigame (including eject damage).
    setHexReloadSuppressesAttackSfx(true);
    if (ejectDamage > 0) {
      resolveDeadMansEject(ejectDamage);
    }
    setActiveReloadVisible(true);
    log(manual
      ? '>> [PHASE-SHIFT RELOAD] — tactical reload window open (−1 AP).'
      : '>> [PHASE-SHIFT RELOAD] — empty mag flow state (−1 AP).');
    return true;
  };

  const maybePromptReloadAfterBallistic = () => {
    if (operativeClass !== 'HEX_SHOT') return;
    dispatchHexShot({ type: 'HEX_AFTER_BALLISTIC_SPEND' });
    if (hexShotStateRef.current.autoReloadPending) {
      tryOpenReloadMinigame(false);
    }
  };

  const reduceEnemyAp = (unitId: string, amount: number) => {
    const unit = getUnitById(squadRef.current, unitId);
    if (!unit) return;
    const nextAp = Math.max(0, (unit.enemyActionPoints ?? 1) - amount);
    patchUnit(unitId, { enemyActionPoints: nextAp });
  };

  const syncEnvoyCombatState = (next: EnvoyCombatState) => {
    envoyCombatStateRef.current = next;
    veilFluxRef.current = next.veilFlux;
    setVeilFlux(next.veilFlux);
    setEnvoyCombatState(next);
  };

  const dispatchEnvoy = (action: EnvoyReducerAction): EnvoyCombatState => {
    const next = envoyReducer(envoyCombatStateRef.current, action);
    syncEnvoyCombatState(next);
    return next;
  };

  const applyVeilFlux = (delta: number) => {
    if (operativeClass !== 'ENVOY') return veilFluxRef.current;
    const prev = envoyCombatStateRef.current;
    const next = dispatchEnvoy({
      type: 'ENVOY_APPLY_FLUX_DELTA',
      delta,
      masochisticChannel: envoyBoonModsRef.current.masochisticChannel,
    });
    if (!prev.isVoidSiphoned && next.isVoidSiphoned) {
      if (!voidSiphonedEnteredRef.current) {
        voidSiphonedEnteredRef.current = true;
        runEnvoyVoidSiphonedEntryBoons({
          boons: envoyBoons,
          encounter: classBoonEncounterRef.current,
          firstVoidSiphonThisEncounter: true,
          log,
          resetCooldowns: () => {
            graftCooldownsRef.current = {};
          },
          dealOccultAoE: (amount) => {
            for (const unit of aliveUnits(squadRef.current)) {
              if (!unit.unitId) continue;
              hurtEnemy(amount, '[EMERGENCY VENT]', 'STRIKE', {
                channel: 'OCCULT',
                targetId: unit.unitId,
                rollCrit: false,
              });
            }
          },
        });
      }
      log(
        envoyBoonModsRef.current.masochisticChannel
          ? '>> [VOID-SIPHONED] — flux depleted // masochistic channel holds cast access open.'
          : '>> [VOID-SIPHONED] — flux depleted // SPELL and CURSE channels sealed.',
      );
    } else if (prev.isVoidSiphoned && !next.isVoidSiphoned) {
      log('>> [VEIL-FLUX] — reservoir restored // cast channels online.');
    }
    return next.veilFlux;
  };

  const applyGodModeResources = () => {
    operativeHpRef.current = maxSoulAnchor;
    setOperativeHp(maxSoulAnchor);
    applyStamina(maxStamina);
    if (operativeClass === 'HEX_SHOT') {
      setMagazineAmmo(maxAmmo);
      applyHexShotCombatState(createInitialHexShotCombatState({
        hp: operativeHpRef.current,
        maxHp: maxSoulAnchor,
        stamina: staminaRef.current,
        maxStamina,
        ap: playerApRef.current,
        ammo: maxAmmo,
        maxAmmo,
      }));
    } else if (operativeClass === 'ENVOY') {
      voidSiphonedEnteredRef.current = false;
      dispatchEnvoy({
        type: 'ENVOY_ENCOUNTER_START',
        fluxMaxCap,
        startingFlux: fluxMaxCap,
        masochisticChannel: envoyBoonModsRef.current.masochisticChannel,
      });
    } else {
      abyssalRef.current = mutationModsRef.current.abyssalCap;
      setAbyssalReserve(mutationModsRef.current.abyssalCap);
    }
    sessionExtrasRef.current.playerDebuffs = [];
    sessionExtrasRef.current.structuredDebuffs = [];
  };

  useEffect(() => {
    cycleRef.current = cycleState; enemyRef.current = enemy;
    operativeHpRef.current = operativeHp; staminaRef.current = stamina;
    abyssalRef.current = abyssalReserve;
    counterRef.current = voidWardPrimedRef.current;
    isPlayerTurnRef.current = isPlayerTurn;
    playerApRef.current = playerActionPoints;
  }, [cycleState, enemy, operativeHp, stamina, abyssalReserve, voidWardPrimed, isPlayerTurn, playerActionPoints]);

  const combatTurnPhase = useMemo((): CombatTurnPhase => {
    if (cycleState === 'RESOLUTION') return 'RESOLUTION';
    if (cycleState === 'DEFEND_PARRY') return 'PARRY_WINDOW';
    if (cycleState === 'OFFENSE_SLICE') return 'SLICE';
    if (!isPlayerTurn && enemyActionStage === 'reading') return 'ENEMY_WINDUP';
    if (!isPlayerTurn) return 'ENEMY_ACTION';
    return 'PLAYER_COMMAND';
  }, [cycleState, enemyActionStage, isPlayerTurn]);

  if (combatTurnPhase !== 'RESOLUTION') {
    lastActiveTurnPhaseRef.current = combatTurnPhase;
  }

  const setCombatTurnState = combatTurn?.setCombatTurnState;

  useEffect(() => {
    if (!setCombatTurnState) return;
    setCombatTurnState({
      isPlayerTurn: isPlayerTurn && cycleState === 'TEXT_COMBAT',
      phase: combatTurnPhase,
      canUseCargo: isPlayerTurn && cycleState === 'TEXT_COMBAT',
      playerActionPoints,
      runCredits,
    });
  }, [combatTurnPhase, cycleState, isPlayerTurn, playerActionPoints, runCredits, setCombatTurnState]);


  const resolveActingEnemyId = (): string | null =>
    enemyActionQueueRef.current[0] ?? focusedUnitIdRef.current ?? null;

  const resolvePortraitGlow = (unitId: string, intent: EnemyIntent): EnemyPortraitGlow => {
    if (fractureBreakUnitIdRef.current === unitId) {
      return 'fracture-breach';
    }
    if (
      !isPlayerTurnRef.current
      && cycleRef.current === 'TEXT_COMBAT'
      && enemyActionStageRef.current === 'executing'
    ) {
      const actingId = resolveActingEnemyId();
      if (actingId === unitId) {
        if (isEnemyChargeIntent(intent)) return 'enemy-charging';
        if (isEnemyDamageIntent(intent)) return 'enemy-attacking';
      }
    }
    const staged = selectedAbilityRef.current;
    // AoE abilities affect the whole group — never glow a single pick as "the" target.
    if (
      staged
      && classAbilityTargetMode(operativeClass, staged) === 'ALL'
    ) {
      return 'none';
    }
    if (
      isPlayerTurnRef.current
      && cycleRef.current === 'TEXT_COMBAT'
      && selectedTargetIdRef.current === unitId
    ) {
      return 'player-selected';
    }
    return 'none';
  };

  const resolvePortraitAnim = (unitId: string, intent: EnemyIntent): EnemyPortraitAnim => {
    if (
      !isPlayerTurnRef.current
      && cycleRef.current === 'TEXT_COMBAT'
      && enemyActionStageRef.current != null
      && resolveActingEnemyId() === unitId
    ) {
      if (isEnemySiphonIntent(intent)) return 'shimmy';
      if (
        enemyActionStageRef.current === 'executing'
        && isEnemyDamageIntent(intent)
        && !isEnemyWindUpIntent(intent)
      ) {
        return 'lunge';
      }
    }
    return 'none';
  };

  const resolveIntentShimmer = (unitId: string, u: EnemyCombatProfile): EnemyIntentShimmer | null => {
    if (isEvadePostureActive(u)) return 'evade';
    if ((u.fortifyTurnsRemaining ?? 0) > 0) return 'fortify';
    if (
      u.intent === 'FORTIFY'
      && !isPlayerTurnRef.current
      && cycleRef.current === 'TEXT_COMBAT'
      && enemyActionStageRef.current != null
      && resolveActingEnemyId() === unitId
    ) {
      return 'fortify';
    }
    return null;
  };

  const publishSquadUi = (nextSquad: EnemyCombatProfile[]) => {
    if (operativeClass === 'ENVOY') {
      const rotTotal = totalVeilRotStacks(classCombatRef.current);
      setEnvoyRotStacksUi(rotTotal);
      const rotReady = evaluateEnvoyCataclysmReady(classCombatRef.current, nextSquad);
      const ready = rotReady
        && canFireWeaponUltimate(activeWeaponFamilyId);
      classCombatRef.current.cataclysmReady = ready;
      if (ready !== cataclysmReadyPrevRef.current) {
        cataclysmReadyPrevRef.current = ready;
        setCataclysmReadyUi(ready);
        if (ready && activeWeaponFamilyId) {
          const tag = formatWeaponUltimateLogTag(activeWeaponFamilyId);
          log(`>> ${tag} >> Rot saturation critical — ultimate channel armed.`);
        }
      }
      syncEnvoyFleshRotArmorDebuff(
        envoyBoons,
        nextSquad,
        classCombatRef.current,
        patchUnit,
      );
    }
    if (!onSquadUiChange) return;
    if (nextSquad.length === 0) return;
    const staged = selectedAbility;
    const targetMode = staged ? classAbilityTargetMode(operativeClass, staged) : 'NONE';
    const playerSelecting = canPlayerCommand();
    const fractureBreachActive = fractureBreakUnitIdRef.current != null;
    const abilityTargeting = staged != null && (targetMode === 'SINGLE' || targetMode === 'ALL');
    const targetingActive = playerSelecting || abilityTargeting || fractureBreachActive;
    const validTargets = staged && abilityTargeting
      ? validTargetsForClassAbility(operativeClass, nextSquad, staged)
      : [];
    const validIds = new Set(validTargets.map((u) => u.unitId));
    onSquadUiChange({
      squadSize: aliveUnits(nextSquad).length,
      targetingActive,
      abilityTargetingActive: abilityTargeting,
      stagedAbilityId: staged,
      turnOrder: buildCombatTurnOrder({
        squad: nextSquad,
        operativeClass,
        phase: combatTurnPhase,
        enemyQueue: enemyActionQueueRef.current,
      }),
      units: nextSquad.map((u) => {
        const unitId = u.unitId ?? u.designation;
        const isFractureBreachTarget = fractureBreakUnitIdRef.current === unitId;
        const threatTier = resolveEnemyThreatTier({
          isBoss: u.isBoss,
          isApex: u.isApex,
          rosterId: u.rosterId,
        });
        const hookValid = staged != null && isUnitHookValidForClass(operativeClass, staged, u);
        const alive = isUnitAlive(u);
        if (alive) {
          // Keep living / fractured hostiles mounted — never publish a stuck dissolve hide.
          delete dissolveSeqRef.current[unitId];
          dissolvedHiddenRef.current.delete(unitId);
        }
        const targetable = fractureBreachActive
          ? (alive && isFractureBreachTarget)
          : targetingActive && alive && (
            !staged || !abilityTargeting || validIds.has(u.unitId!) || hookValid
          );
        const blocked = staged != null && abilityTargeting && targetMode === 'SINGLE'
          && isUnitBlockedForClassAbility(operativeClass, nextSquad, staged, unitId)
          && !hookValid;
        const motionOptions = { arenaLayout: true, gridSlot: u.gridSlot ?? null };
        const isActiveActor = (
          skipTurnUnitIdsRef.current.has(unitId)
          || resolveActingEnemyId() === unitId
        )
          && enemyActionStageRef.current != null
          && !isPlayerTurnRef.current
          && cycleRef.current === 'TEXT_COMBAT';
        const actingIntent = isActiveActor ? resolveEffectiveEnemyIntent(u) : u.intent;
        const isSkipActor = skipTurnUnitIdsRef.current.has(unitId);
        const motionKind = isSkipActor
          ? 'buff'
          : classifyEnemyTurnMotion(actingIntent, motionOptions);
        const turnPhase = isActiveActor
          ? resolveEnemyTurnPhase(
            isSkipActor ? 'FORTIFY' : actingIntent,
            enemyActionStageRef.current,
            motionOptions,
          )
          : null;
        const sensoryJammed = hasStructuredDebuff(sessionExtrasRef.current, 'SENSORY_JAMMED');
        const displayIntent = sensoryJammed ? ('SENSORY_JAM' as EnemyIntent) : u.intent;
        return {
          unitId,
          slot: u.gridSlot ?? 'FL_0',
          designation: u.designation,
          currentHp: visualHpHoldRef.current[unitId] ?? u.currentHp,
          maxHp: u.maxHp,
          intent: displayIntent,
          intentLabel: sensoryJammed ? 'STATIC // JAMMED' : formatIntentReadout(u.intent),
          intentSeverity: sensoryJammed ? 'MODERATE' : getIntentSeverity(u.intent),
          intentType: sensoryJammed ? 'DEBUFF' : getIntentType(u.intent),
          intentTurnsRemaining: sensoryJammed
            ? 0
            : estimateTurnsRemaining(u.intent, u),
          fractureGauge: u.fractureGauge ?? 0,
          fractureMax: u.fractureMax ?? 100,
          kineticArmor: u.kineticArmor ?? 0,
          occultWards: u.occultWards ?? 0,
          combatTags: u.combatTags ?? [],
          evadeActive: u.evadeActive,
          evadeTurnsRemaining: u.evadeTurnsRemaining ?? 0,
          fortifyTurnsRemaining: u.fortifyTurnsRemaining ?? 0,
          chargeTurns: u.chargeTurns ?? 0,
          doomedStacks: u.doomedStacks ?? 0,
          veilRotStacks: operativeClass === 'ENVOY' && u.unitId
            ? (classCombatRef.current.veilRotStacks[u.unitId] ?? 0)
            : 0,
          activeStatuses: resolveActiveEnemyStatuses({
            combatTags: u.combatTags ?? [],
            evadeActive: u.evadeActive,
            evadeTurnsRemaining: u.evadeTurnsRemaining ?? 0,
            intent: u.intent,
            fortifyTurnsRemaining: u.fortifyTurnsRemaining ?? 0,
            doomedStacks: u.doomedStacks ?? 0,
            isEnraged: u.isEnraged ?? false,
          }),
          isBoss: u.isBoss,
          isApex: u.isApex,
          isAlpha: u.isAlpha === true,
          isElite: threatTier === 'ELITE' || threatTier === 'APEX' || u.isAlpha === true,
          isVeilStalker: u.isVeilStalker,
          enemyClass: u.class,
          rosterId: u.rosterId,
          isDead: !isUnitAlive(u),
          isSelected: targetMode === 'ALL'
            ? false
            : (selectedTargetIdRef.current === u.unitId
              || focusedUnitIdRef.current === u.unitId),
          isTargetable: targetable,
          isAoeAffected: targetMode === 'ALL' && targetable,
          isFocused: focusedUnitIdRef.current === u.unitId,
          isActingEnemy: isActiveActor,
          isExecutingAttack: isActiveActor
            && enemyActionStageRef.current === 'executing'
            && motionKind !== 'buff',
          turnPhase,
          statusFloatSeq: statusFloatSeqRef.current[unitId] ?? 0,
          statusFloatLabel: lifecycleFloatLabelsRef.current[unitId]
            ?? (isSkipActor && enemyActionStageRef.current === 'executing'
              ? 'Turn Skipped'
              : isActiveActor && motionKind === 'buff' && enemyActionStageRef.current === 'executing'
                ? getEnemyBuffFloatLabel(u.intent)
                : undefined),
          statusFloatTone: lifecycleFloatTonesRef.current[unitId]
            ?? (lifecycleFloatLabelsRef.current[unitId]
              ? 'fortify'
              : isSkipActor
                ? 'neutral'
                : getStatusFloatTone(u.intent)),
          damageFloatSeq: damageFloatSeqRef.current[unitId] ?? 0,
          damageFloatLabel: damageFloatLabelsRef.current[unitId],
          isBacklineDashing: backlineDashActiveRef.current[unitId] === true,
          backlineMeleeDashSeq: backlineDashSeqRef.current[unitId] ?? 0,
          isBlocked: blocked,
          isHookValid: hookValid,
          isFractured: isEnemyFractured(u),
          isFractureBreachTarget,
          portraitGlow: resolvePortraitGlow(unitId, u.intent),
          portraitAnim: resolvePortraitAnim(unitId, u.intent),
          intentShimmer: resolveIntentShimmer(unitId, u),
          critImpactSeq: critImpactSeqRef.current[unitId]?.seq ?? 0,
          critImpactChannel: critImpactSeqRef.current[unitId]?.channel,
          evadeImpactSeq: evadeImpactSeqRef.current[unitId] ?? 0,
          immuneFloatSeq: sessionExtrasRef.current.immunePopupSeq[unitId] ?? 0,
          immuneFloatLabel: (sessionExtrasRef.current.immunePopupSeq[unitId] ?? 0) > 0 ? 'IMMUNE' : undefined,
          hitFlashSeq: hitFlashSeqRef.current[unitId] ?? 0,
          bloodBurstRepeats: bloodBurstRepeatsRef.current[unitId] ?? 1,
          bloodMistScale: bloodMistScaleRef.current[unitId] ?? 1,
          fractureShatterSeq: fractureShatterSeqRef.current[unitId] ?? 0,
          classImpactFxSeq: classImpactFxRef.current[unitId]?.seq ?? 0,
          classImpactFxKind: classImpactFxRef.current[unitId]?.kind,
          isEnraged: u.isEnraged ?? false,
          isSlumped: u.isSlumped === true,
          slumpTurnsRemaining: u.slumpTurnsRemaining ?? 0,
          slumpGraceThisPlayerTurn: u.slumpGraceThisPlayerTurn === true,
          dissolveSeq: dissolveSeqRef.current[unitId] ?? 0,
          dissolveHidden: dissolvedHiddenRef.current.has(unitId),
        };
      }),
    });
  };

  const allDeadUnitsDissolved = (squad: EnemyCombatProfile[]) =>
    squad.every((u) => {
      if (isUnitAlive(u)) return true;
      const id = u.unitId ?? u.designation;
      return dissolvedHiddenRef.current.has(id);
    });

  const tryResolvePendingVictory = () => {
    if (
      resolutionRef.current != null
      || !allUnitsDefeated(squadRef.current)
      || !allDeadUnitsDissolved(squadRef.current)
    ) {
      return false;
    }
    if (victoryFallbackTimerRef.current) {
      clearTimeout(victoryFallbackTimerRef.current);
      victoryFallbackTimerRef.current = null;
    }
    pendingVictoryRef.current = false;
    resolveVictoryRef.current();
    return true;
  };

  const clearVictoryBlockers = () => {
    combatPausedRef.current = false;
    syncFractureBreakTarget(null);
    setZeroProtocolVisible(false);
    zeroProtocolActiveRef.current = false;
    setCataclysmSigilVisible(false);
  };

  const scheduleCombatVictoryResolution = () => {
    if (resolutionRef.current != null || !allUnitsDefeated(squadRef.current)) return;
    pendingVictoryRef.current = true;
    wasEnemyTurnAtVictoryRef.current = !isPlayerTurnRef.current;
    clearVictoryBlockers();
    // Only the latest lethal hit triggers dissolve via hurtEnemy — do not replay earlier deaths.

    if (victoryFallbackTimerRef.current) {
      clearTimeout(victoryFallbackTimerRef.current);
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        tryResolvePendingVictory();
      });
    });

    victoryFallbackTimerRef.current = setTimeout(() => {
      victoryFallbackTimerRef.current = null;
      if (resolutionRef.current != null || !allUnitsDefeated(squadRef.current)) return;
      // Force-complete dissolve gates even if onComplete never fired (seq still > 0).
      for (const unit of squadRef.current) {
        if (isUnitAlive(unit)) continue;
        const id = unit.unitId ?? unit.designation;
        dissolvedHiddenRef.current.add(id);
      }
      publishSquadUi(squadRef.current);
      tryResolvePendingVictory();
    }, ASHEN_DISSOLVE_TOTAL_MS + 250);
  };

  const handleUnitDissolveComplete = (unitId: string) => {
    const unit = getUnitById(squadRef.current, unitId);
    if (unit && isUnitAlive(unit)) {
      delete dissolveSeqRef.current[unitId];
      dissolvedHiddenRef.current.delete(unitId);
      publishSquadUi(squadRef.current);
      return;
    }
    dissolvedHiddenRef.current.add(unitId);
    publishSquadUi(squadRef.current);

    if (!allUnitsDefeated(squadRef.current)) return;

    requestAnimationFrame(() => {
      requestAnimationFrame(tryResolvePendingVictory);
    });
  };

  const handleUnitDissolveCompleteRef = useRef(handleUnitDissolveComplete);
  handleUnitDissolveCompleteRef.current = handleUnitDissolveComplete;

  useEffect(() => {
    registerDissolveCompleteHandler?.((unitId) => handleUnitDissolveCompleteRef.current(unitId));
  }, [registerDissolveCompleteHandler]);

  /** Cancel ashen dissolve when a unit is still (or again) a living combatant. */
  const clearDissolveForLivingUnit = (unitId: string) => {
    const hadSeq = (dissolveSeqRef.current[unitId] ?? 0) > 0;
    const wasHidden = dissolvedHiddenRef.current.has(unitId);
    if (!hadSeq && !wasHidden) return false;
    delete dissolveSeqRef.current[unitId];
    dissolvedHiddenRef.current.delete(unitId);
    return true;
  };

  const beginDissolveForUnit = (
    unitId: string,
    profile: EnemyCombatProfile,
    hp: number,
  ) => {
    if (hp > 0) return;
    // Fracture / thrall slump can leave currentHp at 0 briefly while still "alive".
    const latest = getUnitById(squadRef.current, unitId) ?? profile;
    if (isUnitAlive(latest)) {
      clearDissolveForLivingUnit(unitId);
      return;
    }
    const bump = (id: string) => {
      if (dissolvedHiddenRef.current.has(id)) return;
      if ((dissolveSeqRef.current[id] ?? 0) > 0) return;
      dissolveSeqRef.current[id] = 1;
      backlineDashActiveRef.current[id] = false;
    };
    bump(unitId);
    if (profile.sharedBossPool) {
      squadRef.current.forEach((unit) => {
        if (unit.unitId && unit.sharedBossPool) bump(unit.unitId);
      });
    }
    publishSquadUi(squadRef.current);
    if (allUnitsDefeated(squadRef.current)) {
      scheduleCombatVictoryResolution();
    }
  };

  const consumeAdrenalinePrimerTurnBonus = (): number => {
    if (adrenalinePrimerTurnsRef.current <= 0) return 0;
    adrenalinePrimerTurnsRef.current -= 1;
    return 1;
  };

  const focusEnemy = (unit: EnemyCombatProfile | null) => {
    enemyRef.current = unit;
    setEnemy(unit);
    if (unit?.unitId) focusedUnitIdRef.current = unit.unitId;
    publishSquadUi(squadRef.current);
  };

  const syncSquad = (next: EnemyCombatProfile[]) => {
    const reconciled = reconcileSquadGridSlots(next);
    const tagged = reconciled.map((unit) => patchEnemyTagsFromExtras(unit, sessionExtrasRef.current));
    squadRef.current = tagged;
    setSquad(tagged);
    const focusId = focusedUnitIdRef.current ?? selectedTargetIdRef.current;
    const focused = (focusId ? getUnitById(tagged, focusId) : null) ?? primaryAliveUnit(tagged);
    if (focused?.unitId) focusedUnitIdRef.current = focused.unitId;
    focusEnemy(focused);
    publishSquadUi(tagged);
  };

  const applyPlayerTurnBlueprintHooks = () => {
    // Weapon v1 — no turn-start blueprint hooks.
  };

  const buildWeaponHookContext = () => ({
    weapon: resolvedWeapon!,
    runtime: weaponRuntimeRef.current,
    blueprintId: null,
    player: {
      hp: operativeHpRef.current,
      maxHp: maxSoulAnchor,
      shield: sessionExtrasRef.current.playerShield,
      shieldTurnsRemaining: sessionExtrasRef.current.playerShieldTurnsRemaining,
      debuffs: [...sessionExtrasRef.current.playerDebuffs],
    },
    squad: squadRef.current,
  });

  const applyWeaponRuntimePatch = (patch: Partial<import('../types/weapon').WeaponRuntimeState>) => {
    weaponRuntimeRef.current = { ...weaponRuntimeRef.current, ...patch };
  };

  const patchUnit = (unitId: string, patch: Partial<EnemyCombatProfile>) => {
    const prev = getUnitById(squadRef.current, unitId);
    const wasFractured = prev ? isEnemyFractured(prev) : false;
    const nextSquad = patchSquadUnit(squadRef.current, unitId, patch);
    const next = getUnitById(nextSquad, unitId);
    // Living / fractured hostiles must never stay stuck in ashen dissolve opacity 0.
    if (next && isUnitAlive(next)) {
      clearDissolveForLivingUnit(unitId);
    }
    if (next && !wasFractured && isEnemyFractured(next)) {
      Vibration.vibrate(40);
      const weeping = resolveWeepingGargoyleFracturePulse(depthVariantRuntimeRef.current, next);
      depthVariantRuntimeRef.current = weeping.runtime;
      if (weeping.damage > 0) {
        if (weeping.logLine) log(weeping.logLine);
        hurtPlayer(weeping.damage, true, weeping.logLine ?? undefined, {
          rollEvade: false,
          rollCrit: false,
        });
      }
      if (resolvedWeapon) {
        const fractureHooks = runWeaponOnFractureHooks(buildWeaponHookContext());
        fractureHooks.logLines.forEach((line) => log(line));
        if (fractureHooks.runtimePatch) applyWeaponRuntimePatch(fractureHooks.runtimePatch);
        if (fractureHooks.staminaDelta) {
          applyStamina(staminaRef.current + fractureHooks.staminaDelta);
        }
        const claymore = resolveClaymoreFractureBreakReserve(
          resolvedWeapon.familyId,
          weaponRuntimeRef.current,
        );
        if (claymore.runtimePatch) applyWeaponRuntimePatch(claymore.runtimePatch);
        if (claymore.reserveGain > 0) {
          chargeAr(claymore.reserveGain, true);
          if (claymore.log) log(claymore.log);
        }
      }
    }
    syncSquad(nextSquad);
  };

  const syncEnemy = (e: EnemyCombatProfile) => {
    if (e.unitId) patchUnit(e.unitId, e);
    else focusEnemy(e);
  };

  const selectTarget = useCallback((unitId: string) => {
    const pendingBreachId = fractureBreakUnitIdRef.current;
    if (pendingBreachId != null) {
      if (unitId === pendingBreachId) {
        executeFractureBreakRef.current(pendingBreachId);
      }
      return;
    }
    if (!canPlayerCommand()) return;
    const unit = getUnitById(squadRef.current, unitId);
    if (!unit || !isUnitAlive(unit)) return;

    const staged = selectedAbilityRef.current;
    const targetMode = staged
      ? classAbilityTargetMode(operativeClass, staged)
      : 'NONE';

    if (staged && targetMode === 'SINGLE') {
      if (!canTargetWithClassAbility(operativeClass, squadRef.current, staged, unitId)) {
        log('[TARGET] >> Line of sight blocked — clear the frontline column first.');
        publishSquadUi(squadRef.current);
        return;
      }
      selectedTargetIdRef.current = unitId;
      setSelectedTargetId(unitId);
      focusedUnitIdRef.current = unitId;
      enemyRef.current = unit;
      setEnemy(unit);
      executeOperativeAbilityRef.current(staged);
      setSelectedAbility(null);
      publishSquadUi(squadRef.current);
      return;
    }

    // AoE / self abilities: arena taps only refresh intel focus — cast via CONFIRM.
    if (staged && (targetMode === 'ALL' || targetMode === 'NONE')) {
      focusedUnitIdRef.current = unitId;
      enemyRef.current = unit;
      setEnemy(unit);
      // Keep selection cleared so HUD does not imply a single cast target.
      if (targetMode === 'ALL') {
        selectedTargetIdRef.current = null;
        setSelectedTargetId(null);
      }
      publishSquadUi(squadRef.current);
      return;
    }

    selectedTargetIdRef.current = unitId;
    setSelectedTargetId(unitId);
    focusedUnitIdRef.current = unitId;
    enemyRef.current = unit;
    setEnemy(unit);
    publishSquadUi(squadRef.current);
  }, [log, operativeClass]);
  const focusIntelTarget = useCallback((unitId: string) => {
    const unit = getUnitById(squadRef.current, unitId);
    if (!unit || !isUnitAlive(unit)) return;

    const staged = selectedAbilityRef.current;
    const targetMode = staged
      ? classAbilityTargetMode(operativeClass, staged)
      : 'NONE';

    // Single-target armed casts share the arena pipeline; AoE/self stay confirm-gated.
    if (canPlayerCommand() && staged != null && targetMode === 'SINGLE') {
      selectTarget(unitId);
      return;
    }

    focusedUnitIdRef.current = unitId;
    if (targetMode === 'ALL') {
      selectedTargetIdRef.current = null;
      setSelectedTargetId(null);
    } else {
      selectedTargetIdRef.current = unitId;
      setSelectedTargetId(unitId);
    }
    enemyRef.current = unit;
    setEnemy(unit);
    publishSquadUi(squadRef.current);
  }, [operativeClass, selectTarget]);
  const emitCombatFeedback = useCallback((event: CombatFeedbackEvent) => {
    feedbackNonceRef.current += 1;
    setCombatFeedback({ nonce: feedbackNonceRef.current, event });
  }, []);

  const emitJuice = useCallback((
    type: CombatJuiceFeedbackEvent['type'],
    opts?: Parameters<typeof buildCombatJuiceEvent>[1],
  ) => {
    const event = buildCombatJuiceEvent(type, opts);
    recordJuiceEvent(juiceTelemetryRef.current, event);
    // Phase 3M — juice events now drive audible/visual presentation (never mutate combat).
    try {
      dispatchCombatPresentationFromJuice(event);
    } catch {
      // Presentation must never block combat resolution.
    }
    if (event.text) {
      // Optional: surface high-intensity juice as phase pulse without spamming.
      if (event.intensity === 'HIGH' || event.intensity === 'CRITICAL') {
        setPhaseAlert(event.text.startsWith('>>') ? event.text : `>> ${event.text}`);
        setTimeout(() => setPhaseAlert(null), 1600);
      }
    }
    return event;
  }, []);

  /** Arena break float — clears after readout so the status lane can reuse. */
  const pushDefenseBreakFloat = useCallback((unitId: string, kind: 'armor' | 'ward') => {
    const profile = kind === 'armor'
      ? DEFENSE_TELEGRAPH_PROFILES.KINETIC_ARMOR
      : DEFENSE_TELEGRAPH_PROFILES.OCCULT_WARD;
    statusFloatSeqRef.current[unitId] = (statusFloatSeqRef.current[unitId] ?? 0) + 1;
    lifecycleFloatLabelsRef.current[unitId] = profile.breakLabel;
    lifecycleFloatTonesRef.current[unitId] = kind;
    setTimeout(() => {
      if (lifecycleFloatLabelsRef.current[unitId] === profile.breakLabel) {
        delete lifecycleFloatLabelsRef.current[unitId];
        delete lifecycleFloatTonesRef.current[unitId];
      }
    }, 1400);
  }, []);

  const clearDefenseBreakFloat = useCallback((unitId: string) => {
    delete lifecycleFloatLabelsRef.current[unitId];
    delete lifecycleFloatTonesRef.current[unitId];
  }, []);

  const chargeAr = (amt: number, _targetFractured = false) => {
    const scaled = amt;
    if (scaled > 0) {
      runOnReserveGenerate(buildAegisBoonHookCtx(), scaled);
    }
    setAbyssalReserve((p) => {
      const n = Math.min(p + scaled, mutationModsRef.current.abyssalCap);
      abyssalRef.current = n;
      return n;
    });
  };

  const imprintRunicBrand = (count = 1) => {
    if (count <= 0) return;
    setRunicBrands((prev) => {
      const next = Math.min(RUNIC_BRAND_CAP, prev + count);
      classCombatRef.current.runicBrands = next;
      return next;
    });
  };

  const consumeRunicBrands = (mode: 'ALL' | number): number => {
    const current = classCombatRef.current.runicBrands;
    const consumed = mode === 'ALL' ? current : Math.min(current, mode);
    const next = current - consumed;
    setRunicBrands(next);
    classCombatRef.current.runicBrands = next;
    return consumed;
  };

  const setRunicBrandCount = (count: number) => {
    const next = Math.max(0, Math.min(RUNIC_BRAND_CAP, count));
    classCombatRef.current.runicBrands = next;
    setRunicBrands(next);
  };

  const buildAegisBoonHookCtx = (): AegisBoonHookContext => ({
    owned: leyLineMutations,
    mods: mutationModsRef.current,
    encounter: mutationEncounterRef.current,
    chance: combatChanceRef.current,
    log,
    maxSoulAnchor,
    runicBrands: classCombatRef.current.runicBrands,
    healOperative: (amount) => applyHealRef.current(amount),
    chargeReserve: (amount) => {
      chargeAr(amount);
    },
  });

  const resolveAegisGraftDropLoot = (abilityId?: string | null): string | null => {
    const active = activeGraftPlanRef.current?.dropLootOnKill;
    if (active) return active;
    const resolved = (abilityId ?? lastPlayerAbilityRef.current) as AegisAbilityId | null;
    if (!resolved) return null;
    const graftId = abilityGraftsRef.current[resolved];
    if (!graftId) return null;
    return getVeilGraftDefinition(graftId).dropLootOnKill ?? null;
  };

  const triggerSpallShatterBurst = (blockedDamage: number) => {
    if (blockedDamage <= 0 || !hasMutation(leyLineMutations, 'SPALL_SHATTER')) return;
    let hitAny = false;
    for (const unit of aliveUnits(squadRef.current)) {
      if (!unit.unitId || !unit.gridSlot?.startsWith('FL')) continue;
      hurtEnemy(blockedDamage, '[SPALL SHATTER]', 'STRIKE', {
        channel: 'KINETIC',
        targetId: unit.unitId,
        abilityId: 'ASHEN_MANTLE',
      });
      hitAny = true;
    }
    if (hitAny) {
      log(`[SPALL SHATTER] >> Mantle collapse — ${blockedDamage} physical burst across frontline.`);
    }
  };

  const clearVoidWardShroud = () => {
    voidWardPrimedRef.current = false;
    setVoidWardPrimed(false);
    counterRef.current = false;
    setCounterPrepActive(false);
  };

  const syncRiposteState = (next: AegisRiposteState) => {
    classCombatRef.current.riposteReady = next.ready;
    classCombatRef.current.riposteExpiresAfterPlayerTurn = next.expiresAfterPlayerTurn;
    classCombatRef.current.riposteGrantedBy = next.grantedBy;
    classCombatRef.current.riposteGrantId = next.grantId;
    setRiposteReadyUi(next.ready);
  };

  const readRiposteState = (): AegisRiposteState => ({
    ready: classCombatRef.current.riposteReady,
    expiresAfterPlayerTurn: classCombatRef.current.riposteExpiresAfterPlayerTurn,
    grantedBy: classCombatRef.current.riposteGrantedBy,
    grantId: classCombatRef.current.riposteGrantId,
  });

  const armRiposteReady = (
    grantedBy: 'PERFECT_PARRY' | 'BOON' | 'GRAFT' | 'OTHER' = 'PERFECT_PARRY',
  ) => {
    if (operativeClass !== 'AEGIS') return;
    const result = grantAegisRiposte({
      state: readRiposteState(),
      currentPlayerTurns: Math.max(1, balanceEncounterRef.current.playerTurns),
      grantedBy,
      nowMs: Date.now(),
    });
    syncRiposteState(result.state);
    if (!result.refreshed) {
      classLoopTelemetryRef.current.ripostesReady += 1;
    }
    log(
      result.refreshed
        ? `[RIPOSTE READY] >> Refreshed (${grantedBy}) — expires after player turn ${result.state.expiresAfterPlayerTurn}.`
        : `[RIPOSTE READY] >> ${grantedBy} — expires after player turn ${result.state.expiresAfterPlayerTurn}.`,
    );
    setPhaseAlert('PERFECT PARRY — RIPOSTE READY');
    setTimeout(() => setPhaseAlert(null), 1600);
  };

  const consumeRiposteReady = (): boolean => {
    const result = consumeAegisRiposte(readRiposteState());
    if (!result.consumed) return false;
    syncRiposteState(result.state);
    classLoopTelemetryRef.current.ripostesConsumed += 1;
    emitJuice('RIPOSTE', { text: 'RIPOSTE +16' });
    return true;
  };

  const clearRiposteReady = (reason: string) => {
    if (!classCombatRef.current.riposteReady) return;
    syncRiposteState(clearAegisRiposte(readRiposteState()));
    log(`[RIPOSTE] >> Cleared — ${reason}.`);
  };

  const expireRiposteIfNeeded = () => {
    const result = expireAegisRiposteAtPlayerTurnEnd({
      state: readRiposteState(),
      currentPlayerTurns: Math.max(1, balanceEncounterRef.current.playerTurns),
    });
    if (!result.expired) return;
    syncRiposteState(result.state);
    log('[RIPOSTE EXPIRED] >> Unused charge faded at end of player turn.');
    setPhaseAlert('RIPOSTE EXPIRED');
    setTimeout(() => setPhaseAlert(null), 1400);
  };

  const signalRiposteHeld = () => {
    if (!classCombatRef.current.riposteReady) return;
    setPhaseAlert('RIPOSTE HELD');
    setTimeout(() => setPhaseAlert(null), 1200);
    log('[RIPOSTE HELD] >> Miss/evade — charge retained.');
  };
  const primeWardStrikeBonus = () => {
    wardStrikeBonusRef.current = true;
    setStrikeArPrimed(true);
  };
  const consumeWardStrikeBonus = () => {
    const primed = wardStrikeBonusRef.current;
    wardStrikeBonusRef.current = false;
    setStrikeArPrimed(false);
    return primed;
  };
  const primeVoidWardShroud = () => {
    voidWardPrimedRef.current = true;
    setVoidWardPrimed(true);
    counterRef.current = true;
    setCounterPrepActive(true);
    markPlayerDefendedRef.current();
    classLoopTelemetryRef.current.parriesAttempted += 1;
    log('[VOID WARD] >> Shroud primed — kinetic intercept armed for hostile phase.');
  };
  const scaleSlice = (d: number) => sliceDamagePenalty > 0 ? Math.floor(d * (1 - sliceDamagePenalty)) : d;

  const clearSliceTimers = () => {
    const s = sliceSessionRef.current;
    if (s.segmentTimer) { clearTimeout(s.segmentTimer); s.segmentTimer = null; }
    if (s.hitFlashTimer) { clearTimeout(s.hitFlashTimer); s.hitFlashTimer = null; }
  };

  const showStrikeFeedback = (variant: EnemyDeckStrikeVariant) => {
    playerViewportRef?.current?.triggerDamageEffect(variant);
  };

  const flash = (color: string, done?: () => void) => {
    setScreenFlashColor(color); setScreenFlashActive(true); screenFlashAnim.setValue(0);
    Animated.sequence([
      Animated.timing(screenFlashAnim, { toValue: 0.38, duration: 90, easing: Easing.out(Easing.cubic), useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(screenFlashAnim, { toValue: 0.26, duration: 160, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(screenFlashAnim, { toValue: 0, duration: 520, easing: Easing.inOut(Easing.cubic), useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start(() => { setScreenFlashActive(false); done?.(); });
  };

  const clearParryHaloTimer = () => {
    if (parryHaloTimerRef.current) {
      clearTimeout(parryHaloTimerRef.current);
      parryHaloTimerRef.current = null;
    }
  };

  const syncParryBurstChrome = (active: boolean, arena: ParryArenaLayout | null, epoch: number) => {
    const chrome = enemyChromeRef.current;
    if (!chrome) return;
    chrome.parryBurstLiveRef.current = { active, arena, epoch };
    queueMicrotask(() => {
      const liveChrome = enemyChromeRef.current;
      if (!liveChrome) return;
      liveChrome.notifyParryChromeChange();
    });
  };

  const clearParrySuccessBurst = () => {
    clearParryHaloTimer();
    syncParryBurstChrome(false, null, 0);
    setParrySuccessBurstActive(false);
    setParryBurstArena(null);
    parryBurstCompleteRef.current = null;
  };

  const startParrySuccessBurst = (onComplete: () => void) => {
    const arena = parryArenaRef.current;
    if (!arena) {
      onComplete();
      return;
    }
    parryBurstEpochRef.current += 1;
    const epoch = parryBurstEpochRef.current;
    parryBurstCompleteRef.current = onComplete;
    syncParryBurstChrome(true, arena, epoch);
    setParryBurstEpoch(epoch);
    setParryBurstArena(arena);
    setParrySuccessBurstActive(true);
    clearParryHaloTimer();
    parryHaloTimerRef.current = setTimeout(() => {
      parryHaloTimerRef.current = null;
      syncParryBurstChrome(false, null, 0);
      setParrySuccessBurstActive(false);
      setParryBurstArena(null);
      const done = parryBurstCompleteRef.current;
      parryBurstCompleteRef.current = null;
      done?.();
    }, PARRY_HALO_DURATION_MS);
  };

  const clearEnemyTurnTimers = () => {
    if (enemyTurnTimerRef.current) {
      clearTimeout(enemyTurnTimerRef.current);
      enemyTurnTimerRef.current = null;
    }
    if (enemyTurnGapTimerRef.current) {
      clearTimeout(enemyTurnGapTimerRef.current);
      enemyTurnGapTimerRef.current = null;
    }
    if (enemyStrikeTimerRef.current) {
      clearTimeout(enemyStrikeTimerRef.current);
      enemyStrikeTimerRef.current = null;
    }
    voidAmbushWindowRef.current = null;
    setEnemyActionStage(null);
    preAppliedHpStrikeRef.current = 0;
  };

  const abortCombatMinigames = () => {
    clearParrySuccessBurst();
    clearSliceTimers();
    const s = sliceSessionRef.current;
    s.evaluated = true;
    activeSliceRef.current = -1;
    setActiveSliceIndex(-1);
    setEviscerateTargetUnitId(null);
    crossedRef.current = false;
    sliceTouchStartRef.current = null;
    clearEnemyTurnTimers();
    cancelAnimation(parryScaleSV);
    parryResolvedRef.current = true;
    parryTapPendingRef.current = false;
    parrySessionRef.current += 1;
    setActiveReloadVisible(false);
    setHexReloadSuppressesAttackSfx(false);
  };

  const resolve = (victory: boolean) => {
    if (resolutionRef.current != null) return;
    clearPlayerMaxHpDebt(sessionExtrasRef.current);
    setPlayerMaxAnchorDebt(0);
    if (victoryFallbackTimerRef.current) {
      clearTimeout(victoryFallbackTimerRef.current);
      victoryFallbackTimerRef.current = null;
    }
    if (operativeHpRef.current <= 0) victory = false;
    if (victory) {
      wasEnemyTurnAtVictoryRef.current = !isPlayerTurnRef.current;
    }
    abortCombatMinigames();
    cycleRef.current = 'RESOLUTION';
    setCycleState('RESOLUTION');
    if (victory) {
      resolutionRef.current = 'VICTORY';
      const primary = objectiveSessionRef.current.primary;
      if (primary?.kind === 'HOLD_EXTRACTION_WINDOW' || env.combatObjective === 'SURVIVE_TURNS') {
        log('[DEFEND THE RIFT] >> Evac conduit stabilized. Hostile interdiction repelled.');
        emitJuice('DIRTY_EXTRACTION_SURVIVED', { text: 'Dirty Extraction survived' });
      } else if (primary && primary.status === 'COMPLETE') {
        log(`[OBJECTIVE] >> ${primary.label} secured.`);
        emitJuice('OBJECTIVE_COMPLETED', { text: primary.label });
      } else {
        log('[EXORCISED] >> Hostile neutralized. Incursion sealed.');
      }
      setResolutionOutcome('VICTORY');
      const creditBonusPct = (env.directorCreditsBonusPct ?? 0)
        + (activeIncursionRefLocal.current.runModifiers?.creditBonusPct ?? 0);
      const creditBase = 750;
      const credits = creditBonusPct > 0
        ? Math.floor(creditBase * (1 + creditBonusPct / 100))
        : creditBase;
      awardCurrencies(credits, 25);
    } else {
      resolutionRef.current = 'DEFEAT';
      setResolutionOutcome('DEFEAT');
      log('[CRITICAL] >> Operative soul anchor severed. Veil sync lost.');
      flash(P.defeat);
    }
  };

  const syncObjectiveHud = () => {
    setObjectiveHudLine(formatObjectiveHudLine(objectiveSessionRef.current));
    const activeTimeline = objectiveSessionRef.current.timeline.find((ev) => !ev.previewOnly)
      ?? objectiveSessionRef.current.timeline[0];
    setTimelineHudLine(
      activeTimeline
        ? `${activeTimeline.label} T-${activeTimeline.turnsRemaining}`
        : null,
    );
  };

  const applyObjectiveProgress = (
    result: ReturnType<typeof progressObjectiveOnEnemyTurnEnd>,
  ) => {
    objectiveSessionRef.current = result.session;
    result.logLines.forEach((line) => log(line));
    if (result.phaseAlert) {
      setPhaseAlert(result.phaseAlert);
      setTimeout(() => setPhaseAlert(null), 2200);
    }
    syncObjectiveHud();
    if (result.primaryCompleted) {
      const primary = result.session.primary;
      emitJuice('OBJECTIVE_COMPLETED', {
        text: primary?.label ?? 'Objective secured',
      });
      if (primary?.replacesPressure) {
        resolve(true);
      }
    }
  };

  const snapshotObjectiveTelemetry = (): EncounterObjectiveTelemetry => {
    const session = objectiveSessionRef.current;
    const primary = session.primary;
    return {
      ...createEmptyObjectiveTelemetry(),
      objectivePresented: primary != null,
      primaryKind: primary?.kind ?? null,
      primaryTemplateId: primary?.templateId ?? null,
      source: session.source,
      softKinds: session.secondary.map((s) => s.kind),
      completed: primary?.status === 'COMPLETE',
      failed: primary?.status === 'FAILED',
      enemyTurnsSurvived: session.enemyTurnsSurvived,
      channelsInterrupted: session.channelsInterrupted,
      markedKills: session.markedKills,
      detonationsPrevented: session.detonationsPrevented,
      cargoStressTicks: session.cargoStressTicks,
      timelineEventsSeen: session.timeline.length,
      replacedPressure: primary?.replacesPressure ?? false,
    };
  };

  const resolveVictoryRef = useRef(() => resolve(true));
  resolveVictoryRef.current = () => resolve(true);

  useEffect(() => {
    registerKillResolver?.(() => resolveVictoryRef.current());
  }, [registerKillResolver]);

  const cargoHealMultRef = useRef(cargoHealReceivedMultiplier);
  cargoHealMultRef.current = cargoHealReceivedMultiplier;

  const applyHealRef = useRef((amount: number) => {
    setOperativeHp((p) => {
      const n = Math.min(p + amount, combatMaxSoulAnchorRef.current);
      operativeHpRef.current = n;
      return n;
    });
  });
  applyHealRef.current = (amount: number) => {
    const weaponMods = resolvedWeapon?.statModifiers;
    const { effectiveAmount, logged } = resolvePlayerHealReceived({
      rawAmount: amount,
      mods: weaponMods,
      healingReceivedPenaltyPct: runItemCombatFlagsRef.current.healingReceivedPenaltyPct,
      cargoHealMult: cargoHealMultRef.current,
    });
    if (logged) log(logged);
    if (effectiveAmount <= 0) return;
    setOperativeHp((p) => {
      const n = Math.min(p + effectiveAmount, getEffectiveMaxSoulAnchor());
      const gained = Math.max(0, n - p);
      if (gained > 0) balanceEncounterRef.current.healingReceived += gained;
      operativeHpRef.current = n;
      return n;
    });
  };

  useEffect(() => {
    registerHealHandler?.((amount: number) => applyHealRef.current(amount));
  }, [registerHealHandler, combatMaxSoulAnchor]);

  const interruptsWorldEnderChannel = (e: EnemyCombatProfile) =>
    e.intent === 'CHARGE' || e.intent === 'WORLD_ENDER' || e.chargeTurns > 0
    || enemyIsTelegraphing(e);

  const resolveOperativeAbilityTags = (abilityId: string | null | undefined): readonly string[] => {
    if (!abilityId) return [];
    return resolveWeaponUltimateActionTags(abilityId, operativeClass);
  };

  const applyVeilShardFracture = () => {
    const targetId = selectedTargetIdRef.current ?? primaryAliveUnit(squadRef.current)?.unitId;
    const e = targetId ? getUnitById(squadRef.current, targetId) : enemyRef.current;
    if (!e?.unitId) return;
    if (interruptsWorldEnderChannel(e)) {
      const counter = resolveIntentCounterplay({
        intent: e.intent,
        playerActionTags: ['INTERRUPT', 'FRACTURE'],
        sourceCombatant: e,
        incomingDamage: e.baseDamage,
      });
      recordIntentCountered(intentTelemetryRef.current, e.intent, counter.counterQuality, {
        damagePrevented: counter.reducedDamageAmount,
        appliedFracture: true,
      });
      patchUnit(e.unitId, applyIntentCounterplayToEnemy(e, {
        ...counter,
        cancelTelegraph: true,
        appliedFracture: true,
      }));
      log('>> WORLD-ENDER CHANNEL SHATTERED — hostile fracture maxed.');
      counter.logMessages.forEach((m) => log(`>> VEIL SHARD // ${m}`));
      return;
    }
    patchUnit(e.unitId, applyFracturedState(e));
    log(`>> VEIL SHARD — ${e.designation} fracture maxed.`);
  };

  const applyConsumableRef = useRef((_result: IncursionConsumableUseResult) => {});
  applyConsumableRef.current = (result: IncursionConsumableUseResult) => {
    if (!canPlayerCommand()) return;
    const apCost = result.apCost ?? COMBAT_CONSUMABLE_AP_COST;
    if (playerApRef.current < apCost) {
      log('[REJECTED] >> Insufficient action points for cargo deploy.');
      return;
    }
    let healAmt = Math.floor(result.healAmount * mutationModsRef.current.healMultiplier);
    if (result.clearSupportedPlayerDebuffs) {
      const clearable = new Set(['BLEEDING', 'FRACTURED', 'ROOTED', 'SEARING', 'HEXED', 'ECHO_DEBUFF']);
      const before = sessionExtrasRef.current.structuredDebuffs.length;
      sessionExtrasRef.current.structuredDebuffs = sessionExtrasRef.current.structuredDebuffs.filter(
        (d) => !clearable.has(d.type),
      );
      sessionExtrasRef.current.playerDebuffs = sessionExtrasRef.current.structuredDebuffs.map((d) => d.type);
      const cleared = before - sessionExtrasRef.current.structuredDebuffs.length;
      if (cleared > 0) {
        healAmt = Math.floor(maxSoulAnchor * 0.05 * cleared * mutationModsRef.current.healMultiplier);
        log(`>> TRAUMA PATCH — purged ${cleared} debuff(s).`);
      }
    }
    if (healAmt > 0) applyHealRef.current(healAmt);
    if (result.stunsEnemy) applyVeilShardFracture();
    if (result.shatterKineticArmor) {
      const targetId = selectedTargetIdRef.current ?? primaryAliveUnit(squadRef.current)?.unitId;
      const unit = targetId ? getUnitById(squadRef.current, targetId) : null;
      if (unit?.unitId) {
        const stripResult = stripKineticArmor(unit, result.shatterKineticArmor, {
          applyExposed: Boolean(result.applyExposed),
        });
        patchUnit(unit.unitId, stripResult.enemy);
        stripResult.logLines.forEach((line) => log(line));
        if (stripResult.broke) {
          pushDefenseBreakFloat(unit.unitId, 'armor');
        }
        if (stripResult.stacksRemoved === 0 && result.misfireStaminaLoss) {
          applyStamina(-result.misfireStaminaLoss);
          log(result.secondaryLogLine ?? '>> GRID-CRACKER MAG // No plating found. Recoil backlash.');
        } else if (
          result.applyExposed
          && stripResult.stacksRemoved >= (result.exposedRequiresArmorStripped ?? 1)
          && !stripResult.enemy.combatTags?.includes('EXPOSED')
        ) {
          const refreshed = getUnitById(squadRef.current, unit.unitId);
          if (refreshed) patchUnit(unit.unitId, addCombatTag(refreshed, 'EXPOSED'));
        }
      }
    }
    if (result.stripOccultWards) {
      const targetId = selectedTargetIdRef.current ?? primaryAliveUnit(squadRef.current)?.unitId;
      const unit = targetId ? getUnitById(squadRef.current, targetId) : null;
      if (unit?.unitId) {
        const stripResult = stripOccultWards(unit, result.stripOccultWards);
        patchUnit(unit.unitId, stripResult.enemy);
        stripResult.logLines.forEach((line) => log(line));
        if (stripResult.broke) {
          pushDefenseBreakFloat(unit.unitId, 'ward');
        }
        if (stripResult.stacksRemoved > 0 && result.frontlineBlindTurns) {
          const blindResult = applyFrontlineBlinded(
            squadRef.current,
            sessionExtrasRef.current,
            result.frontlineBlindTurns,
            { debuffDurationPct: resolvedWeapon?.statModifiers.debuffDurationPct },
          );
          blindResult.logLines.forEach((line) => log(line));
        }
      }
    } else if (result.frontlineBlindTurns && result.frontlineBlindTurns > 0) {
      const blindResult = applyFrontlineBlinded(
        squadRef.current,
        sessionExtrasRef.current,
        result.frontlineBlindTurns,
        { debuffDurationPct: resolvedWeapon?.statModifiers.debuffDurationPct },
      );
      blindResult.logLines.forEach((line) => log(line));
    }
    if (result.clearPlayerDebuffs && result.clearPlayerDebuffs.length > 0) {
      sessionExtrasRef.current.structuredDebuffs = sessionExtrasRef.current.structuredDebuffs.filter(
        (d) => {
          if (d.type !== 'BLEEDING' && d.type !== 'FRACTURED') return true;
          return !result.clearPlayerDebuffs!.includes(d.type);
        },
      );
      sessionExtrasRef.current.playerDebuffs = sessionExtrasRef.current.structuredDebuffs.map((d) => d.type);
    }
    if (result.clearDebuffs) {
      const targetId = selectedTargetIdRef.current ?? primaryAliveUnit(squadRef.current)?.unitId;
      const unit = targetId ? getUnitById(squadRef.current, targetId) : null;
      if (unit?.unitId) {
        patchUnit(unit.unitId, { combatTags: [] });
      }
    }
    if (result.maxAbyssalReserve) {
      abyssalRef.current = mutationModsRef.current.abyssalCap;
      setAbyssalReserve(mutationModsRef.current.abyssalCap);
    }
    if (result.grantBonusAp) {
      combatBuffRef.current.bonusApThisTurn += result.grantBonusAp;
      playerApRef.current += result.grantBonusAp;
      setPlayerActionPoints(playerApRef.current);
    }
    if (result.restoreStaminaPct) {
      applyStamina(Math.floor(maxStamina * (result.restoreStaminaPct / 100)));
    }
    if (result.misfireStaminaLoss && !result.shatterKineticArmor) {
      applyStamina(-result.misfireStaminaLoss);
    }
    if (result.absorbNextHit) {
      mutationEncounterRef.current.spallWeaveActive = true;
      if (result.spallShrapnelDamage) {
        mutationEncounterRef.current.spallShatterPending = result.spallShrapnelDamage;
      }
    }
    if (result.grantTemporaryShield) {
      sessionExtrasRef.current.playerShield += result.grantTemporaryShield;
      sessionExtrasRef.current.playerShieldTurnsRemaining = Math.max(
        sessionExtrasRef.current.playerShieldTurnsRemaining,
        1,
      );
    }
    if (result.applyRootedToUpTo) {
      // Prefer live squad count over engine estimate (RunContext has no squad ref).
      const rootCap = Math.min(2, Math.max(1, result.applyRootedToUpTo));
      const targets = aliveUnits(squadRef.current).slice(0, rootCap);
      targets.forEach((unit) => {
        if (!unit.unitId) return;
        patchUnit(unit.unitId, {
          ...addCombatTag(unit, 'ROOTED'),
          evadeChance: 0,
          evadeActive: false,
          evadeTurnsRemaining: 0,
        });
      });
      if (targets.length > 0) {
        log(`>> RAZORWIRE — ${targets.length} hostile(s) rooted.`);
      }
    }
    if (result.interruptChargingTarget || result.applyFracture) {
      const targetId = selectedTargetIdRef.current ?? primaryAliveUnit(squadRef.current)?.unitId;
      const unit = targetId ? getUnitById(squadRef.current, targetId) : null;
      if (unit?.unitId) {
        const interruptible = enemyIsTelegraphing(unit);
        if (result.interruptChargingTarget && interruptible) {
          const counter = resolveIntentCounterplay({
            intent: unit.intent,
            playerActionTags: ['INTERRUPT', 'FRACTURE'],
            sourceCombatant: unit,
            incomingDamage: unit.baseDamage,
          });
          recordIntentCountered(intentTelemetryRef.current, unit.intent, counter.counterQuality, {
            damagePrevented: counter.reducedDamageAmount,
            appliedFracture: counter.appliedFracture,
          });
          patchUnit(unit.unitId, applyIntentCounterplayToEnemy(unit, {
            ...counter,
            cancelTelegraph: true,
            appliedFracture: true,
          }));
          counter.logMessages.forEach((m) => log(`>> BLACK-IRON WEDGE // ${m}`));
          if (!counter.logMessages.length) {
            log('>> BLACK-IRON WEDGE // Telegraph spike interrupted.');
          }
        } else if (result.applyFracture) {
          patchUnit(unit.unitId, applyFracturedState(unit));
          if (result.interruptChargingTarget) {
            log('>> BLACK-IRON WEDGE // No interrupt window. Partial fracture only.');
          }
        }
      }
    }
    if (result.delayedCylinder) {
      const targetId = selectedTargetIdRef.current ?? primaryAliveUnit(squadRef.current)?.unitId;
      if (targetId) {
        runItemCombatFlagsRef.current.delayedCylinderTargetId = targetId;
        runItemCombatFlagsRef.current.delayedCylinderDamage = 18;
        log('>> RIGGED CYLINDER // Volatile charge armed.');
      }
    }
    if (result.bloodwireLethalPrevention) {
      runItemCombatFlagsRef.current.bloodwireActive = true;
    }
    if (result.nullSpaceUntargetable) {
      runItemCombatFlagsRef.current.nullSpaceActive = true;
      classCombatRef.current.ghostCamoTurnsRemaining = Math.max(
        classCombatRef.current.ghostCamoTurnsRemaining,
        1,
      );
    }
    if (result.voidglassDecoy) {
      runItemCombatFlagsRef.current.voidglassDecoyActive = true;
      log('>> VOIDGLASS DECOY // False body projected.');
    }
    if (result.mirrorSaltEcho) {
      const lastAbility = lastPlayerAbilityRef.current;
      if (lastAbility && lastAbility !== 'EVISCERATE' && lastAbility !== 'DEVASTATE') {
        // Half-power kinetic poke fallback — full ability echo lands in Phase D polish.
        const targetId = selectedTargetIdRef.current ?? primaryAliveUnit(squadRef.current)?.unitId;
        if (targetId) {
          hurtEnemy(12, '[MIRROR-SALT]', 'STRIKE', {
            channel: 'OCCULT',
            rollCrit: false,
            targetId,
          });
          log(`>> MIRROR-SALT // Echo of ${lastAbility} at half-density.`);
        }
      } else {
        log('>> MIRROR-SALT // No valid offensive ability to echo.');
      }
      if (result.misfireStaminaLoss) applyStamina(-result.misfireStaminaLoss);
    }
    if (result.staminaLossNextTurn) {
      runItemCombatFlagsRef.current.staminaLossNextTurn = result.staminaLossNextTurn;
    }
    if (result.enableGodMode) {
      godModeRef.current = true;
      applyGodModeResources();
    }
    if (result.enableFullCrit) {
      fullCritRef.current = true;
    }
    if (result.setSoulAnchorTo != null) {
      const nextHp = Math.max(1, Math.min(result.setSoulAnchorTo, getEffectiveMaxSoulAnchor()));
      operativeHpRef.current = nextHp;
      setOperativeHp(nextHp);
    }
    log(result.logLine);
    if (result.secondaryLogLine) log(`>> ${result.secondaryLogLine}`);
    playerApRef.current = Math.max(0, playerApRef.current - apCost);
    setPlayerActionPoints(playerApRef.current);
    setSelectedAbility(null);
    publishSquadUi(squadRef.current);
  };

  useEffect(() => {
    registerConsumableHandler?.((result) => applyConsumableRef.current(result));
  }, [registerConsumableHandler]);

  useEffect(() => {
    registerCanDeployCargoHandler?.((itemId: CargoItemId) => {
      const runItemId = tryNormalizeRunItemId(itemId);
      const fromRunSlot = runItemId != null
        && getRunItemInCombatSlot(activeIncursionRefLocal.current.runItems, runItemId) != null;
      const apNeeded = fromRunSlot ? 0 : combatConsumableApCost(itemId);
      return canPlayerCommand() && playerApRef.current >= apNeeded;
    });
  }, [registerCanDeployCargoHandler]);

  useEffect(() => {
    registerTargetHandler?.(selectTarget);
  }, [registerTargetHandler, selectTarget]);

  useEffect(() => {
    registerIntelTargetHandler?.(focusIntelTarget);
  }, [registerIntelTargetHandler, focusIntelTarget]);

  const resolveIncomingHpStrike = (e: EnemyCombatProfile): { raw: number; unblockable: boolean } | null => {
    const effectiveIntent = resolveEffectiveEnemyIntent(e);
    if (getEnemyDeckStrikeVariant(effectiveIntent) !== 'hp') return null;
    if (e.isBoss && bossRuntimeRef.current) {
      const dmg = bossStrikeDamage(bossRuntimeRef.current, bossPhaseRef.current);
      if (e.intent === 'OVERDRIVE_DISCHARGE') {
        return { raw: dmg, unblockable: !counterRef.current };
      }
      return { raw: dmg, unblockable: false };
    }
    const { dmg, unblockable } = attackDmg(e);
    return { raw: dmg, unblockable: e.intent === 'WORLD_ENDER' ? true : unblockable };
  };

  const applyHpStrikeOnDeckImpact = (e: EnemyCombatProfile) => {
    const strike = resolveIncomingHpStrike(e);
    if (!strike || strike.raw <= 0) return;
    if (
      voidWardPrimedRef.current
      && cycleRef.current === 'TEXT_COMBAT'
      && openParryWindow(e, true)
    ) {
      return;
    }
    let dmg = strike.raw;
    if (!strike.unblockable && combatBuffRef.current.ashenMantleTurnsRemaining > 0) {
      dmg = Math.floor(dmg * (1 - COMBAT_ACTION.ABYSSAL_WARD_BLOCK_PCT));
      const attacker = enemyRef.current;
      if (attacker) markAttackerDoomed(attacker);
    }
    if (dmg <= 0) return;
    preAppliedHpStrikeRef.current = dmg;
    pendingDmgRef.current = dmg;
    pendingUnblockRef.current = strike.unblockable;
    // Hit SFX + haptic at the lunge / attack peak (not when HP is committed later).
    Vibration.vibrate([0, 32, 48, 28]);
    playCombatPresentationCue('sfx.player.impact');
  };

  const commitPendingPlayerDamage = (unblockable = false, msg?: string, attacker?: EnemyCombatProfile) => {
    const pending = preAppliedHpStrikeRef.current > 0
      ? preAppliedHpStrikeRef.current
      : pendingDmgRef.current;
    if (pending <= 0) return false;
    preAppliedHpStrikeRef.current = 0;
    hurtPlayer(pending, unblockable || pendingUnblockRef.current, msg, {
      skipStrikeFx: true,
      skipImpactSfx: true,
      attacker: attacker ?? enemyRef.current ?? undefined,
    });
    return true;
  };

  const hurtPlayer = (
    raw: number,
    unblockable = false,
    msg?: string,
    options?: {
      skipStrikeFx?: boolean;
      /** Impact SFX already played at enemy attack peak — don't replay on HP commit. */
      skipImpactSfx?: boolean;
      attacker?: EnemyCombatProfile;
      rollEvade?: boolean;
      rollCrit?: boolean;
    },
  ) => {
    if (godModeRef.current) return;
    if (options?.attacker && raw > 0) {
      const sev = getIntentSeverity(options.attacker.intent);
      recordIntentResolved(intentTelemetryRef.current, options.attacker.intent, {
        damageDealt: raw,
        wasIgnoredHigh: sev === 'HIGH' || sev === 'CRITICAL',
      });
    }
    if (
      isGhostCamoBlockingAttacks(classCombatRef.current)
      && raw > 0
      && options?.attacker
    ) {
      log('[GHOST-GRID CAMO] >> Operative phased — attack whiffed.');
      return;
    }
    if (mutationEncounterRef.current.spallWeaveActive && raw > 0) {
      mutationEncounterRef.current.spallWeaveActive = false;
      const shrapnel = mutationEncounterRef.current.spallShatterPending;
      mutationEncounterRef.current.spallShatterPending = 0;
      log('[SPALL-WEAVE] >> Vest absorbed incoming damage.');
      if (shrapnel > 0 && options?.attacker?.unitId) {
        hurtEnemy(shrapnel, '[SPALL SHRAPNEL]', 'STRIKE', {
          channel: 'KINETIC',
          rollCrit: false,
          targetId: options.attacker.unitId,
        });
        log('>> SPALL-WEAVE VEST // Mesh ruptured. Shrapnel returned.');
      }
      return;
    }
    if (runItemCombatFlagsRef.current.voidglassDecoyActive && raw > 0 && options?.attacker) {
      runItemCombatFlagsRef.current.voidglassDecoyActive = false;
      log('>> VOIDGLASS DECOY // Decoy shattered. Hostile intent refracted.');
      return;
    }
    if (runItemCombatFlagsRef.current.nullSpaceActive && raw > 0 && options?.attacker) {
      runItemCombatFlagsRef.current.nullSpaceActive = false;
      classCombatRef.current.ghostCamoTurnsRemaining = 0;
      applyStamina(-staminaRef.current);
      log('>> NULL-SPACE INJECTOR // Spatial re-entry exhausted stamina.');
      return;
    }
    if (
      operativeClass === 'ENVOY'
      && riftWardReadyRef.current
      && raw > 0
      && options?.attacker?.unitId
    ) {
      const wardBoonCtx = {
        boons: envoyBoons,
        log,
        applyVeilFlux,
        refundAp: (amount = 1) => {
          playerApRef.current += amount;
          setPlayerActionPoints(playerApRef.current);
        },
        grantEvadeBonus: (stacks: number) => {
          combatChanceRef.current.gridGhostEvadeStacks = Math.min(
            3,
            combatChanceRef.current.gridGhostEvadeStacks + stacks,
          );
        },
      };
      if (unblockable) {
        riftWardReadyRef.current = false;
        runEnvoyRiftWardTriggerBoons(wardBoonCtx);
        return;
      }
      riftWardReadyRef.current = false;
      runEnvoyRiftWardTriggerBoons(wardBoonCtx);
      const reflect = Math.floor(raw * 0.5);
      if (reflect > 0) {
        hurtEnemy(reflect, '[RIFT-WARD]', 'STRIKE', {
          channel: 'OCCULT',
          rollCrit: false,
          targetId: options.attacker.unitId,
        });
      }
      applyVeilFlux(15);
      runEnvoyRiftWardSuccessBoons(wardBoonCtx);
      log('[RIFT-WARD] >> Intrinsic ward flares — hit absorbed, pain mirrored.');
      return;
    }
    if (mutationEncounterRef.current.juggernautShield && raw > 0) {
      mutationEncounterRef.current.juggernautShield = false;
      log('[JUGGERNAUT PLATING] >> Shadow Step shield absorbed the hit.');
      return;
    }
    let dmg = raw;
    const objectiveMitigation = getIncomingDamageMitigationFromStamp(env.encounterObjective);
    const directorMitigation = env.directorIncomingMitigationPct ?? 0;
    const totalMitigation = Math.min(35, objectiveMitigation + directorMitigation);
    if (totalMitigation > 0 && dmg > 0) {
      dmg = Math.max(1, Math.floor(dmg * (1 - totalMitigation / 100)));
    }
    if (
      options?.attacker
      && hasStructuredDebuff(sessionExtrasRef.current, 'TARGET_LOCKED')
      && raw > 0
    ) {
      const tier = resolveEnemyThreatTier(options.attacker);
      const heavyHit = isHeavyArchetype(options.attacker.rosterId) || tier === 'ELITE' || tier === 'APEX';
      if (heavyHit) {
        dmg = applyCritMultiplier(dmg, COMBAT_CHANCE.CRIT_DAMAGE_MULTIPLIER);
        removeStructuredDebuff(sessionExtrasRef.current, 'TARGET_LOCKED');
        log(`[TARGET LOCKED] >> Heavy strike — critical hit for ${dmg}.`);
      }
    }
    const extras = sessionExtrasRef.current;
    if (
      operativeClass === 'ENVOY'
      && classBoonEncounterRef.current.deepReservesShieldActive
      && dmg > 0
    ) {
      classBoonEncounterRef.current.deepReservesShieldActive = false;
      log('[DEEP RESERVES] >> Kinetic shield absorbs the hit.');
      return;
    }
    if (extras.playerShield > 0 && dmg > 0) {
      const absorbed = Math.min(extras.playerShield, dmg);
      extras.playerShield -= absorbed;
      dmg -= absorbed;
      log(`[SHIELD] >> ${absorbed} damage absorbed (${extras.playerShield} remaining).`);
    }
    if (playerKineticArmorBonus > 0 && dmg > 0) {
      const beforeArmor = dmg;
      dmg = mitigatePlayerKineticArmorBonus(dmg, playerKineticArmorBonus);
      const absorbed = beforeArmor - dmg;
      if (absorbed > 0) {
        log(`[KINETIC ARMOR] >> ${absorbed} absorbed (${playerKineticArmorBonus} layer${playerKineticArmorBonus === 1 ? '' : 's'}).`);
      }
    }
    const envoyBulwarkArmor = operativeClass === 'ENVOY'
      ? resolveEnvoyAethericBulwarkArmor(
        envoyBoons,
        envoyBoonModsRef.current,
        veilFluxRef.current,
        envoyCombatStateRef.current.fluxMaxCap,
      )
      : 0;
    if (envoyBulwarkArmor > 0 && dmg > 0) {
      const beforeArmor = dmg;
      dmg = mitigatePlayerKineticArmorBonus(dmg, envoyBulwarkArmor);
      const absorbed = beforeArmor - dmg;
      if (absorbed > 0) {
        log(`[AETHERIC BULWARK] >> ${absorbed} absorbed (${envoyBulwarkArmor} flux-forged layer${envoyBulwarkArmor === 1 ? '' : 's'}).`);
      }
    }
    if (
      !unblockable
      && combatBuffRef.current.ashenMantleTurnsRemaining > 0
      && !bloodBoundCarapaceRef.current
    ) {
      const beforeMantle = dmg;
      dmg = Math.floor(dmg * (1 - COMBAT_ACTION.ABYSSAL_WARD_BLOCK_PCT));
      const blocked = beforeMantle - dmg;
      if (blocked > 0) {
        mutationEncounterRef.current.spallShatterPending += blocked;
      }
      if (options?.attacker) markAttackerDoomed(options.attacker);
    }
    const chanceState = combatChanceRef.current;
    if (
      raw > 0
      && options?.rollEvade !== false
      && options?.attacker
    ) {
      const hit = resolveEnemyAttackHit(
        {
          shadowStepEvadeActive: chanceState.shadowStepEvadeActive,
          gridGhostEvadeStacks: chanceState.gridGhostEvadeStacks,
          momentumShiftEvadeDisabled: chanceState.momentumShiftEvadeDisabled,
        },
        { attacker: options.attacker },
      );
      if (hit.evaded) {
        emitCombatFeedback({ kind: 'PLAYER_EVADE' });
        playerViewportRef?.current?.triggerEvadeAfterimage();
        log(msg?.replace(/— \d+.*/, '') ?? `>> ${options.attacker.designation} STRIKES — [ MISS ]`);
        log('[EVADE] >> Operative afterimage — attack whiffed.');
        if (resolvedWeapon?.familyId === 'aegis-rift-edge') {
          weaponRuntimeRef.current = armRiftEdgeTempo(weaponRuntimeRef.current);
          log('[RIFT EDGE] >> Tempo armed — next basic carries Occult rider.');
        }
        if (hasMutation(leyLineMutations, 'GRID_GHOST')) {
          runOnEvadeSuccess(buildAegisBoonHookCtx());
        }
        runEnvoyEvadeSuccessBoons(envoyBoons, log, (amount = 1) => {
          playerApRef.current += amount;
          setPlayerActionPoints(playerApRef.current);
        });
        return;
      }
      if (options.rollCrit !== false && hit.critical) {
        dmg = applyCritMultiplier(dmg, hit.critMultiplier);
        emitCombatFeedback({ kind: 'ENEMY_CRIT' });
        playerViewportRef?.current?.triggerEnemyCritVignette();
        log(`[CRITICAL WOUND] >> ${options.attacker.designation} — ${dmg} damage.`);
      } else {
        log(msg ?? `>> ENEMY STRIKE — ${dmg} DAMAGE DEALT`);
      }
    } else {
      log(msg ?? `>> ENEMY STRIKE — ${dmg} DAMAGE DEALT`);
    }
    if (dmg > 0) {
      if (
        bloodBoundCarapaceRef.current
        && options?.attacker?.unitId
      ) {
        const attacker = options.attacker;
        const attackerId = attacker.unitId;
        if (attackerId) {
          hurtEnemy(dmg, '[CARAPACE SPIKE]', 'STRIKE', {
            channel: 'TRUE',
            abilityId: 'BLOOD_BOUND_CARAPACE',
            rollCrit: false,
            targetId: attackerId,
          });
          const refreshed = getUnitById(squadRef.current, attackerId);
          if (refreshed?.unitId) {
            patchUnit(attackerId, applyFracturedState(refreshed));
          }
          log(`>> [BLOOD-BOUND CARAPACE] — ${dmg} True reflected, attacker Fractured.`);
        }
      }
      if (
        hasStructuredDebuff(sessionExtrasRef.current, 'SEARING')
        && options?.attacker?.rosterId !== 'splinter'
      ) {
        const splinter = aliveUnits(squadRef.current).find((u) => u.rosterId === 'splinter');
        const searingMult = splinter
          ? getAlphaMechanic(splinter, 'searingDamageMultiplier', 1)
          : 1;
        if (searingMult > 1) {
          const extra = Math.floor(dmg * (searingMult - 1));
          dmg += extra;
          log(`[SEARING] >> Damage tripled — +${extra} damage.`);
        } else {
          dmg += 8;
          log('[SEARING] >> Secondary burst — +8 damage.');
        }
      }
      if (!options?.skipImpactSfx) {
        Vibration.vibrate([0, 32, 48, 28]);
        playCombatPresentationCue('sfx.player.impact');
      }
      if (!options?.skipStrikeFx) {
        playerViewportRef?.current?.triggerDamageEffect('hp');
      }
    }
    mutationEncounterRef.current.damageTakenThisTurn = dmg > 0;
    if (
      dmg > 0
      && hasMutation(leyLineMutations, 'ADRENALINE_SPIKE')
      && !mutationEncounterRef.current.adrenalineSpikeUsed
    ) {
      mutationEncounterRef.current.adrenalineSpikeUsed = true;
      playerApRef.current += 1;
      setPlayerActionPoints(playerApRef.current);
      log('[ADRENALINE SPIKE] >> Damage taken — +1 AP refunded.');
    }
    runClassTakeDamageBoons({
      hexBoons: hexShotBoons,
      envoyBoons,
      damageDealt: dmg,
      log,
      applyVeilFlux,
      grantReactiveCamo: () => {
        if (classCombatRef.current.reactiveCamoUsed) return false;
        classCombatRef.current.reactiveCamoUsed = true;
        classCombatRef.current.ghostCamoTurnsRemaining = 1;
        return true;
      },
    });
    if (dmg > 0 && classCombatRef.current.soulTetherUnitId) {
      const tetherId = classCombatRef.current.soulTetherUnitId;
      classCombatRef.current.soulTetherUnitId = null;
      const mirror = Math.floor(dmg * 0.5);
      if (mirror > 0) {
        hurtEnemy(mirror, '[SOUL-TETHER]', 'STRIKE', {
          channel: 'TRUE',
          targetId: tetherId,
          rollCrit: false,
        });
        log(`[SOUL-TETHER] >> ${mirror} True pain mirrored to tether.`);
      }
    }
    setOperativeHp((p) => {
      let incoming = dmg;
      if (
        runItemCombatFlagsRef.current.bloodwireActive
        && !runItemCombatFlagsRef.current.bloodwireSpent
        && p - incoming <= 0
        && incoming > 0
      ) {
        runItemCombatFlagsRef.current.bloodwireActive = false;
        runItemCombatFlagsRef.current.bloodwireSpent = true;
        runItemCombatFlagsRef.current.healingReceivedPenaltyPct = 25;
        addStructuredDebuff(sessionExtrasRef.current, {
          type: 'BLEEDING',
          amount: 2,
          turnsRemaining: 99,
        });
        log('>> BLOODWIRE TOURNIQUET // Lethal threshold denied.');
        log('>> BLOODWIRE TOURNIQUET // Circulation debt applied.');
        incoming = Math.max(0, p - 1);
      }
      const n = Math.max(p - incoming, 0);
      const taken = Math.max(0, p - n);
      if (taken > 0) balanceEncounterRef.current.damageTaken += taken;
      operativeHpRef.current = n;
      if (n <= 0 && options?.attacker?.designation) {
        onLethalEnemyStrike?.(options.attacker.designation);
      }
      if (
        n > 0
        && n / maxSoulAnchor <= 0.1
        && hasMutation(leyLineMutations, 'SECOND_WIND')
        && !mutationEncounterRef.current.secondWindUsed
      ) {
        mutationEncounterRef.current.secondWindUsed = true;
        if (operativeClass === 'AEGIS') {
          const cap = mutationModsRef.current.abyssalCap;
          abyssalRef.current = cap;
          setAbyssalReserve(cap);
          log('[SECOND WIND] >> Emergency surge — Abyssal Reserve filled, +2 AP.');
        } else {
          applyStamina(maxStamina);
          log('[SECOND WIND] >> Emergency surge — stamina and AP restored.');
        }
        combatBuffRef.current.bonusApThisTurn += 2;
        playerApRef.current += 2;
        setPlayerActionPoints(playerApRef.current);
      }
      if (n <= 0) resolve(false);
      return n;
    });
  };

  /** Debounce so multi-hit ultimates only snap the attack pose once. */
  const lastPlayerAttackPoseAtRef = useRef(0);
  const triggerPlayerAttackPose = (target?: { gridSlot?: string | null } | null) => {
    const now = Date.now();
    if (now - lastPlayerAttackPoseAtRef.current < 200) return;
    lastPlayerAttackPoseAtRef.current = now;
    if (operativeClass === 'AEGIS') {
      const targetSlot = (target?.gridSlot
        ?? getUnitById(squadRef.current, selectedTargetIdRef.current ?? '')?.gridSlot
        ?? enemyRef.current?.gridSlot
        ?? 'FL_0') as CombatGridSlotId;
      const arenaHeight = Math.max(windowHeight * 0.52, 200);
      const lungeDelta = playerAttackLungeDelta(
        targetSlot,
        arenaLayoutModeRef.current,
        width,
        arenaHeight,
        arenaGridVariant,
      );
      playerViewportRef?.current?.triggerAttackLunge(lungeDelta);
    } else {
      playerViewportRef?.current?.triggerRangedAttack();
    }
  };

  const hurtEnemy = (
    raw: number,
    tag: string,
    source?: KineticDamageSource,
    options?: {
      channel?: 'KINETIC' | 'OCCULT' | 'TRUE';
      fractureGain?: number;
      targetId?: string;
      abilityId?: string;
      abilityTags?: readonly string[];
      /** Nested result source (e.g. RIPOSTE cash-out tag) — ownership uses playerActionKind. */
      actionKind?: string;
      /** Player-intent card that owns presentation (STRIKE owns Warden even with Riposte). */
      playerActionKind?: string;
      playerActionId?: string;
      /** Nested secondary damage — must not start another Warden approach. */
      nestedPresentation?: boolean;
      /** Defaults to !indirectDamage. */
      isDirectDamage?: boolean;
      rollCrit?: boolean;
      echoHit?: boolean;
      /** Burn/bleed/DoT — skip operative attack pose; still flash the damaged unit. */
      indirectDamage?: boolean;
      ignoreDefenses?: boolean;
      /** When false, skip enemy evade rolls (ABYSSAL VERDICT cannot be evaded). */
      rollEvade?: boolean;
      /** Floor for Kinetic Armor strip (Nullbreach innate pressure). */
      innateArmorPressureLayers?: number;
      /**
       * ABYSSAL VERDICT cinematic — apply HP now, hold HUD / floats / death
       * until the named IMPACT beat.
       */
      deferAbyssalVerdict?: boolean;
    },
  ): boolean => {
    // Hex Shot trap / overwatch damage is never a weapon attack presentation.
    if (
      operativeClass === 'HEX_SHOT'
      && options
      && !options.indirectDamage
      && (
        options.abilityId === 'RIFT_SNARE'
        || options.abilityId === 'PANOPTICON_PROTOCOL'
      )
    ) {
      options = { ...options, indirectDamage: true };
    }
    const rawTargetId = options?.targetId
      ?? selectedTargetIdRef.current
      ?? primaryAliveUnit(squadRef.current)?.unitId;
    const interceptAbility = options?.abilityId ?? 'STRIKE';
    const targetId = rawTargetId
      ? resolveClassWardenInterceptTarget(
        squadRef.current,
        operativeClass,
        String(interceptAbility),
        rawTargetId,
      )
      : rawTargetId;
    const e = targetId
      ? getUnitById(squadRef.current, targetId)
      : enemyRef.current;
    if (!e || !e.unitId) return false;
    if (
      rawTargetId
      && targetId
      && rawTargetId !== targetId
      && e.rosterId === 'warden'
    ) {
      log(`${tag} >> WARDEN INTERCEPT — backline strike redirected.`);
    }
    const godModeAttack = Boolean(
      godModeRef.current
      && isPlayerTurnRef.current
      && source
      && source !== 'COUNTER'
      && !options?.echoHit
      && !options?.indirectDamage,
    );
    if (godModeAttack) {
      raw = GOD_MODE_STRIKE_DAMAGE;
      options = {
        ...options,
        channel: 'TRUE',
        ignoreDefenses: true,
        rollCrit: false,
      };
    }
    const shroudMissChance = env.eliteModifier === 'PHASE_SHROUD' ? 0.25 : 0.2;
    if (!godModeAttack && env.isEnemyPhaseShrouded && Math.random() < shroudMissChance) {
      log(`${tag} >> PHASE SHROUD — ATTACK WHIFFED (${Math.round(shroudMissChance * 100)}% miss).`);
      return false;
    }
    if (
      !godModeAttack
      && e.isUntargetable
      && options?.channel !== 'OCCULT'
      && options?.channel !== 'TRUE'
    ) {
      log(`${tag} >> PHASED — ${e.designation} cannot be targeted by physical channel.`);
      return false;
    }
    if (!godModeAttack && (e.veilBarrierCharges ?? 0) > 0 && raw > 0) {
      const nextCharges = (e.veilBarrierCharges ?? 0) - 1;
      patchUnit(e.unitId, {
        veilBarrierCharges: nextCharges > 0 ? nextCharges : undefined,
      });
      log(`${tag} >> VEIL BARRIER — hit absorbed (${nextCharges} charge${nextCharges === 1 ? '' : 's'} left).`);
      publishSquadUi(squadRef.current);
      return false;
    }
    if (!godModeAttack && (e.rivalWardCharges ?? 0) > 0 && raw > 0) {
      const ward = tryAbsorbRivalBindingWard(e, raw, source);
      if (ward.absorbed) {
        if (ward.logLine) log(`${tag} ${ward.logLine}`);
        patchUnit(e.unitId, rivalWardBreakPatch(e, ward.lightBreak));
        publishSquadUi(squadRef.current);
        return false;
      }
    }
    let working = e;
    if (!options?.nestedPresentation && !isWardenStrikeInputGuarded()) {
      wardenDefenseMaterialRef.current = 'NONE';
      wardenFractureAppliedRef.current = false;
    }
    if (source && resolvedWeapon && operativeClass === 'HEX_SHOT') {
      const pierce = resolveWeaponArmorPressureLayers(
        resolvedWeapon.familyId,
        resolvedWeapon.statModifiers,
        options?.innateArmorPressureLayers ?? 0,
      );
      if (pierce > 0) {
        working = applyWeaponArmorPierceToTarget(working, pierce);
      }
    }
    let critical = false;
    let ignoreDefenses = options?.ignoreDefenses ?? false;
    // Phase 1 — ability tags strip defense stacks (break → Fracture).
    if (source && options?.abilityId && raw > 0) {
      const abilityTags = resolveAbilityDefenseTags(
        operativeClass,
        options.abilityId,
      );
      if (abilityTags.armorBreak > 0) {
        const beforeKa = working.kineticArmor ?? 0;
        const strip = stripKineticArmor(working, abilityTags.armorBreak);
        working = strip.enemy;
        strip.logLines.forEach((line) => log(line));
        const removed = Math.max(0, beforeKa - (working.kineticArmor ?? 0));
        if (removed > 0) {
          classLoopTelemetryRef.current.armorStacksRemoved += removed;
          emitJuice(strip.broke ? 'ARMOR_BREAK' : 'ARMOR_HIT', {
            targetCombatantIds: working.unitId ? [working.unitId] : undefined,
            text: strip.broke ? 'Kinetic Armor broken' : 'Kinetic Armor hit',
          });
          if (strip.broke && working.unitId) {
            const mayOwnWarden = shouldUseWardenStrikePresentation({
              weaponFamilyId: resolvedWeapon?.familyId,
              abilityId: options?.abilityId,
              actionKind: options?.actionKind,
              playerActionKind: options?.playerActionKind,
              nestedPresentation: options?.nestedPresentation,
            }) && !options?.indirectDamage && !options?.echoHit;
            if (mayOwnWarden) {
              wardenDefenseMaterialRef.current = 'KINETIC_ARMOR';
              // Defer ARMOR BROKEN until owning presentation contact (no stale latch on miss).
              wardenPendingDefenseFloatRef.current = {
                presentationId: `pending-${working.unitId}`,
                resolvedResultId: `pending-${working.unitId}`,
                unitId: working.unitId,
                kind: 'armor',
              };
            } else {
              pushDefenseBreakFloat(working.unitId, 'armor');
            }
          }
          if (strip.appliedFracture) {
            emitJuice('FRACTURE_APPLIED', {
              targetCombatantIds: working.unitId ? [working.unitId] : undefined,
              text: 'Fracture applied',
            });
          }
          if (operativeClass === 'HEX_SHOT') {
            log('[HEX SHOT] >> Correct Round — Kinetic Armor cracked.');
            emitJuice('HEX_CORRECT_ROUND', { text: 'Correct Round — Armor' });
          }
        }
      }
      if (abilityTags.wardBreak > 0) {
        const beforeOw = working.occultWards ?? 0;
        const strip = stripOccultWards(working, abilityTags.wardBreak);
        working = strip.enemy;
        strip.logLines.forEach((line) => log(line));
        const removed = Math.max(0, beforeOw - (working.occultWards ?? 0));
        if (removed > 0) {
          classLoopTelemetryRef.current.wardStacksRemoved += removed;
          classLoopTelemetryRef.current.wardsBroken += removed;
          emitJuice(strip.broke ? 'WARD_BREAK' : 'WARD_HIT', {
            targetCombatantIds: working.unitId ? [working.unitId] : undefined,
            text: strip.broke ? 'Occult Ward broken' : 'Occult Ward hit',
          });
          if (strip.broke && working.unitId) {
            const mayOwnWarden = shouldUseWardenStrikePresentation({
              weaponFamilyId: resolvedWeapon?.familyId,
              abilityId: options?.abilityId,
              actionKind: options?.actionKind,
              playerActionKind: options?.playerActionKind,
              nestedPresentation: options?.nestedPresentation,
            }) && !options?.indirectDamage && !options?.echoHit;
            if (mayOwnWarden) {
              wardenDefenseMaterialRef.current = 'OCCULT_WARD';
              wardenPendingDefenseFloatRef.current = {
                presentationId: `pending-${working.unitId}`,
                resolvedResultId: `pending-${working.unitId}`,
                unitId: working.unitId,
                kind: 'ward',
              };
            } else {
              pushDefenseBreakFloat(working.unitId, 'ward');
            }
          }
          if (strip.appliedFracture) {
            emitJuice('FRACTURE_APPLIED', {
              targetCombatantIds: working.unitId ? [working.unitId] : undefined,
              text: 'Fracture applied',
            });
          }
          if (operativeClass === 'ENVOY') {
            log('[ENVOY] >> Ward Collapse — Occult Wards broken.');
          }
          if (operativeClass === 'HEX_SHOT') {
            log('[HEX SHOT] >> Null Round — Occult Wards cracked.');
            emitJuice('HEX_CORRECT_ROUND', { text: 'Correct Round — Ward' });
          }
        }
      }
      if (abilityTags.armorPierce || abilityTags.wardPierce) {
        ignoreDefenses = true;
      }
    }
    let hexForceCrit = false;
    if (operativeClass === 'HEX_SHOT' && source && !options?.echoHit) {
      const hexAbilityId = (options?.abilityId ?? lastPlayerAbilityRef.current) as HexShotAbilityId | null;
      if (hexAbilityId) {
        const critOverrides = getHexShotCritOverrides(
          hexShotBoons,
          hexAbilityId,
          working,
          classBoonEncounterRef.current,
          hexShotStateRef.current.currentAmmoType,
        );
        hexForceCrit = critOverrides.forceCrit;
        if (critOverrides.ignoreDefenses) ignoreDefenses = true;
      }
    }
    const hexOverchargeMult = operativeClass === 'HEX_SHOT'
      ? hexShotStateRef.current.overchargeMultiplier
      : 0;
    const hexAbilityForOvercharge = (options?.abilityId ?? lastPlayerAbilityRef.current) as HexShotAbilityId | null;
    const hexOverchargedStrike = hexOverchargeMult > 0
      && Boolean(source)
      && source !== 'COUNTER'
      && !options?.echoHit
      && hexAbilityForOvercharge != null
      && abilityUsesBallisticTags(hexAbilityForOvercharge);
    const narrativeOvercharged = Boolean(
      source && sessionExtrasRef.current.overchargedActive,
    );
    const bypassAllMitigation = narrativeOvercharged || godModeAttack;
    // --- Hex Shot ammo-type effect (v1) ---
    let hexAmmoResult: HexAmmoEffectResult | null = null;
    let hexAmmoFirstShotPenalty = false;
    if (operativeClass === 'HEX_SHOT' && source && source !== 'COUNTER' && !options?.echoHit && working.unitId) {
      const hexAmmoAbilityId = (options?.abilityId ?? lastPlayerAbilityRef.current) as HexShotAbilityId | null;
      if (hexAmmoAbilityId && abilityUsesBallisticTags(hexAmmoAbilityId)) {
        const hexAmmoTags = getHexShotAbilityTags(hexAmmoAbilityId);
        const isFirstBallisticHit = hexAmmoHitIndexRef.current === 0;
        hexAmmoFirstShotPenalty = isFirstBallisticHit && hexShotStateRef.current.firstShotPenaltyPending;
        hexAmmoResult = applyHexAmmoEffect({
          ammoType: hexShotStateRef.current.currentAmmoType,
          isHeavyShot: hexAmmoTags.includes('ARMOR_PIERCE'),
          hitIndex: hexAmmoHitIndexRef.current,
          isBackline: working.gridSlot?.startsWith('BL') ?? false,
          isBoss: working.isBoss === true,
          targetId: working.unitId,
          targetHasKineticArmor: (working.kineticArmor ?? 0) > 0,
          targetHasOccultWard: (working.occultWards ?? 0) > 0,
          targetHasVoidMark: classBoonEncounterRef.current.voidMarkedUnits[working.unitId] === true,
          targetTelegraphing: enemyIsTelegraphing(working),
          overcharged: isFirstBallisticHit && hexShotStateRef.current.nextShotOvercharged,
          boonSilverDiscipline: hasHexShotBoon(hexShotBoons, 'SILVER_DISCIPLINE'),
          boonWraithglassEtching: hasHexShotBoon(hexShotBoons, 'WRAITHGLASS_ETCHING'),
          boonColdChamber: hasHexShotBoon(hexShotBoons, 'COLD_CHAMBER'),
          tracker: hexAmmoCastTrackerRef.current,
        });
        hexAmmoHitIndexRef.current += 1;
      }
    }
    if (hexForceCrit) {
      critical = true;
      ignoreDefenses = true;
    } else if (source && source !== 'COUNTER' && !options?.echoHit && options?.rollCrit !== false) {
      const skipEvade = options?.rollEvade === false || options?.deferAbyssalVerdict === true;
      const hit = resolvePlayerAttackHit(
        {
          defender: working,
          bypassPostureEvade: bypassAllMitigation || skipEvade,
          bypassAllEvade: skipEvade,
        },
        {
          abilityId: options?.abilityId,
          target: working,
          factionCritBonus: effectiveCritBonus + (
            operativeClass === 'HEX_SHOT'
            && hasHexShotBoon(hexShotBoons, 'DEAD_EYE')
            && currentAmmoRef.current >= maxAmmo
              ? hexShotBoonModsRef.current.ballisticCritBonusFullMag
              : 0
          ) + (
            operativeClass === 'AEGIS'
            && options?.abilityId === 'VEIL_PIERCER'
              ? (getAbilityDefinition('VEIL_PIERCER').critBonusPct ?? 0)
              : 0
          ) + (
            operativeClass === 'ENVOY'
            && hasEnvoyBoon(envoyBoons, 'OVERLOAD_MASTERY')
            && Math.round(veilFluxRef.current) === 1
              ? 100
              : 0
          ) + (
            fullCritRef.current ? 100 : 0
          ),
          hasShatterPoint: hasMutation(leyLineMutations, 'SHATTER_POINT'),
          guaranteedCrits: combatBuffRef.current.crimsonPactCharges,
        },
      );
      if (hit.evaded) {
        const evadeUnitId = working.unitId!;
        const useWardenStrike = shouldUseWardenStrikePresentation({
          weaponFamilyId: resolvedWeapon?.familyId,
          abilityId: options?.abilityId,
          actionKind: options?.actionKind,
          playerActionKind: options?.playerActionKind,
          nestedPresentation: options?.nestedPresentation,
        }) && !options?.indirectDamage && !options?.echoHit;
        if (useWardenStrike && !isWardenStrikeInputGuarded()) {
          const playerActionId = options?.playerActionId
            ?? wardenPlayerActionIdRef.current
            ?? `pa-warden-${evadeUnitId}-${Date.now()}`;
          wardenPlayerActionIdRef.current = playerActionId;
          const presentationId = `warden-${evadeUnitId}-${Date.now()}`;
          const resolvedResultId = `rr-${presentationId}`;
          if (wardenPendingDefenseFloatRef.current?.unitId === evadeUnitId) {
            // Miss/evade must not publish a prior Armor/Ward latch.
            wardenPendingDefenseFloatRef.current = null;
            clearDefenseBreakFloat(evadeUnitId);
          }
          wardenPendingRevealRef.current = {
            presentationId,
            unitId: evadeUnitId,
            revealHitFlash: false,
            revealEvade: true,
          };
          beginWardenStrikePresentation({
            presentationId,
            resolvedResultId,
            playerActionId,
            sourceActionKind: options?.playerActionKind ?? options?.actionKind ?? 'STRIKE',
            sourceAbilityId: options?.abilityId ?? 'STRIKE',
            resultSource: 'player-action-evade',
            targetId: evadeUnitId,
            damage: 0,
            critical: false,
            killed: false,
            outcome: 'EVADE',
            defenseMaterial: 'NONE',
            fractureApplied: false,
          });
          publishSquadUi(squadRef.current);
          log(`${tag} >> [ EVADED ] — ${working.designation} phased through the strike.`);
          if (
            source
            && options?.abilityId
            && abilityCarriesStrikeTag(operativeClass, options.abilityId)
            && !options?.nestedPresentation
          ) {
            signalRiposteHeld();
          }
          return false;
        }
        // ABYSSAL VERDICT: resolve evade now, reveal EVADED floater / motion at IMPACT pass.
        if (options?.deferAbyssalVerdict) {
          abyssalDeferredOutcomeRef.current = {
            unitId: evadeUnitId,
            evaded: true,
            damageApplied: 0,
            killed: false,
          };
          publishSquadUi(squadRef.current);
          log(`${tag} >> [ EVADED ] — ${working.designation} phased through the strike.`);
          if (
            source
            && options?.abilityId
            && abilityCarriesStrikeTag(operativeClass, options.abilityId)
            && !options?.nestedPresentation
          ) {
            signalRiposteHeld();
          }
          return false;
        }
        evadeImpactSeqRef.current[evadeUnitId] = (evadeImpactSeqRef.current[evadeUnitId] ?? 0) + 1;
        publishSquadUi(squadRef.current);
        apparitionRef?.current?.triggerStatEvade();
        log(`${tag} >> [ EVADED ] — ${working.designation} phased through the strike.`);
        if (
          source
          && options?.abilityId
          && abilityCarriesStrikeTag(operativeClass, options.abilityId)
          && !options?.nestedPresentation
        ) {
          signalRiposteHeld();
        }
        if (
          resolvedWeapon
          && source
          && !options?.indirectDamage
          && !options?.echoHit
          && options?.abilityId !== 'RUIN'
        ) {
          try {
            presentResolvedWeaponHit({
              weaponFamilyId: resolvedWeapon.familyId,
              abilityId: options?.abilityId,
              targetId: evadeUnitId,
              damage: 0,
              critical: false,
              killed: false,
              evaded: true,
              channel: options?.channel === 'OCCULT'
                ? 'OCCULT'
                : options?.channel === 'TRUE'
                  ? 'TRUE'
                  : 'KINETIC',
            });
          } catch {
            // ignore presentation errors
          }
        }
        return false;
      }
      if (hit.ignoreDefenses && combatBuffRef.current.crimsonPactCharges > 0) {
        combatBuffRef.current.crimsonPactCharges -= 1;
        log('[CRIMSON PACT] >> Guaranteed critical hit — defenses ignored.');
      }
      critical = hit.critical;
      ignoreDefenses = hit.ignoreDefenses;
      if (
        critical
        && operativeClass === 'AEGIS'
        && combatBuffRef.current.demonLungCooldown > 0
      ) {
        combatBuffRef.current.demonLungCooldown -= 1;
        log("[DEMON'S LUNG] >> Critical hit — cooldown accelerated.");
      }
    }
    if (
      operativeClass === 'AEGIS'
      && options?.abilityId === 'VEIL_PIERCER'
      && raw > 0
    ) {
      ignoreDefenses = true;
    }
    if (hexOverchargedStrike && raw > 0) {
      ignoreDefenses = true;
    }
    if (narrativeOvercharged) {
      ignoreDefenses = true;
    }
    if (
      hexShotBoonModsRef.current.ballisticArmorPierce > 0
      && options?.abilityId
      && operativeClass === 'HEX_SHOT'
      && boonMatchesHexAction(hexShotBoons, 'DEPLETED_URANIUM_TIPS', options.abilityId)
      && options?.channel === 'KINETIC'
    ) {
      working = {
        ...working,
        kineticArmor: Math.max(0, (working.kineticArmor ?? 0) - hexShotBoonModsRef.current.ballisticArmorPierce),
      };
    }
    if (
      mutationModsRef.current.strikeArmorPierce > 0
      && boonMatchesAction(
        leyLineMutations,
        'SHARPENED',
        (options?.abilityId as AegisAbilityId | undefined) ?? lastAegisAbilityRef(),
      )
      && options?.channel === 'KINETIC'
    ) {
      working = {
        ...working,
        kineticArmor: Math.max(0, (working.kineticArmor ?? 0) - mutationModsRef.current.strikeArmorPierce),
      };
    }
    if (mutationEncounterRef.current.masochistBuff && source) {
      mutationEncounterRef.current.masochistBuff = false;
    }
    const fractureGain = options?.fractureGain ?? 0;
    const scaledFractureGain = fractureGain > 0 && resolvedWeapon && operativeClass === 'AEGIS'
      ? scaleFractureGain(fractureGain, resolvedWeapon.statModifiers)
      : fractureGain;
    const graftPlanForFracture = activeGraftPlanRef.current;
    wardenFractureAppliedRef.current = false;
    if (
      scaledFractureGain > 0
      && (!graftPlanForFracture || graftPlanForFracture.effectiveTags.includes('FRACTURE'))
    ) {
      const gaugeBefore = working.fractureGauge ?? 0;
      const fracturedBefore = isEnemyFractured(working);
      if (willFractureBreak(working, scaledFractureGain) && !fractureBreakUnitIdRef.current) {
        fractureBreakUnitIdRef.current = e.unitId;
        working = applyFractureDamage(working, scaledFractureGain, { deferBreak: true });
        patchUnit(e.unitId, working);
        combatPausedRef.current = true;
        triggerHitstop(200);
        triggerShake('heavy');
        setFractureBreakUnitId(e.unitId);
        log(`>> FRACTURE BREAK — ${working.designation} stagger threshold breached.`);
      } else {
        working = applyFractureDamage(working, scaledFractureGain);
        patchUnit(e.unitId, working);
      }
      wardenFractureAppliedRef.current = !fracturedBefore && (
        (working.fractureGauge ?? 0) > gaugeBefore || isEnemyFractured(working)
      );
    }
    let dmg = raw;
    if (source && dmg > 0) {
      dmg = applyRivalHexedOccultMultiplier(sessionExtrasRef.current, options?.channel, dmg);
    }
    let pendingEnvoyKineticSplash: number | undefined;
    if (operativeClass === 'HEX_SHOT' && dmg > 0) {
      const hexAbilityIdForProfile = (options?.abilityId ?? lastPlayerAbilityRef.current) as HexShotAbilityId | null;
      if (hexAbilityIdForProfile && source && !options?.echoHit) {
        const profile = getHexAmmoProfileForAbility(hexAbilityIdForProfile);
        if (profile) {
          classLoopTelemetryRef.current.ammoProfileUses[profile.id] =
            (classLoopTelemetryRef.current.ammoProfileUses[profile.id] ?? 0) + 1;
        }
      }
      if (
        classCombatRef.current.chamberBonusReady
        && source
        && !options?.echoHit
        && hexAbilityIdForProfile
        && abilityUsesBallisticTags(hexAbilityIdForProfile)
      ) {
        classCombatRef.current.chamberBonusReady = false;
        classLoopTelemetryRef.current.chamberBonusConsumed += 1;
        dmg = Math.floor(dmg * 1.15);
        log('[CHAMBER] >> Chambered round — +15% ballistic damage.');
      }
      if (isEnemyFractured(working) && source && !options?.echoHit) {
        classLoopTelemetryRef.current.fractureExploits += 1;
      }
      dmg = Math.floor(dmg * hexShotBoonModsRef.current.damageMultiplier);
      const hexAbilityId = options?.abilityId ?? lastPlayerAbilityRef.current;
      if (
        hexAbilityId
        && isEnemyFractured(working)
        && boonMatchesHexAction(hexShotBoons, 'SHATTER_RIFLING', hexAbilityId)
      ) {
        dmg = Math.floor(dmg * (1 + hexShotBoonModsRef.current.ballisticFracturedDamagePct / 100));
      }
      if (
        hexAbilityId
        && currentAmmoRef.current === 1
        && boonMatchesHexAction(hexShotBoons, 'EXECUTIONERS_CLIP', hexAbilityId)
      ) {
        dmg = Math.floor(dmg * 2);
        log("[EXECUTIONER'S CLIP] >> Final round — double damage.");
      }
      const hexAdjust = hexAbilityId
        ? adjustHexShotOutgoingDamage({
          boons: hexShotBoons,
          mods: hexShotBoonModsRef.current,
          abilityId: hexAbilityId as HexShotAbilityId,
          target: working,
          damage: dmg,
          channel: options?.channel,
          encounter: classBoonEncounterRef.current,
          log,
          ammoType: hexShotStateRef.current.currentAmmoType,
        })
        : null;
      if (hexAdjust) {
        dmg = hexAdjust.damage;
        if (hexAdjust.channel) options = { ...options, channel: hexAdjust.channel };
        if (hexAdjust.ignoreDefenses) ignoreDefenses = true;
        if (hexAdjust.forceCrit) critical = true;
      }
      if (resolvedWeapon) {
        const postReload = didWeaponPostReloadBonus(weaponRuntimeRef.current);
        dmg = applyWeaponBallisticDamageMultiplier(
          dmg,
          resolvedWeapon.statModifiers,
          postReload,
          resolvedWeapon.passiveBonusPct ?? 0,
        );
        if (postReload) {
          weaponRuntimeRef.current = consumeWeaponPostReloadBonus(weaponRuntimeRef.current);
        }
        const ballisticHooks = runWeaponOnBallisticHitHooks(
          { ...buildWeaponHookContext(), target: working },
          working,
        );
        ballisticHooks.logLines.forEach((line) => log(line));
        if (ballisticHooks.runtimePatch) applyWeaponRuntimePatch(ballisticHooks.runtimePatch);
        if (ballisticHooks.enemyArmorStrip) {
          working = stripExtraArmorFromTarget(working, ballisticHooks.enemyArmorStrip);
        }
      }
    }
    if (operativeClass === 'ENVOY' && dmg > 0) {
      let envoyMult = envoyBoonModsRef.current.damageMultiplier;
      const envoyAbilityId = options?.abilityId ?? lastPlayerAbilityRef.current;
      if (
        envoyAbilityId
        && hasEnvoyBoon(envoyBoons, 'VOID_TOUCHED')
        && veilFluxRef.current > 50
        && getEnvoyAbilityTags(envoyAbilityId as EnvoyAbilityId).includes('SPELL')
      ) {
        envoyMult *= 1 + envoyBoonModsRef.current.spellDamageFluxBonusPct / 100;
      }
      dmg = Math.floor(dmg * envoyMult);
      if (resolvedWeapon && (options?.channel === 'OCCULT' || operativeClass === 'ENVOY')) {
        dmg = applyWeaponOccultDamageMultiplier(dmg, resolvedWeapon.statModifiers);
      }
      const envoyAbilityIdCast = (options?.abilityId ?? lastPlayerAbilityRef.current) as EnvoyAbilityId | null;
      const envoyAdjust = envoyAbilityIdCast
        ? adjustEnvoyOutgoingDamage({
          boons: envoyBoons,
          mods: envoyBoonModsRef.current,
          abilityId: envoyAbilityIdCast,
          target: working,
          damage: dmg,
          channel: options?.channel,
          encounter: classBoonEncounterRef.current,
          log,
        })
        : null;
      if (envoyAdjust) {
        dmg = envoyAdjust.damage;
        if (envoyAdjust.channel) options = { ...options, channel: envoyAdjust.channel };
        if (envoyAdjust.executeKill) dmg = working.currentHp;
        pendingEnvoyKineticSplash = envoyAdjust.kineticConversionSplash;
      }
    }
    if (hexAmmoResult && dmg > 0) {
      let ammoMult = hexAmmoResult.damageMultiplier;
      if (hexAmmoResult.backlineBonusPct > 0) ammoMult *= 1 + hexAmmoResult.backlineBonusPct / 100;
      dmg = Math.max(0, Math.floor(dmg * ammoMult) + hexAmmoResult.flatOccultBonus);
    }
    if (hexAmmoFirstShotPenalty && dmg > 0) {
      dmg = Math.floor(dmg * (1 - HEX_MAGAZINE_CONFIG.failedFirstShotDamagePct / 100));
      dispatchHexShot({ type: 'HEX_CONSUME_BALLISTIC_OVERCHARGE' });
      log('[JAMMED CHAMBER] >> Failed reload — first shot −10%.');
    }
    if (hexOverchargedStrike && dmg > 0) {
      dmg = Math.floor(dmg * (1 + hexOverchargeMult));
      if (
        options?.abilityId
        && hasHexShotBoon(hexShotBoons, 'RECOIL_HARNESS')
        && boonMatchesHexAction(hexShotBoons, 'RECOIL_HARNESS', options.abilityId)
      ) {
        dmg = Math.floor(dmg * (1 + hexShotBoonModsRef.current.ballisticOverchargeDamagePct / 100));
        log('[RECOIL HARNESS] >> Overcharge volley amplified.');
      }
    }
    const graftPlan = operativeClass === 'AEGIS'
      ? activeGraftPlanRef.current
      : activeClassGraftPlanRef.current;
    if (graftPlan && dmg > 0) {
      if (operativeClass === 'AEGIS') {
        dmg = scaleGraftDamage(
          dmg,
          graftPlan as GraftCastPlan,
          activeGraftReserveSpentRef.current,
          Boolean(working.isBoss),
        );
      }
      if (graftPlan.forceTrueDamage) {
        options = { ...options, channel: 'TRUE' };
      }
      if (graftPlan.executeThreshold && working.maxHp > 0 && !working.isBoss) {
        const hpRatio = working.currentHp / working.maxHp;
        if (hpRatio <= graftPlan.executeThreshold) {
          dmg = working.currentHp;
          log(`>> [${graftPlan.graftName.toUpperCase()}] EXECUTE — sub-threshold cull.`);
        }
      }
      if (
        operativeClass !== 'AEGIS'
        && graftPlan.bossDamageMultiplier > 1
        && working.isBoss
      ) {
        dmg = Math.floor(dmg * graftPlan.bossDamageMultiplier);
        log(`>> [${graftPlan.graftName.toUpperCase()}] — boss damage amplified.`);
      }
    }
    if (
      source === 'STRIKE'
      && kineticBatteryChargedRef.current
      && dmg > 0
    ) {
      kineticBatteryChargedRef.current = false;
      const boosted = Math.floor(dmg * 1.4);
      log(`${tag} >> [KINETIC BATTERY] — ${dmg} → ${boosted}.`);
      dmg = boosted;
    }
    if (
      hasMutation(leyLineMutations, 'FINAL_STAND')
      && playerApRef.current === 1
      && staminaRef.current === 0
      && source
    ) {
      options = { ...options, channel: 'TRUE' };
    }
    if (source) {
      const activeAbility = (options?.abilityId as AegisAbilityId | undefined) ?? lastAegisAbilityRef();
      if (source && dmg > 0) {
        dmg = applyAbyssalResonanceDamage(
          leyLineMutations,
          activeAbility,
          dmg,
          classCombatRef.current.runicBrands,
          mutationModsRef.current,
        );
        const voidRes = applyVoidResonanceDamage(
          leyLineMutations,
          activeAbility,
          dmg,
          mutationEncounterRef.current,
        );
        dmg = voidRes.damage;
        if (voidRes.consumed) {
          log('[VOID RESONANCE] >> Occult follow-up — +15% damage.');
        }
      }
      if (mutationEncounterRef.current.masochistBuff) {
        dmg = Math.floor(dmg * 1.5);
      }
      const scaled = scaleKineticDamage(dmg, 0);
      if (!narrativeOvercharged && scaled !== dmg) {
        log(`${tag} >> Kinetic scaling ${dmg} → ${scaled}.`);
      }
      dmg = scaled;
    }
    if (godModeAttack) {
      // 1000 floor + lethal vs current HP (incl. shared boss pools).
      const lethalFloor = working.sharedBossPool && bossRuntimeRef.current
        ? bossRuntimeRef.current.currentHp
        : working.currentHp;
      dmg = Math.max(GOD_MODE_STRIKE_DAMAGE, lethalFloor);
      options = { ...options, channel: 'TRUE', ignoreDefenses: true };
    }
    if (options?.channel === 'TRUE' || bypassAllMitigation) {
      dmg = applyDamageWithFractureBonus(dmg, working);
    } else if (options?.channel) {
      const priorDefense = wardenDefenseMaterialRef.current;
      if (
        !ignoreDefenses
        && options.channel === 'KINETIC'
        && (working.kineticArmor ?? 0) > 0
      ) {
        wardenDefenseMaterialRef.current = 'KINETIC_ARMOR';
      } else if (
        !ignoreDefenses
        && options.channel === 'OCCULT'
        && (working.occultWards ?? 0) > 0
      ) {
        wardenDefenseMaterialRef.current = 'OCCULT_WARD';
      } else if (priorDefense === 'KINETIC_ARMOR' || priorDefense === 'OCCULT_WARD') {
        // Keep Armor/Ward response when tags already stripped the last stack this hit.
        wardenDefenseMaterialRef.current = priorDefense;
      } else {
        wardenDefenseMaterialRef.current = 'NONE';
      }
      const hit = resolveHostileHpHit(working, dmg, options.channel, { ignoreDefenses });
      working = hit.enemy;
      dmg = hit.hpDamage;
      hit.logLines.forEach((line) => log(line));
    } else if (
      wardenDefenseMaterialRef.current !== 'KINETIC_ARMOR'
      && wardenDefenseMaterialRef.current !== 'OCCULT_WARD'
    ) {
      wardenDefenseMaterialRef.current = 'NONE';
    }
    if (!bypassAllMitigation && (env.enemyDamageReductionPct ?? 0) > 0) {
      dmg = Math.floor(dmg * (1 - (env.enemyDamageReductionPct ?? 0) / 100));
    }
    if (critical && dmg > 0 && !options?.echoHit) {
      dmg = applyCritMultiplier(dmg, COMBAT_CHANCE.CRIT_DAMAGE_MULTIPLIER);
      if (operativeClass === 'ENVOY') {
        const envoyAbilityIdCrit = (options?.abilityId ?? lastPlayerAbilityRef.current) as EnvoyAbilityId | null;
        const volatileBonus = getEnvoyVolatileMagicCritBonus(envoyBoons, envoyAbilityIdCrit, true);
        if (volatileBonus > 0) {
          dmg = Math.floor(dmg * (1 + volatileBonus));
          log('[VOLATILE MAGIC] >> AoE critical rupture amplified.');
        }
      }
      const classGraftCrit = activeClassGraftPlanRef.current;
      if (classGraftCrit?.refundApOnCrit && operativeClass !== 'AEGIS') {
        const safety = graftEncounterSafetyRef.current;
        if (canRefundApexTriggerAp(safety)) {
          graftEncounterSafetyRef.current = recordApexTriggerApRefund(safety);
          playerApRef.current += 1;
          setPlayerActionPoints(playerApRef.current);
          log(`>> [${classGraftCrit.graftName.toUpperCase()}] — critical hit refunds 1 AP (${graftEncounterSafetyRef.current.apexTriggerApRefunds}/${APEX_TRIGGER_AP_REFUND_CAP_PER_ENCOUNTER} encounter cap).`);
        } else {
          log(`>> [${classGraftCrit.graftName.toUpperCase()}] — AP refund blocked (encounter cap reached).`);
        }
      }
      const critChannel = options?.abilityId === 'VEIL_PIERCER'
        ? 'KINETIC'
        : (options?.channel ?? 'KINETIC');
      if (e.unitId) {
        const deferCritForWarden = shouldUseWardenStrikePresentation({
          weaponFamilyId: resolvedWeapon?.familyId,
          abilityId: options?.abilityId,
          actionKind: options?.actionKind,
          playerActionKind: options?.playerActionKind,
          nestedPresentation: options?.nestedPresentation,
        }) && !options?.indirectDamage && !options?.echoHit && !isWardenStrikeInputGuarded();
        if (deferCritForWarden) {
          wardenDeferredCritChannelRef.current = critChannel;
        } else {
          const prev = critImpactSeqRef.current[e.unitId]?.seq ?? 0;
          critImpactSeqRef.current[e.unitId] = { seq: prev + 1, channel: critChannel };
          publishSquadUi(squadRef.current);
          onPlayerCritImpact?.({ unitId: e.unitId, channel: critChannel });
        }
      }
      apparitionRef?.current?.triggerPlayerCritSunder(critChannel === 'OCCULT' ? 'OCCULT' : 'KINETIC');
    }
    if (!bypassAllMitigation) {
      dmg = Math.floor(dmg * getEnemyDamageTakenMultiplier(working, sessionExtrasRef.current));
    }

    const projectedHpAfter = Math.max(working.currentHp - dmg, 0);
    if (source && options?.channel) {
      const hitLifecycle = CombatLifecycleManager.runOnHitTaken(
        working,
        {
          raw: dmg,
          channel: options.channel,
          source,
          projectedHpAfter,
        },
        buildLifecycleContext(),
      );
      hitLifecycle.logLines.forEach((line) => log(line));
      applyLifecycleExtras(hitLifecycle.extras);
      applyLifecyclePlayerDelta(hitLifecycle.playerHpDelta);
      applyLifecycleStaminaDelta(hitLifecycle.playerStaminaDelta);
      if (hitLifecycle.squad.length > 0) syncSquad(hitLifecycle.squad);
      working = getUnitById(squadRef.current, e.unitId!) ?? working;
      if (hitLifecycle.negateDamage) dmg = 0;
      else if (hitLifecycle.damageOverride != null) dmg = hitLifecycle.damageOverride;
      if (hitLifecycle.showImmunePopup && hitLifecycle.immunePopupUnitId) {
        publishSquadUi(squadRef.current);
      }
    }

    const hadFortify = !bypassAllMitigation && (working.fortifyTurnsRemaining ?? 0) > 0 && dmg > 0;
    if (hadFortify) {
      dmg = Math.floor(dmg * 0.5);
      log(`${tag} >> FORTIFIED — 50% (${dmg}).`);
    }
    if (!hadFortify) {
      if (critical) {
        log(`${tag} >> [ CRITICAL ] ${dmg} damage.`);
      } else {
        log(`${tag} >> ${dmg} damage.`);
      }
    }
    if ((hexOverchargedStrike || narrativeOvercharged) && source && dmg > 0) {
      if (hexOverchargedStrike) {
        dispatchHexShot({ type: 'HEX_CONSUME_BALLISTIC_OVERCHARGE' });
        const pct = Math.round(hexOverchargeMult * 100);
        log(`[OVERCHARGE] >> +${pct}% damage consumed on ballistic strike.`);
      }
      if (narrativeOvercharged) {
        sessionExtrasRef.current.overchargedActive = false;
        if (operativeClass === 'AEGIS') {
          setAegisOvercharged(false);
        }
        log('[OVERCHARGED BOON] >> First strike bypassed all mitigation.');
      }
    }
    if (source && dmg > 0 && e.unitId) {
      trackVoidAmbushInterruptDamage(e.unitId, dmg);
    }
    // --- Hex Shot ammo secondary effects (strip / mark / AP) ---
    if (hexAmmoResult && source && working.unitId) {
      const ammoTid = working.unitId;
      if (hexAmmoResult.stripArmor) {
        const cur = getUnitById(squadRef.current, ammoTid)?.kineticArmor ?? 0;
        if (cur > 0) patchUnit(ammoTid, { kineticArmor: Math.max(0, cur - 1) });
      }
      if (hexAmmoResult.stripWard) {
        const cur = getUnitById(squadRef.current, ammoTid)?.occultWards ?? 0;
        if (cur > 0) patchUnit(ammoTid, { occultWards: Math.max(0, cur - 1) });
      }
      if (hexAmmoResult.applyVoidMark) {
        classBoonEncounterRef.current.voidMarkedUnits[ammoTid] = true;
      }
      if (hexAmmoResult.apReduction > 0) {
        reduceEnemyAp(ammoTid, hexAmmoResult.apReduction);
      }
      recordHexAmmoEffect(hexAmmoCastTrackerRef.current, ammoTid, hexAmmoResult);
      hexAmmoResult.notes.forEach((note) => log(`[AMMO] ${note}`));
    }
    const activeAbility = (options?.abilityId as AegisAbilityId | undefined) ?? lastAegisAbilityRef();
    if (source && dmg > 0 && activeAbility && e.unitId) {
      if (
        boonMatchesAction(leyLineMutations, 'EXECUTIONERS_STRIDE', activeAbility)
        && targetIsExposed(working)
        && !mutationEncounterRef.current.executionerStrideUsed
      ) {
        mutationEncounterRef.current.executionerStrideUsed = true;
        playerApRef.current += 1;
        setPlayerActionPoints(playerApRef.current);
        log("[EXECUTIONER'S STRIDE] >> Exposed melee hit — +1 AP.");
      }
      if (
        boonMatchesAction(leyLineMutations, 'SUNDER_WEAVE', activeAbility)
        && mutationModsRef.current.sunderWeaveArmorShred > 0
      ) {
        working = {
          ...working,
          kineticArmor: Math.max(0, (working.kineticArmor ?? 0) - mutationModsRef.current.sunderWeaveArmorShred),
          occultWards: Math.max(0, (working.occultWards ?? 0) - 1),
        };
        patchUnit(e.unitId, working);
        log('[SUNDER-WEAVE] >> Dual-channel strike — 1 armor layer shattered.');
      }
      if (boonMatchesAction(leyLineMutations, 'TAR_TRAPPED', activeAbility)) {
        mutationEncounterRef.current.tarTrappedUnits[e.unitId] = 2;
        patchUnit(e.unitId, { evadeChance: 0, evadeActive: false, evadeTurnsRemaining: 0 });
        log('[TAR-TRAPPED] >> Target cannot evade for 2 turns.');
      }
      if (
        modifierForAction(
          leyLineMutations,
          'ABYSSAL_ERUPTION',
          activeAbility,
          mutationModsRef.current.abyssalEruptionPerHit,
        ) > 0
      ) {
        chargeAr(mutationModsRef.current.abyssalEruptionPerHit);
        log(`[ABYSSAL ERUPTION] >> +${mutationModsRef.current.abyssalEruptionPerHit} reserve from AoE hit.`);
      }
    }
    const ultimateAttackPose = isWeaponUltimateActionId(options?.abilityId)
      || source === 'EVISCERATE';
    const skipPoseForWarden = shouldUseWardenStrikePresentation({
      weaponFamilyId: resolvedWeapon?.familyId,
      abilityId: options?.abilityId,
      actionKind: options?.actionKind,
      playerActionKind: options?.playerActionKind,
      nestedPresentation: options?.nestedPresentation,
    }) && !options?.indirectDamage && !options?.echoHit;
    // Nested riders (Riposte +16, Veil Edge, etc.) must never start a second lunge/pose.
    // Warden owns the single approach for Strike; skip generic attack pose entirely.
    if (
      source
      && source !== 'COUNTER'
      && dmg > 0
      && (isPlayerTurnRef.current || ultimateAttackPose)
      && Boolean(options?.abilityId || ultimateAttackPose)
      && !options?.indirectDamage
      && !options?.echoHit
      && !options?.nestedPresentation
      && options?.abilityId !== 'RUIN'
      && !skipPoseForWarden
      && !isWardenStrikeInputGuarded()
      && !options?.deferAbyssalVerdict
    ) {
      triggerPlayerAttackPose(working);
    }
    const poolHp = working.sharedBossPool && bossRuntimeRef.current
      ? Math.max(bossRuntimeRef.current.currentHp - dmg, 0)
      : Math.max(working.currentHp - dmg, 0);
    const hp = poolHp;
    if (dmg > 0) {
      balanceEncounterRef.current.damageDealt += dmg;
      working = {
        ...working,
        aiMemory: markEnemyRecentlyDamaged(working.aiMemory),
      };
    }

    if (hp <= 0 && e.unitId && source && options?.channel) {
      const killGraft = operativeClass === 'AEGIS'
        ? activeGraftPlanRef.current
        : activeClassGraftPlanRef.current;
      const dropLootKind = operativeClass === 'AEGIS'
        ? resolveAegisGraftDropLoot(options?.abilityId)
        : killGraft?.dropLootOnKill ?? null;
      if (killGraft?.refundApOnKill && operativeClass === 'AEGIS') {
        const refund = activeGraftApCostRef.current + 1;
        playerApRef.current += refund;
        setPlayerActionPoints(playerApRef.current);
        log(`>> [${killGraft.graftName.toUpperCase()}] — kill confirmed, AP refunded (+${refund}).`);
      }
      if (dropLootKind) {
        if (dropLootKind === 'CREDITS') {
          const { next, granted } = accrueGraftSalvageCredits(graftEncounterSafetyRef.current);
          graftEncounterSafetyRef.current = next;
          if (granted > 0) {
            onGraftLootDrop?.(`CREDITS:${granted}`);
            const resolvedAbility = (options?.abilityId ?? lastPlayerAbilityRef.current) as AegisAbilityId | null;
            const fallbackGraftId = resolvedAbility ? abilityGraftsRef.current[resolvedAbility] : undefined;
            const graftLabel = killGraft?.graftName
              ?? (fallbackGraftId ? getVeilGraftDefinition(fallbackGraftId).name : 'GRAFT');
            log(`>> [${graftLabel.toUpperCase()}] — kill extracts ${granted} credits (salvage cap).`);
          } else {
            log('>> GRAFT SALVAGE — credit cap reached for this encounter.');
          }
        } else {
          onGraftLootDrop?.(dropLootKind);
          const resolvedAbility = (options?.abilityId ?? lastPlayerAbilityRef.current) as AegisAbilityId | null;
          const fallbackGraftId = resolvedAbility ? abilityGraftsRef.current[resolvedAbility] : undefined;
          const graftLabel = killGraft?.graftName
            ?? (fallbackGraftId ? getVeilGraftDefinition(fallbackGraftId).name : 'GRAFT');
          log(`>> [${graftLabel.toUpperCase()}] — kill extracts ${dropLootKind.toLowerCase()}.`);
        }
      }
      const abilityTags = options?.abilityTags?.length
        ? options.abilityTags
        : resolveOperativeAbilityTags(options?.abilityId ?? lastPlayerAbilityRef.current);
      const isDirectDamage = options?.isDirectDamage ?? !options?.indirectDamage;
      const deathLifecycle = CombatLifecycleManager.runOnDeath(
        working,
        {
          channel: options.channel,
          damage: dmg,
          source: source ?? undefined,
          abilityId: options?.abilityId,
          tags: abilityTags,
          isDirectDamage,
        },
        buildLifecycleContext(),
      );
      deathLifecycle.logLines.forEach((line) => log(line));
      applyLifecycleExtras(deathLifecycle.extras);
      applyLifecyclePlayerDelta(deathLifecycle.playerHpDelta);
      if (deathLifecycle.squad.length > 0) syncSquad(deathLifecycle.squad);
      working = getUnitById(squadRef.current, e.unitId) ?? working;

      if (deathLifecycle.statusFloatLabel && deathLifecycle.statusFloatUnitId) {
        statusFloatSeqRef.current[deathLifecycle.statusFloatUnitId] =
          (statusFloatSeqRef.current[deathLifecycle.statusFloatUnitId] ?? 0) + 1;
        lifecycleFloatLabelsRef.current[deathLifecycle.statusFloatUnitId] =
          deathLifecycle.statusFloatLabel;
        publishSquadUi(squadRef.current);
      }

      // Thrall slump is not eradication — keep the unit mounted and fall through so
      // Warden / weapon attack presentation still arms (early return skipped the strike).
      if (!deathLifecycle.enterSlump) {
        if (deathLifecycle.ashTokenSlot) {
          sessionExtrasRef.current.ashTokens = {
            ...sessionExtrasRef.current.ashTokens,
            [deathLifecycle.ashTokenSlot]: { turnsRemaining: 1 },
          };
        }

        if (deathLifecycle.triggerRetributionParry) {
          pendingDissolveRef.current = { unitId: e.unitId, profile: working, hp: 0 };
          retributionParryRef.current = deathLifecycle.triggerRetributionParry;
          pendingDmgRef.current = deathLifecycle.triggerRetributionParry.occultDamage;
          pendingUnblockRef.current = false;
          cycleRef.current = 'DEFEND_PARRY';
          setCycleState('DEFEND_PARRY');
          startParryRing();
          patchUnit(e.unitId, { ...working, currentHp: 0 });
          return true;
        }
      }
    }

    if (dmg > 0 && e.unitId && (source || options?.indirectDamage)) {
      const tetheredId = hookWeaverTetheredUnitId();
      if (source && tetheredId && tetheredId === e.unitId) {
        const weaver = activeHookWeaver();
        const penalty = weaver
          ? getAlphaMechanic(weaver, 'tetherStaminaPenalty', 10)
          : 10;
        applyStamina(Math.max(0, staminaRef.current - penalty));
        log(`>> HOOK WEAVER TETHER — ${penalty} stamina siphoned.`);
      }
      if (
        encounterModifierRuntimeRef.current?.modifierId === 'FOLDED'
        && encounterModifierRuntimeRef.current.foldedUnitId === e.unitId
        && working.evadeActive
      ) {
        working = { ...working, evadeActive: false, evadeTurnsRemaining: 0 };
        patchUnit(e.unitId, { evadeActive: false, evadeTurnsRemaining: 0 });
        log('>> FOLDED — phased silhouette forced into true position.');
      }
      const deferAbyssalHitFx = options?.deferAbyssalVerdict === true;
      if (!deferAbyssalHitFx) {
        hitFlashSeqRef.current[e.unitId] = (hitFlashSeqRef.current[e.unitId] ?? 0) + 1;
      }
      // Multi-pulse blood burst: Carbine RANGED ×3, Paired Blades ×2.
      // ABYSSAL VERDICT owns hit FX at the delayed IMPACT beat.
      if (!deferAbyssalHitFx) {
        const burstAbilityId = options?.abilityId ?? lastPlayerAbilityRef.current;
        const burstTags = options?.abilityTags?.length
          ? options.abilityTags
          : resolveOperativeAbilityTags(burstAbilityId);
        const directWeaponHit = Boolean(
          resolvedWeapon
          && !options?.indirectDamage
          && !options?.echoHit,
        );
        const carbineRangedBurst = Boolean(
          directWeaponHit
          && resolvedWeapon?.familyId === 'hex-pulse-rifle'
          && burstTags.includes('RANGED'),
        );
        const pairedBladesBurst = Boolean(
          directWeaponHit
          && resolvedWeapon?.familyId === 'aegis-rift-edge',
        );
        bloodBurstRepeatsRef.current[e.unitId] = carbineRangedBurst
          ? 3
          : pairedBladesBurst
            ? 2
            : 1;
        bloodMistScaleRef.current[e.unitId] = (
          resolvedWeapon?.familyId === 'hex-void-cannon'
          || resolvedWeapon?.familyId === 'aegis-claymore-blade'
        ) ? 1.5 : 1;
        // Prefer weapon-specific presentation; skip generic class flashes when a
        // permanent weapon is resolving (Phase 3M repair — removes mustard/purple/red fills).
        if (
          source
          && !options?.indirectDamage
          && !options?.echoHit
          && !resolvedWeapon
          && options?.abilityId !== 'RUIN'
        ) {
          const impactKind = operativeClass === 'AEGIS'
            ? 'AEGIS_SLICE' as const
            : operativeClass === 'HEX_SHOT'
              ? 'HEX_BULLET' as const
              : 'ENVOY_BURST' as const;
          const prevImpact = classImpactFxRef.current[e.unitId]?.seq ?? 0;
          classImpactFxRef.current[e.unitId] = { seq: prevImpact + 1, kind: impactKind };
        }
        Vibration.vibrate(18);
      }
      const useWardenStrike = shouldUseWardenStrikePresentation({
        weaponFamilyId: resolvedWeapon?.familyId,
        abilityId: options?.abilityId,
        actionKind: options?.actionKind,
        playerActionKind: options?.playerActionKind,
        nestedPresentation: options?.nestedPresentation,
      }) && !options?.indirectDamage && !options?.echoHit;
      // Follow-up hits (e.g. Veil Edge rider) while presentation is locked.
      const wardenFollowUp = useWardenStrike && isWardenStrikeInputGuarded();
      if (useWardenStrike && !wardenFollowUp) {
        // Undo immediate flash — contact frame owns recoil + steel impact.
        hitFlashSeqRef.current[e.unitId] = Math.max(
          0,
          (hitFlashSeqRef.current[e.unitId] ?? 1) - 1,
        );
      }
      if (wardenFollowUp || (options?.nestedPresentation && isWardenStrikeInputGuarded())) {
        contributeWardenStrikeContactDamage({
          playerActionId: options?.playerActionId ?? wardenPlayerActionIdRef.current,
          damage: dmg,
          critical,
          killed: false,
          fractureApplied: wardenFractureAppliedRef.current,
          defenseMaterial: wardenDefenseMaterialRef.current,
        });
      }
      if (options?.indirectDamage && dmg > 0) {
        // Class DoT / triggered damage — exclusive cue (no weapon attack SFX).
        if (operativeClass === 'ENVOY') {
          unlockCombatPresentationAudio();
          playCombatPresentationCue('sfx.envoy.dot');
        } else if (operativeClass === 'HEX_SHOT') {
          unlockCombatPresentationAudio();
          playCombatPresentationCue('sfx.hex.dot');
        }
      } else if (
        resolvedWeapon
        && source
        && !options?.echoHit
        && !options?.nestedPresentation
        && options?.abilityId !== 'RUIN'
        && !options?.deferAbyssalVerdict
        && !(useWardenStrike && !wardenFollowUp)
        && !wardenFollowUp
        && !isWardenStrikeInputGuarded()
        && !isAbyssalVerdictInputGuarded()
      ) {
        try {
          unlockCombatPresentationAudio();
          presentResolvedWeaponHit({
            weaponFamilyId: resolvedWeapon.familyId,
            abilityId: options?.abilityId,
            targetId: e.unitId,
            damage: dmg,
            critical,
            // Thrall slump is not a true kill — skip kill-confirm SFX.
            killed: hp <= 0 && !working.isSlumped,
            channel: options?.channel === 'OCCULT'
              ? 'OCCULT'
              : options?.channel === 'TRUE'
                ? 'TRUE'
                : operativeClass === 'HEX_SHOT'
                  ? 'BALLISTIC'
                  : 'KINETIC',
            fractureApplied: (options?.fractureGain ?? 0) > 0,
            actionKind: isWeaponUltimateActionId(options?.abilityId) ? 'ULTIMATE' : undefined,
          });
        } catch {
          // Presentation must never block combat.
        }
      }
      if (
        resolvedWeapon
        && source === 'STRIKE'
        && operativeClass === 'AEGIS'
        && !options?.nestedPresentation
        && !options?.indirectDamage
      ) {
        const hitResult = runWeaponOnMeleeHitHooks(
          { ...buildWeaponHookContext(), target: working, source, damage: { raw: dmg, channel: options?.channel, multiplier: 1 } },
          critical,
        );
        hitResult.logLines.forEach((line) => log(line));
        if (hitResult.runtimePatch) applyWeaponRuntimePatch(hitResult.runtimePatch);
        if (hitResult.reserveDelta && hitResult.reserveDelta > 0) {
          abyssalRef.current = Math.min(
            mutationModsRef.current.abyssalCap,
            abyssalRef.current + hitResult.reserveDelta,
          );
          setAbyssalReserve(abyssalRef.current);
        }
      }
    }

    if (source && dmg > 0 && working.rosterId === 'rival-reaver') {
      sessionExtrasRef.current.reaverDamagedThisPlayerTurn = true;
    }
    const armWardenPresentation = shouldUseWardenStrikePresentation({
      weaponFamilyId: resolvedWeapon?.familyId,
      abilityId: options?.abilityId,
      actionKind: options?.actionKind,
      playerActionKind: options?.playerActionKind,
      nestedPresentation: options?.nestedPresentation,
    }) && !options?.indirectDamage && !options?.echoHit && !isWardenStrikeInputGuarded();
    const armAbyssalVerdict = options?.deferAbyssalVerdict === true && !!e.unitId;
    if (armAbyssalVerdict && e.unitId) {
      abyssalDeferredOutcomeRef.current = {
        unitId: e.unitId,
        evaded: false,
        damageApplied: dmg,
        killed: hp <= 0 && !working.isSlumped,
      };
    }
    if ((armWardenPresentation || armAbyssalVerdict) && e.unitId) {
      // Hold the pre-hit snapshot from `e` — thrall slump death patches may already
      // have zeroed the live squad unit before presentation arms.
      visualHpHoldRef.current[e.unitId] = e.currentHp;
    }
    if (working.sharedBossPool && bossRuntimeRef.current) {
      bossRuntimeRef.current = { ...bossRuntimeRef.current, currentHp: hp };
      syncSquad(squadRef.current.map((u) =>
        u.sharedBossPool ? { ...u, currentHp: hp } : u,
      ));
      if (hp <= 0 && e.unitId) {
        const latest = getUnitById(squadRef.current, e.unitId) ?? { ...working, currentHp: hp };
        // Never dissolve a valid thrall slump; dissolve only when truly dead.
        // ABYSSAL VERDICT defers death presentation until IMPACT.
        if (!isUnitAlive(latest) && !armAbyssalVerdict) {
          beginDissolveForUnit(e.unitId, latest, latest.currentHp);
        }
      }
    } else {
      patchUnit(e.unitId, syncRosterCombatState({ ...working, currentHp: hp }));
      if (hp <= 0 && e.unitId) {
        const latest = getUnitById(squadRef.current, e.unitId) ?? { ...working, currentHp: hp };
        if (!isUnitAlive(latest) && !armAbyssalVerdict) {
          beginDissolveForUnit(e.unitId, latest, latest.currentHp);
        }
      } else if (e.unitId && source && dmg > 0 && working.isRivalMerc) {
        const swap = tryRivalEmergencySwap(squadRef.current, e.unitId);
        if (swap.logLine) {
          log(swap.logLine);
          syncSquad(swap.squad);
        }
      }
    }
    if (armAbyssalVerdict && e.unitId) {
      publishSquadUi(squadRef.current);
    }

    if (armWardenPresentation && e.unitId) {
      const playerActionId = options?.playerActionId
        ?? wardenPlayerActionIdRef.current
        ?? `pa-warden-${e.unitId}-${Date.now()}`;
      wardenPlayerActionIdRef.current = playerActionId;
      const presentationId = `warden-${e.unitId}-${Date.now()}`;
      const resolvedResultId = `rr-${presentationId}`;
      if (wardenPendingDefenseFloatRef.current?.unitId === e.unitId) {
        wardenPendingDefenseFloatRef.current = {
          ...wardenPendingDefenseFloatRef.current,
          presentationId,
          resolvedResultId,
        };
      }
      wardenPendingRevealRef.current = {
        presentationId,
        unitId: e.unitId,
        revealHitFlash: dmg > 0,
        revealEvade: false,
        critChannel: critical && dmg > 0
          ? (wardenDeferredCritChannelRef.current ?? undefined)
          : undefined,
        riposteBonusKinetic: wardenRiposteBonusRef.current > 0
          ? wardenRiposteBonusRef.current
          : undefined,
      };
      wardenRiposteBonusRef.current = 0;
      wardenDeferredCritChannelRef.current = null;
      beginWardenStrikePresentation({
        presentationId,
        resolvedResultId,
        playerActionId,
        sourceActionKind: options?.playerActionKind ?? options?.actionKind ?? 'STRIKE',
        sourceAbilityId: options?.abilityId ?? 'STRIKE',
        resultSource: 'player-action',
        targetId: e.unitId,
        damage: dmg,
        critical: Boolean(critical && dmg > 0),
        // Thrall slump keeps the unit mounted — not a true kill for presentation.
        killed: hp <= 0 && !working.isSlumped,
        outcome: 'HIT',
        defenseMaterial: wardenDefenseMaterialRef.current,
        fractureApplied: wardenFractureAppliedRef.current,
      });
      // Re-publish so held HP sticks after patchUnit's immediate publish.
      publishSquadUi(squadRef.current);
    } else {
      wardenDeferredCritChannelRef.current = null;
    }

    // Riposte: attach +16 Kinetic once on successful primary-target Strike hit (not on select/miss).
    if (
      source
      && e.unitId
      && canCashOutAegisRiposte({
        state: readRiposteState(),
        operativeClass,
        abilityId: options?.abilityId,
        primaryTargetId: ripostePrimaryTargetIdRef.current,
        hitTargetId: e.unitId,
        successfulHit: true,
        alreadyCashedForAction: Boolean(
          options?.playerActionId
          && riposteCashedActionIdRef.current === options.playerActionId,
        ) || Boolean(
          wardenPlayerActionIdRef.current
          && riposteCashedActionIdRef.current === wardenPlayerActionIdRef.current,
        ),
        nestedPresentation: options?.nestedPresentation,
        indirectDamage: options?.indirectDamage,
        echoHit: options?.echoHit,
      })
    ) {
      const cashActionId = options?.playerActionId
        ?? wardenPlayerActionIdRef.current
        ?? `pa-riposte-${e.unitId}`;
      if (!consumeRiposteReady()) {
        // Race / already cleared.
      } else {
        riposteCashedActionIdRef.current = cashActionId;
        wardenRiposteBonusRef.current = AEGIS_RIPOSTE_BONUS_KINETIC;
        if (wardenPendingRevealRef.current?.unitId === e.unitId) {
          wardenPendingRevealRef.current = {
            ...wardenPendingRevealRef.current,
            riposteBonusKinetic: AEGIS_RIPOSTE_BONUS_KINETIC,
          };
        }
        if (isWardenStrikeInputGuarded()) {
          // Stamp owning presentation as riposte-augmented without a second approach.
          contributeWardenStrikeContactDamage({
            playerActionId: cashActionId,
            damage: 0,
          });
        }
        log(`[RIPOSTE +${AEGIS_RIPOSTE_BONUS_KINETIC}] >> Attached Kinetic bonus.`);
        setPhaseAlert(`RIPOSTE +${AEGIS_RIPOSTE_BONUS_KINETIC}`);
        setTimeout(() => setPhaseAlert(null), 1200);
        const targetStillAlive = (() => {
          const live = getUnitById(squadRef.current, e.unitId);
          return live != null && isUnitAlive(live);
        })();
        if (targetStillAlive) {
          // Attached bonus only — contribute into the owning Warden contact; never a second approach.
          hurtEnemy(AEGIS_RIPOSTE_BONUS_KINETIC, '[RIPOSTE]', 'STRIKE', {
            channel: 'KINETIC',
            fractureGain: 0,
            abilityId: options?.abilityId ?? 'STRIKE',
            actionKind: 'STRIKE',
            playerActionKind: 'STRIKE',
            playerActionId: cashActionId,
            nestedPresentation: true,
            indirectDamage: false,
            rollCrit: false,
            targetId: e.unitId,
          });
        } else if (isWardenStrikeInputGuarded()) {
          contributeWardenStrikeContactDamage({
            playerActionId: cashActionId,
            damage: AEGIS_RIPOSTE_BONUS_KINETIC,
            killed: true,
          });
        }
      }
    }

    if (
      operativeClass === 'HEX_SHOT'
      && source
      && dmg > 0
      && !options?.echoHit
      && e.unitId
    ) {
      const hexAbilityId = (options?.abilityId ?? lastPlayerAbilityRef.current) as HexShotAbilityId | null;
      runHexShotOnHitBoons({
        boons: hexShotBoons,
        abilityId: hexAbilityId,
        target: working,
        damageDealt: dmg,
        critical,
        squad: squadRef.current,
        encounter: classBoonEncounterRef.current,
        log,
        patchUnit,
        splashDamage: (raw, targetId, splashTag) => {
          hurtEnemy(raw, splashTag, 'STRIKE', {
            channel: options?.channel ?? 'KINETIC',
            targetId,
            abilityId: hexAbilityId as AegisAbilityId | undefined,
            rollCrit: false,
            echoHit: true,
          });
        },
        healOperative: (amount) => {
          applyHealRef.current(amount);
        },
        maxHp: maxSoulAnchor,
        ammoType: hexShotStateRef.current.currentAmmoType,
      });
    }

    if (
      operativeClass === 'ENVOY'
      && source
      && dmg > 0
      && !options?.echoHit
      && e.unitId
    ) {
      const envoyAbilityIdHit = (options?.abilityId ?? lastPlayerAbilityRef.current) as EnvoyAbilityId | null;
      runEnvoyOnHitBoons({
        boons: envoyBoons,
        abilityId: envoyAbilityIdHit,
        target: working,
        damageDealt: dmg,
        log,
        patchUnit,
        healOperative: (amount) => {
          applyHealRef.current(amount);
        },
        encounter: classBoonEncounterRef.current,
      });
      if (pendingEnvoyKineticSplash && e.unitId) {
        hurtEnemy(pendingEnvoyKineticSplash, '[KINETIC CONVERSION]', 'STRIKE', {
          channel: 'KINETIC',
          targetId: e.unitId,
          abilityId: envoyAbilityIdHit as AegisAbilityId | undefined,
          rollCrit: false,
          echoHit: true,
        });
      }
    }

    // Phase 2 — interrupt / break telegraphed intents when ability tags match.
    if (source && dmg > 0 && !options?.echoHit && e.unitId && enemyIsTelegraphing(working)) {
      const abilityIdForCounter = String(options?.abilityId ?? lastPlayerAbilityRef.current ?? '');
      const actionTags = resolveOperativeAbilityTags(abilityIdForCounter);
      const killed = hp <= 0;
      const counter = resolveIntentCounterplay({
        intent: working.intent,
        playerActionTags: actionTags,
        sourceCombatant: working,
        classId: operativeClass,
        abilityId: abilityIdForCounter || undefined,
        killedSource: killed,
        incomingDamage: working.baseDamage,
      });
      if (counter.countered && (counter.cancelTelegraph || counter.appliedFracture)) {
        recordIntentCountered(intentTelemetryRef.current, working.intent, counter.counterQuality, {
          damagePrevented: counter.reducedDamageAmount,
          appliedFracture: counter.appliedFracture,
        });
        working = applyIntentCounterplayToEnemy(
          { ...working, currentHp: hp },
          counter,
        );
        patchUnit(e.unitId, working);
        counter.logMessages.forEach((m) => log(`>> INTENT COUNTER // ${m}`));
        if (counter.cancelTelegraph) {
          applyObjectiveProgress(
            progressObjectiveOnChannelInterrupt(
              objectiveSessionRef.current,
              getIntentType(working.intent),
            ),
          );
          emitJuice('INTENT_COUNTERED', {
            targetCombatantIds: working.unitId ? [working.unitId] : undefined,
            text: 'Intent countered',
          });
        }
      } else if (counter.countered) {
        recordIntentCountered(intentTelemetryRef.current, working.intent, counter.counterQuality, {
          damagePrevented: counter.reducedDamageAmount,
          appliedFracture: false,
        });
      }
    }

    if (godModeAttack && dmg > 0) {
      applyGodModeResources();
    }
    if (source && env.bloodFrenzyActive && dmg > 0) {
      const heal = computeBloodFrenzyHeal(dmg, true);
      if (heal > 0) {
        setOperativeHp((p) => {
          const n = Math.min(p + heal, maxSoulAnchor);
          operativeHpRef.current = n;
          return n;
        });
        log(`[BLOOD FRENZY] >> Runic flare restores ${heal} soul anchor.`);
      }
    }
    if (graftPlan && source && dmg > 0) {
      if (graftPlan.healOnDamagePct > 0) {
        const graftHeal = Math.floor(dmg * graftPlan.healOnDamagePct);
        if (graftHeal > 0) {
          applyHealRef.current(graftHeal);
          log(`>> [${graftPlan.graftName.toUpperCase()}] — ${graftHeal} HP siphoned from damage.`);
        }
      }
      if (hp > 0 && operativeClass !== 'AEGIS') {
        const classPlan = activeClassGraftPlanRef.current;
        if (classPlan?.selfDebuffOnSurvive) {
          applyPlayerGraftDebuff(resolveClassGraftSurviveDebuff(classPlan.selfDebuffOnSurvive));
          log(`>> [${classPlan.graftName.toUpperCase()}] — target survived, operative debuffed.`);
        }
      }
    }
    if (working.isBoss && bossRuntimeRef.current && shouldShiftBossPhase(bossRuntimeRef.current, hp)) {
      bossPhaseRef.current = 2;
      const updatedBoss = { ...bossRuntimeRef.current, currentHp: hp, currentPhase: 2 };
      bossRuntimeRef.current = updatedBoss;
      if (working.sharedBossPool) {
        syncSquad(squadRef.current.map((u) =>
          u.isBoss ? { ...u, currentHp: hp, bossPhase: 2, intent: 'OVERDRIVE_DISCHARGE' as EnemyIntent } : u,
        ));
      } else {
        patchUnit(e.unitId, { ...working, currentHp: hp, bossPhase: 2, intent: 'OVERDRIVE_DISCHARGE' });
      }
      setPhaseAlert('>> WARNING: ANOMALY ANCHOR CRACKED // PHASE 2 INITIATED');
      log('>> WARNING: ANOMALY ANCHOR CRACKED // PHASE 2 INITIATED');
      onBossPhaseShift?.(2);
      setTimeout(() => setPhaseAlert(null), 2400);
    }

    if (hp <= 0 && e.unitId) {
      applyObjectiveProgress(
        progressObjectiveOnMarkedKill(objectiveSessionRef.current, e.unitId),
      );
      if (resolutionRef.current != null) return true;
    }

    if (allUnitsDefeated(squadRef.current)) {
      applyObjectiveProgress(progressObjectiveOnSquadCleared(objectiveSessionRef.current));
      if (cycleRef.current === 'DEFEND_PARRY') {
        pendingVictoryRef.current = true;
        return true;
      }
      if (cycleRef.current === 'OFFENSE_SLICE') {
        abortCombatMinigames();
        cycleRef.current = 'TEXT_COMBAT';
        setCycleState('TEXT_COMBAT');
      }
      scheduleCombatVictoryResolution();
      return true;
    }

    if (
      hp <= 0
      && source
      && isEnemyFractured(working)
      && hasMutation(leyLineMutations, 'RELENTLESS_MOMENTUM')
    ) {
      runOnFracturedKill(buildAegisBoonHookCtx());
    }
    const killingAbility = (options?.abilityId as AegisAbilityId | undefined) ?? lastAegisAbilityRef();
    if (
      hp <= 0
      && killingAbility
      && boonMatchesAction(leyLineMutations, 'EXECUTIONERS_HIGH', killingAbility)
      && !mutationEncounterRef.current.executionerHighUsed
    ) {
      mutationEncounterRef.current.executionerHighUsed = true;
      combatBuffRef.current.bonusApThisTurn += 1;
      playerApRef.current += 1;
      setPlayerActionPoints(playerApRef.current);
      log("[EXECUTIONER'S HIGH] >> Kinetic kill — +1 AP.");
    }
    if (
      hp <= 0
      && killingAbility
      && boonMatchesAction(leyLineMutations, 'VOIDS_TOLL', killingAbility)
    ) {
      onVoidsTollTriggered?.();
      log("[VOID'S TOLL] >> Ultimate kill — +1 max AP this incursion (−15% max HP).");
    }
    if (
      critical
      && !options?.echoHit
      && source
      && mutationModsRef.current.phantomCritSplitPct > 0
    ) {
      const echoTarget = aliveUnits(squadRef.current).find((u) => u.unitId !== e.unitId);
      if (echoTarget?.unitId) {
        log('[PHANTOM STRIKES] >> Crit void energy splits to secondary target.');
        hurtEnemy(
          Math.floor(dmg * mutationModsRef.current.phantomCritSplitPct),
          '[PHANTOM]',
          source,
          {
            channel: options?.channel ?? 'KINETIC',
            targetId: echoTarget.unitId,
            echoHit: true,
            rollCrit: false,
          },
        );
      }
    }

    // True death only — thrall slump keeps the unit "alive" and must not cash kill boons.
    if (hp <= 0 && !working.isSlumped) {
      if (encounterModifierRuntimeRef.current) {
        const mirrored = resolveMirroredKillPulse(encounterModifierRuntimeRef.current);
        encounterModifierRuntimeRef.current = mirrored.runtime;
        if (mirrored.damage > 0) {
          if (mirrored.logLine) log(mirrored.logLine);
          hurtPlayer(mirrored.damage, true, mirrored.logLine ?? undefined, {
            rollEvade: false,
            rollCrit: false,
          });
        }
      }
      const killAbility = (
        zeroProtocolActiveRef.current
          ? 'ZERO_PROTOCOL'
          : (options?.abilityId ?? lastPlayerAbilityRef.current)
      );
      const killCtx = {
        abilityId: killAbility,
        log,
        maxHp: maxSoulAnchor,
        currentHp: operativeHpRef.current,
        refundAmmo: (amount: number) => setMagazineAmmo(Math.min(maxAmmo, currentAmmoRef.current + amount)),
        refundAp: () => {
          playerApRef.current += 1;
          setPlayerActionPoints(playerApRef.current);
        },
        healOperative: (amount: number) => {
          applyHealRef.current(amount);
        },
        restoreStamina: () => applyStamina(maxStamina),
        fillMagazine: () => setMagazineAmmo(maxAmmo),
      };
      if (operativeClass === 'HEX_SHOT') {
        runHexShotKillBoons(hexShotBoons, killCtx);
        runHexShotKillBurstBoons({
          boons: hexShotBoons,
          abilityId: killAbility as HexShotAbilityId | null,
          killedUnitId: e.unitId,
          lastDamage: dmg,
          squad: squadRef.current,
          log,
          splashDamage: (raw, targetId, splashTag) => {
            hurtEnemy(raw, splashTag, 'STRIKE', {
              channel: options?.channel ?? 'KINETIC',
              targetId,
              abilityId: killAbility as AegisAbilityId | undefined,
              rollCrit: false,
              echoHit: true,
            });
          },
        });
      } else if (operativeClass === 'ENVOY') {
        runEnvoyKillBoonsExtended({
          boons: envoyBoons,
          abilityId: killAbility as EnvoyAbilityId | null,
          killedUnitId: e.unitId,
          squad: squadRef.current,
          classState: classCombatRef.current,
          encounter: classBoonEncounterRef.current,
          log,
          healOperative: (amount) => {
            applyHealRef.current(amount);
          },
          maxHp: maxSoulAnchor,
          currentHp: operativeHpRef.current,
          applyCurseToUnit: (unitId) => {
            markEnemyCursed(unitId, classBoonEncounterRef.current, 2);
          },
        });
      }
      const nextFocus = primaryAliveUnit(squadRef.current);
      if (nextFocus?.unitId) selectTarget(nextFocus.unitId);
    }
    return false;
  };

  markPlayerDefendedRef.current = () => {
    sessionExtrasRef.current.playerDefendedThisTurn = true;
    if (kineticBatteryActive && !kineticBatteryChargedRef.current) {
      kineticBatteryChargedRef.current = true;
      log('[KINETIC BATTERY] >> Defense lattice charged — next strike +40%.');
    }
    if (hasStructuredDebuff(sessionExtrasRef.current, 'ECHO_DEBUFF')) {
      removeStructuredDebuff(sessionExtrasRef.current, 'ECHO_DEBUFF');
      log('>> ECHO DISSIPATED — defensive posture absorbed the aftershock.');
    }
  };

  resolvePlayerTurnEndDebuffsRef.current = () => {
    const echo = sessionExtrasRef.current.structuredDebuffs.find((d) => d.type === 'ECHO_DEBUFF');
    if (!echo) return;
    if (sessionExtrasRef.current.playerDefendedThisTurn) {
      removeStructuredDebuff(sessionExtrasRef.current, 'ECHO_DEBUFF');
      return;
    }
    const echoDmg = echo.amount ?? 0;
    if (echoDmg > 0 && operativeHpRef.current > 0) {
      hurtPlayer(echoDmg, false, `>> KINETIC ECHO — ${echoDmg}`, { rollEvade: false, rollCrit: false });
      log('>> KINETIC AFTERSHOCK — delayed rupture lands.');
    }
    removeStructuredDebuff(sessionExtrasRef.current, 'ECHO_DEBUFF');
  };

  const markAttackerDoomed = (attacker: EnemyCombatProfile) => {
    if (!attacker.unitId) return;
    const stacked = stackDoomedTag(attacker);
    patchUnit(attacker.unitId, stacked);
    log('[ASHEN MANTLE] >> Mantle absorbed 50% — attacker marked Doomed.');
    if (hasMutation(leyLineMutations, 'NULL_ZONE')) {
      const hpDrain = Math.max(1, Math.floor(attacker.maxHp * 0.1));
      hurtEnemy(hpDrain, '[NULL-ZONE]', 'STRIKE', {
        channel: 'OCCULT',
        targetId: attacker.unitId,
      });
      log('[NULL-ZONE] >> Mantle backlash — attacker hemorrhaging.');
    }
  };

  const tickMutationHazardsOnEnemyPhase = () => {
    const mods = mutationModsRef.current;
    if (mods.ruinDotFracture > 0) {
      for (const unitId of mutationEncounterRef.current.venomousRuinUnits) {
        const unit = getUnitById(squadRef.current, unitId);
        if (!unit?.unitId || !isUnitAlive(unit)) continue;
        const next = applyFractureDamage(unit, mods.ruinDotFracture);
        patchUnit(unit.unitId, next);
        log(`[VENOMOUS RUIN] >> ${unit.designation} — +${mods.ruinDotFracture} fracture hazard.`);
      }
    }
    if (mods.voidContagionDamage > 0) {
      for (const unit of aliveUnits(squadRef.current)) {
        if (!unit.unitId || doomedPulseStacks(unit) <= 0) continue;
        const pulse = mods.voidContagionDamage * doomedPulseStacks(unit);
        hurtEnemy(pulse, '[VOID CONTAGION]', undefined, {
          channel: 'OCCULT',
          targetId: unit.unitId,
          indirectDamage: true,
        });
        log(`[VOID CONTAGION] >> ${unit.designation} — ${pulse} occult pulse.`);
      }
    }
    if (mods.corruptedBloodDamage > 0) {
      for (const unitId of mutationEncounterRef.current.corruptedBloodUnits) {
        const unit = getUnitById(squadRef.current, unitId);
        if (!unit?.unitId || !isUnitAlive(unit)) continue;
        hurtEnemy(mods.corruptedBloodDamage, '[CORRUPTED BLOOD]', undefined, {
          channel: 'OCCULT',
          targetId: unit.unitId,
          indirectDamage: true,
        });
        log(`[CORRUPTED BLOOD] >> ${unit.designation} — void bleed.`);
      }
    }
    const trapped = mutationEncounterRef.current.tarTrappedUnits;
    for (const [unitId, turns] of Object.entries(trapped)) {
      if (turns <= 1) {
        delete trapped[unitId];
      } else {
        trapped[unitId] = turns - 1;
      }
    }
    if (mutationEncounterRef.current.veilTarTurnsRemaining > 0) {
      for (const unit of aliveUnits(squadRef.current)) {
        if (!unit.unitId) continue;
        patchUnit(unit.unitId, {
          evadeChance: 0,
          evadeActive: false,
          enemyActionPoints: 0,
        });
      }
      log(`>> VEIL-TAR HAZARD — hostiles rooted (${mutationEncounterRef.current.veilTarTurnsRemaining} turn(s) left).`);
    }
    const bleedUnits = mutationEncounterRef.current.reaveBleedUnits;
    for (const [unitId, turns] of Object.entries({ ...bleedUnits })) {
      const unit = getUnitById(squadRef.current, unitId);
      if (!unit?.unitId || !isUnitAlive(unit)) {
        delete bleedUnits[unitId];
        continue;
      }
      hurtEnemy(8, '[REAVE BLEED]', undefined, {
        channel: 'KINETIC',
        targetId: unit.unitId,
        rollCrit: false,
        indirectDamage: true,
      });
      if (turns <= 1) {
        delete bleedUnits[unitId];
      } else {
        bleedUnits[unitId] = turns - 1;
      }
      log(`[REAVE BLEED] >> ${unit.designation} — jagged debris (${bleedUnits[unitId] ?? 0} turn(s) left).`);
    }
    classCombatRef.current.bleedingPayloadTurns = applyBleedingPayloadDot(
      squadRef.current,
      classCombatRef.current.bleedingPayloadTurns,
      (raw, tag, options, targetId) => hurtEnemy(raw, tag, undefined, {
        channel: options?.channel ?? 'OCCULT',
        targetId: options?.targetId ?? targetId,
        rollCrit: options?.rollCrit,
        indirectDamage: true,
      }),
      log,
    );
    classBoonEncounterRef.current.voidBleedTurns = applyVoidBleedDot(
      squadRef.current,
      classBoonEncounterRef.current.voidBleedTurns,
      (raw, tag, targetId) => hurtEnemy(raw, tag, undefined, {
        channel: 'OCCULT',
        targetId,
        rollCrit: false,
        indirectDamage: true,
      }),
      log,
    );
    classBoonEncounterRef.current.chemicalWarfareTurns = tickHexShotChemicalWarfare(
      squadRef.current,
      classBoonEncounterRef.current.chemicalWarfareTurns,
      patchUnit,
      log,
    );
  };

  const applyEviscerateAftermath = () => {
    const mods = mutationModsRef.current;
    abyssalRef.current = 0;
    setAbyssalReserve(0);
    setRunicBrands(0);
    classCombatRef.current.runicBrands = 0;
    setSuccessfulParryCount(0);
    classCombatRef.current.successfulParryCount = 0;
    for (const unit of aliveUnits(squadRef.current)) {
      if (!unit.unitId) continue;
      patchUnit(unit.unitId, {
        kineticArmor: 0,
        occultWards: 0,
        baseKineticArmor: 0,
        baseOccultWards: 0,
      });
      if (mods.corruptedBloodDamage > 0) {
        mutationEncounterRef.current.corruptedBloodUnits.add(unit.unitId);
      }
    }
    if (mods.corruptedBloodDamage > 0) {
      log('[CORRUPTED BLOOD] >> Survivors marked for void bleed.');
    }
    log(`[${ABYSSAL_VERDICT_DISPLAY_NAME}] >> Reserve vented — survivor armor shattered.`);
  };

  const applyTetanusGlitch = () => {
    if (!env.hasTetanusGlitch) return;
    log('[TETANUS GLITCH] >> Soul Anchor hemorrhage — 3 HP lost on exhaustion.');
    Vibration.vibrate([0, 32, 48, 28]);
    setOperativeHp((p) => {
      const n = Math.max(p - 3, 0);
      operativeHpRef.current = n;
      if (n <= 0) resolve(false);
      return n;
    });
  };

  const markExhausted = () => {
    skipRegenRef.current = true;
    applyStamina(0);
    applyTetanusGlitch();
  };
  const adjustedStaminaCost = (cost: number) => {
    const reduction = 0;
    let adjusted = cost;
    if (reduction > 0) {
      adjusted = Math.max(1, Math.floor(cost * (1 - reduction / 100)));
    }
    const staticMult = resolveStaticCallerMeleeStaminaMultiplier(squadRef.current);
    adjusted = Math.max(0, Math.floor(adjusted * staticMult));
    return adjusted + rivalHexedStaminaTax(sessionExtrasRef.current);
  };

  const spendActionPoints = (cost: number): boolean => {
    if (playerApRef.current < cost) return false;
    const next = playerApRef.current - cost;
    playerApRef.current = next;
    setPlayerActionPoints(next);
    return true;
  };

  const spendStam = (cost: number, overdraw = false): boolean => {
    const effectiveCost = adjustedStaminaCost(cost);
    if (staminaRef.current < effectiveCost) {
      if (!overdraw) return false;
      markExhausted();
      return true;
    }
    const n = applyStamina(staminaRef.current - effectiveCost);
    if (hasStructuredDebuff(sessionExtrasRef.current, 'HEXED') && cost > 0) {
      consumeRivalHexedDebuff(sessionExtrasRef.current);
      log('>> HEXED — curse lifted after ability use.');
    }
    if (n <= 0) {
      skipRegenRef.current = true;
      applyTetanusGlitch();
    }
    return true;
  };

  const attackDmg = (e: EnemyCombatProfile) => {
    const resonantMult = resolveResonantOutgoingDamageMultiplier(
      encounterModifierRuntimeRef.current?.modifierId,
    );
    const huskMult = resolveAnchorHuskAllyDamageMultiplier(squadRef.current, e.unitId);
    let tarMult = resolveTarChoirOutgoingDamageMultiplier(depthVariantRuntimeRef.current);
    if (tarMult > 1 && e.isVeilEntity) {
      depthVariantRuntimeRef.current = consumeTarChoirMark(depthVariantRuntimeRef.current);
    } else {
      tarMult = 1;
    }
    const combo = resonantMult * huskMult * tarMult;
    if (e.intent === 'WORLD_ENDER') {
      return { dmg: Math.floor(e.baseDamage * 2.5 * combo), unblockable: true };
    }
    if (isRosterSpecificIntent(e.intent) || e.rosterId === 'echoing-brute') {
      return {
        dmg: Math.floor(resolveRosterEnemyDamage(e, e.intent) * combo),
        unblockable: false,
      };
    }
    return { dmg: Math.floor(e.baseDamage * combo), unblockable: false };
  };

  const applyFractureHoundShieldDrain = (attacker: EnemyCombatProfile) => {
    if (attacker.rosterId !== 'fracture-hound' || attacker.isEnraged) return;
    const extras = sessionExtrasRef.current;
    if (extras.playerShield <= 0) return;
    const drainAmt = getAlphaMechanic(
      attacker,
      'shieldDamage',
      ROSTER_AI_WEIGHTS.FRACTURE_HOUND_SHIELD_DRAIN,
    );
    const drain = Math.min(extras.playerShield, drainAmt);
    extras.playerShield -= drain;
    log(`>> FRACTURE HOUND — ${drain} shield integrity siphoned.`);
  };

  const applyStaminaDrainLeap = (attacker: EnemyCombatProfile) => {
    const drain = getAlphaMechanic(attacker, 'staminaDrain', 20);
    const beforeStamina = staminaRef.current;
    applyStamina(beforeStamina - drain);
    log(`>> ${attacker.designation} STAMINA DRAIN LEAP — stamina siphoned (-${drain}).`);
    if (getAlphaMechanic(attacker, 'appliesBleed', false)) {
      if (!sessionExtrasRef.current.playerDebuffs.includes('BLEEDING')) {
        sessionExtrasRef.current.playerDebuffs = [
          ...sessionExtrasRef.current.playerDebuffs,
          'BLEEDING',
        ];
      }
      log('>> PLAGUE SWARM — operative bleeding.');
    }
    if (beforeStamina > 0 && staminaRef.current <= 0) {
      sessionExtrasRef.current.playerApPenaltyNextTurn += 1;
      log('>> MIASMA FATIGUE — operative AP reduced next turn.');
    }
  };

  const closeVoidAmbushWindow = () => {
    voidAmbushWindowRef.current = null;
    setIsPlayerTurn(false);
  };

  const finalizeNullShadeVoidAmbush = (enemy: EnemyCombatProfile) => {
    if (!enemy.unitId || enemy.rosterId !== 'null-shade' || enemy.intent !== 'VOID_AMBUSH') return;
    patchUnit(enemy.unitId, nullShadeVoidAmbushCleanupPatch(enemy));
    publishSquadUi(squadRef.current);
  };

  const interruptVoidAmbush = (unitId: string) => {
    if (!voidAmbushWindowRef.current || voidAmbushWindowRef.current.unitId !== unitId) return;

    if (enemyTurnTimerRef.current) {
      clearTimeout(enemyTurnTimerRef.current);
      enemyTurnTimerRef.current = null;
    }
    if (enemyStrikeTimerRef.current) {
      clearTimeout(enemyStrikeTimerRef.current);
      enemyStrikeTimerRef.current = null;
    }

    closeVoidAmbushWindow();
    setEnemyActionStage(null);

    const shade = getUnitById(squadRef.current, unitId);
    if (shade?.unitId && isUnitAlive(shade)) {
      patchUnit(shade.unitId, {
        ...nullShadeVoidAmbushCleanupPatch({ ...shade, intent: 'VOID_AMBUSH' }),
        intent: 'STRIKE',
      });
    }

    log(`>> VOID AMBUSH INTERRUPTED — ${VOID_AMBUSH_INTERRUPT_THRESHOLD}+ damage dealt. Shade forced material.`);

    if (enemyActionQueueRef.current[0] === unitId) {
      enemyActionQueueRef.current.shift();
    }

    publishSquadUi(squadRef.current);

    if (enemyActionQueueRef.current.length > 0) {
      scheduleNextEnemyAction(false);
    } else if (allUnitsDefeated(squadRef.current)) {
      scheduleCombatVictoryResolution();
    } else {
      endEnemyTurn(true);
    }
  };

  const scheduleNextEnemyAction = (countering: boolean) => {
    if (isCombatTerminal() || enemyActionQueueRef.current.length === 0) return;
    if (isHitstopActive() || combatPausedRef.current) {
      setTimeout(() => scheduleNextEnemyAction(countering), 50);
      return;
    }
    if (enemyTurnGapTimerRef.current) {
      clearTimeout(enemyTurnGapTimerRef.current);
    }
    enemyTurnGapTimerRef.current = setTimeout(() => {
      enemyTurnGapTimerRef.current = null;
      if (isCombatTerminal()) return;
      runEnemyActionAnimation(countering);
    }, ENEMY_TURN_GAP_MS);
  };

  const trackVoidAmbushInterruptDamage = (unitId: string, hpDamage: number) => {
    const window = voidAmbushWindowRef.current;
    if (!window || window.unitId !== unitId || hpDamage <= 0) return;
    window.damageDealt += hpDamage;
    if (window.damageDealt >= VOID_AMBUSH_INTERRUPT_THRESHOLD) {
      setTimeout(() => interruptVoidAmbush(unitId), 0);
    }
  };

  const execIntent = (e: EnemyCombatProfile) => {
    const intent = resolveEffectiveEnemyIntent(e);
    const blindPenalty = getEnemyAccuracyPenalty(e, sessionExtrasRef.current);
    if (blindPenalty > 0 && isAttackIntent(intent) && Math.random() < blindPenalty) {
      log(`>> ${e.designation} BLINDED — attack whiffed (−${Math.round(blindPenalty * 100)}% accuracy).`);
      return;
    }
    if (e.isBoss && bossRuntimeRef.current) {
      const phase = bossPhaseRef.current;
      if (intent === 'OVERDRIVE_DISCHARGE') {
        const dmg = bossStrikeDamage(bossRuntimeRef.current, phase);
        log(`>> ${e.designation} OVERDRIVE DISCHARGE — ${dmg} DMG`);
        hurtPlayer(dmg, !counterRef.current, `>> OVERDRIVE HIT — ${dmg}`, { attacker: e, rollCrit: false });
        return;
      }
      const dmg = bossStrikeDamage(bossRuntimeRef.current, phase);
      hurtPlayer(dmg, false, `>> ${e.designation} STRIKES — ${dmg}`, { attacker: e, rollCrit: false });
      return;
    }
    switch (intent) {
      case 'STRIKE': {
        let { dmg, unblockable } = attackDmg(e);
        const reaverFx = resolveReaverAttackDamage(e, dmg);
        dmg = reaverFx.damage;
        reaverFx.logLines.forEach((line) => log(line));
        if (e.unitId && Object.keys(reaverFx.patch).length > 0) {
          patchUnit(e.unitId, reaverFx.patch);
        }
        if (reaverFx.guardBreakStamina > 0) {
          applyStamina(staminaRef.current - reaverFx.guardBreakStamina);
        }
        if (e.rosterId === 'rival-hexer') {
          log(applyRivalHexMark(sessionExtrasRef.current));
        }
        if (e.rosterId === 'fracture-hound' && !e.isEnraged) applyFractureHoundShieldDrain(e);
        if (e.rosterId === 'breacher') {
          const staminaShred = getAlphaMechanic(e, 'concussiveDamageToStamina', BREACHER_STAMINA_DRAIN);
          applyStamina(staminaRef.current - staminaShred);
          log(`>> ${e.designation} BREACH STRIKE — ${staminaShred} stamina shredded (${dmg} HP).`);
          hurtPlayer(dmg, unblockable, `>> BREACH STRIKE — ${dmg}`, { attacker: e, rollCrit: false });
          break;
        }
        hurtPlayer(dmg, unblockable, `>> ${e.designation} STRIKES — ${dmg}`, { attacker: e });
        break;
      }
      case 'WORLD_ENDER': {
        const { dmg } = attackDmg(e);
        log(`>> ${e.designation} WORLD-ENDER — ${dmg} UNBLOCKABLE`);
        hurtPlayer(dmg, true, undefined, { attacker: e, rollCrit: false });
        break;
      }
      case 'STRIP_STAMINA':
        log(`>> ${e.designation} STRIPS STAMINA (-20).`);
        applyStamina(staminaRef.current - 20);
        break;
      case 'SIPHON_ABYSSAL': {
        const { nextAbyssal, siphoned } = applyAbyssalSiphon(
          abyssalRef.current,
          ENEMY_ABYSSAL_SIPHON_REQUEST,
        );
        log(formatAbyssalSiphonLog(e.designation, ENEMY_ABYSSAL_SIPHON_REQUEST, siphoned));
        abyssalRef.current = nextAbyssal;
        setAbyssalReserve(nextAbyssal);
        break;
      }
      case 'EVADE':
        log(`>> ${e.designation} EVADE posture — +50% miss chance vs operative strikes (2 turns).`);
        if (e.unitId) {
          patchUnit(e.unitId, { evadeActive: true, evadeTurnsRemaining: 2 });
          publishSquadUi(squadRef.current);
        }
        break;
      case 'FORTIFY': {
        log(`>> ${e.designation} FORTIFY — kinetic shell hardened (2 turns).`);
        if (e.unitId) {
          patchUnit(e.unitId, { fortifyTurnsRemaining: 2 });
          publishSquadUi(squadRef.current);
        }
        break;
      }
      case 'FIELD_REPAIR': {
        if (!e.unitId) break;
        const district = fixerDistrictFromProfile(e);
        const healAmt = rollFixerRepairAmount(district);
        if (e.fixerAoEHeal) {
          let healedAny = false;
          for (const ally of aliveUnits(squadRef.current)) {
            if (ally.unitId === e.unitId || ally.currentHp >= ally.maxHp) continue;
            if (isEnemyHealBlocked(classCombatRef.current, ally.unitId!, false)) {
              continue;
            }
            const pct = e.alphaMechanics?.healPercent ?? 0.15;
            const amount = Math.max(1, Math.floor(ally.maxHp * pct));
            const healed = Math.min(ally.maxHp, ally.currentHp + amount);
            const applied = healed - ally.currentHp;
            if (applied <= 0) continue;
            patchUnit(ally.unitId!, { currentHp: healed });
            statusFloatSeqRef.current[ally.unitId!] = (statusFloatSeqRef.current[ally.unitId!] ?? 0) + 1;
            healedAny = true;
            log(`>> ${e.designation} FIELD REPAIR — ${ally.designation} +${applied} HP (board heal).`);
          }
          if (healedAny) publishSquadUi(squadRef.current);
          else log(`>> ${e.designation} FIELD REPAIR — no valid targets.`);
          break;
        }
        const target = fixerRepairTarget(squadRef.current, e.unitId);
        if (!target?.unitId || target.currentHp >= target.maxHp) {
          log(`>> ${e.designation} FIELD REPAIR — no valid target.`);
          break;
        }
        if (isEnemyHealBlocked(classCombatRef.current, target.unitId, false)) {
          log(`>> ${e.designation} FIELD REPAIR BLOCKED — ${target.designation} flesh-warped.`);
          break;
        }
        const healed = Math.min(target.maxHp, target.currentHp + healAmt);
        const applied = healed - target.currentHp;
        patchUnit(target.unitId, { currentHp: healed });
        statusFloatSeqRef.current[target.unitId] = (statusFloatSeqRef.current[target.unitId] ?? 0) + 1;
        publishSquadUi(squadRef.current);
        log(`>> ${e.designation} FIELD REPAIR — ${target.designation} +${applied} HP (D${district}).`);
        break;
      }
      case 'CHARGE': log(`>> ${e.designation} CHARGING world-ender (${e.chargeTurns + 1}/3).`); break;
      case 'PAVEMENT_CRUSHER_CHARGE':
        log(`>> ${e.designation} PAVEMENT CRUSHER CHARGE — structural wind-up engaged.`);
        break;
      case 'PAVEMENT_CRUSHER': {
        const dmg = resolveRosterEnemyDamage(e, 'PAVEMENT_CRUSHER');
        log(`>> ${e.designation} PAVEMENT CRUSHER — ${dmg} kinetic rupture.`);
        hurtPlayer(dmg, true, `>> PAVEMENT CRUSHER — ${dmg}`, { attacker: e, rollCrit: false });
        break;
      }
      case 'OCCULT_TETHER': {
        const tether = applyLeySirenTetherAction(squadRef.current, e);
        syncSquad(tether.squad);
        sessionExtrasRef.current = {
          ...sessionExtrasRef.current,
          leySirenTetheredUnitIds: tether.tetheredIds,
          leySirenSourceUnitId: e.unitId ?? null,
        };
        tether.logLines.forEach((line) => log(line));
        break;
      }
      case 'SWARM_BITE':
        applyStaminaDrainLeap(e);
        break;
      case 'STAMINA_DRAIN_LEAP':
        applyStaminaDrainLeap(e);
        break;
      case 'DOUBLE_STRIKE': {
        const dmg = resolveRosterEnemyDamage(e, 'DOUBLE_STRIKE');
        const strikeCount = e.rosterId === 'fracture-hound'
          ? getAlphaMechanic(e, 'attacksPerTurn', 2)
          : 2;
        if (e.isEnraged) {
          log(`>> ${e.designation} DOUBLE STRIKE — enraged true occult cleave.`);
          for (let i = 0; i < strikeCount && operativeHpRef.current > 0; i += 1) {
            hurtPlayer(dmg, true, `>> DOUBLE STRIKE ${i + 1} — ${dmg} TRUE OCCULT`, { attacker: e, rollCrit: false });
          }
        } else {
          if (e.rosterId === 'fracture-hound') applyFractureHoundShieldDrain(e);
          log(`>> ${e.designation} DOUBLE STRIKE — ${strikeCount > 2 ? 'rabid flurry' : 'twin cleave'}.`);
          for (let i = 0; i < strikeCount && operativeHpRef.current > 0; i += 1) {
            hurtPlayer(
              dmg,
              false,
              `>> DOUBLE STRIKE ${i + 1} — ${dmg}`,
              { attacker: e, rollCrit: i > 0 ? false : undefined },
            );
          }
        }
        break;
      }
      case 'VEIL_STATIC':
        sessionExtrasRef.current = {
          ...sessionExtrasRef.current,
          playerApCapNextTurn: 2,
        };
        log(`>> ${e.designation} VEIL STATIC — operative AP capped next turn (2/3).`);
        break;
      case 'PREMATURE_IGNITION': {
        log(`>> ${e.designation} PREMATURE IGNITION — occult backlash imminent.`);
        if (e.unitId) {
          pendingDissolveRef.current = { unitId: e.unitId, profile: e, hp: 0 };
          retributionParryRef.current = { unitId: e.unitId, occultDamage: 15 };
          pendingDmgRef.current = 15;
          pendingUnblockRef.current = false;
          cycleRef.current = 'DEFEND_PARRY';
          setCycleState('DEFEND_PARRY');
          startParryRing();
          patchUnit(e.unitId, syncRosterCombatState({ ...e, currentHp: 0 }));
        }
        break;
      }
      case 'RESONANCE_OVERLOAD': {
        const dmg = resolveRosterEnemyDamage(e, 'RESONANCE_OVERLOAD');
        log(`>> ${e.designation} RESONANCE OVERLOAD — dual-channel rupture.`);
        hurtPlayer(dmg, false, `>> RESONANCE KINETIC — ${dmg}`, { attacker: e });
        if (operativeHpRef.current > 0) {
          hurtPlayer(dmg, false, `>> RESONANCE OCCULT — ${dmg}`, { attacker: e, rollCrit: false });
        }
        break;
      }
      case 'SINKING_INTO_GRID':
        log(`>> ${e.designation} SINKING INTO THE GRID — physical targeting suppressed.`);
        break;
      case 'VOID_AMBUSH': {
        const base = resolveRosterEnemyDamage(e, 'VOID_AMBUSH');
        const critRoll = Math.random() < VOID_AMBUSH_CRIT_CHANCE;
        const dmg = critRoll ? applyCritMultiplier(base, COMBAT_CHANCE.CRIT_DAMAGE_MULTIPLIER) : base;
        log(`>> ${e.designation} VOID AMBUSH — ${critRoll ? 'CRITICAL ' : ''}${dmg} occult rupture.`);
        hurtPlayer(dmg, false, `>> VOID AMBUSH — ${dmg}`, { attacker: e, rollCrit: false });
        if (e.unitId) {
          patchUnit(e.unitId, nullShadeVoidAmbushCleanupPatch(e));
          publishSquadUi(squadRef.current);
        }
        break;
      }
      case 'KINETIC_AFTERSHOCK': {
        const dmg = resolveRosterEnemyDamage(e, 'STRIKE');
        log(`>> ${e.designation} KINETIC AFTERSHOCK — ${dmg} impact + echo primed.`);
        hurtPlayer(dmg, false, `>> KINETIC AFTERSHOCK — ${dmg}`, { attacker: e });
        addStructuredDebuff(sessionExtrasRef.current, {
          type: 'ECHO_DEBUFF',
          amount: dmg,
          turnsRemaining: 1,
        });
        break;
      }
      case 'SCAVENGE': {
        if (!e.unitId) break;
        consumeAshToken();
        if (isEnemyHealBlocked(classCombatRef.current, e.unitId, false)) {
          log(`>> ${e.designation} SCAVENGE BLOCKED — flesh-warp seal.`);
          break;
        }
        const healAmt = Math.max(1, Math.floor(e.maxHp * 0.2));
        const healed = Math.min(e.maxHp, e.currentHp + healAmt);
        patchUnit(e.unitId, { currentHp: healed });
        statusFloatSeqRef.current[e.unitId] = (statusFloatSeqRef.current[e.unitId] ?? 0) + 1;
        publishSquadUi(squadRef.current);
        log(`>> ${e.designation} SCAVENGES ASH — +${healed - e.currentHp} HP.`);
        break;
      }
      case 'SENSORY_JAM': {
        const jamTurns = Math.random() < 0.5 ? 1 : 2;
        addStructuredDebuff(sessionExtrasRef.current, {
          type: 'SENSORY_JAMMED',
          turnsRemaining: jamTurns,
        });
        log(`>> ${e.designation} SENSORY JAM — hostile intents obscured (${jamTurns} turn${jamTurns > 1 ? 's' : ''}).`);
        break;
      }
      case 'HEX_MARK': {
        log(applyRivalHexMark(sessionExtrasRef.current));
        break;
      }
      case 'BINDING_WARD': {
        const ward = applyBindingWardToAlly(squadRef.current, e);
        if (ward.logLine) log(ward.logLine);
        if (ward.squad.length > 0) syncSquad(ward.squad);
        break;
      }
      case 'VEIL_BARRIER': {
        const isAoeBarrier = getAlphaMechanic<string>(e, 'shieldCastTarget', 'SINGLE') === 'AOE';
        const charges = 2;
        if (isAoeBarrier) {
          for (const ally of aliveUnits(squadRef.current)) {
            if (!ally.unitId) continue;
            patchUnit(ally.unitId, { veilBarrierCharges: charges });
          }
          log(`>> ${e.designation} VEIL BARRIER — board-wide ${charges} hit charges.`);
        } else if (e.unitId) {
          patchUnit(e.unitId, { veilBarrierCharges: charges });
          log(`>> ${e.designation} VEIL BARRIER — ${charges} hit charges active.`);
        }
        break;
      }
      case 'TARGET_LOCK': {
        addStructuredDebuff(sessionExtrasRef.current, {
          type: 'TARGET_LOCKED',
          turnsRemaining: 2,
        });
        if (e.unitId && e.rosterId === 'spotter') {
          patchUnit(e.unitId, { spotterLockedOn: true, isCharging: true });
        }
        log(`>> ${e.designation} LOCKED ON — artillery primed.`);
        break;
      }
      case 'ASHEN_ROT': {
        addStructuredDebuff(sessionExtrasRef.current, {
          type: 'ASHEN_ROT',
          turnsRemaining: 2,
        });
        log(`>> ${e.designation} ASHEN ROT — buff/defend actions cost stamina.`);
        break;
      }
      case 'ARTILLERY_CHARGE':
        if (e.rosterId === 'coil-spike-sniper' && (e.laserLockTurnsRemaining ?? 0) > 0) {
          log(`>> ${e.designation} CHARGING TRUE SHOT — ${e.laserLockTurnsRemaining} cycle(s) remaining.`);
        } else {
          log(`>> ${e.designation} ARTILLERY CHARGE — ordnance priming.`);
        }
        break;
      case 'LASER_SIGHT': {
        const lockTurns = e.rosterId === 'coil-spike-sniper'
          ? getAlphaMechanic(e, 'lockOnTurns', 2)
          : 1;
        addStructuredDebuff(sessionExtrasRef.current, {
          type: 'LASER_SIGHT',
          turnsRemaining: lockTurns,
        });
        log(
          e.rosterId === 'coil-spike-sniper' && lockTurns > 1
            ? `>> ${e.designation} LASER SIGHT — true damage lock acquired (${lockTurns}-turn wind-up).`
            : `>> ${e.designation} LASER SIGHT — true damage lock acquired.`,
        );
        break;
      }
      case 'ARTILLERY_FIRE': {
        const isSapper = e.rosterId === 'sapper';
        const isSniper = e.rosterId === 'coil-spike-sniper' || e.rosterId === 'rift-spike-sniper';
        const isSpotter = e.rosterId === 'spotter';
        const dmg = isSpotter ? SPOTTER_ARTILLERY_TRUE_DAMAGE : resolveRosterEnemyDamage(e, 'ARTILLERY_FIRE');
        if (isSpotter && e.unitId) {
          patchUnit(e.unitId, { spotterLockedOn: false, isCharging: false });
        }
        if (isSapper) {
          sessionExtrasRef.current.playerShield = 0;
          sessionExtrasRef.current.playerShieldTurnsRemaining = 0;
          log(`>> ${e.designation} BUNKER BUSTER — shields stripped, ${dmg} unblockable.`);
          hurtPlayer(dmg, true, `>> BUNKER BUSTER — ${dmg}`, { attacker: e, rollCrit: false });
        } else if (isSniper) {
          log(`>> ${e.designation} TRUE SHOT — ${dmg} (armor bypassed).`);
          hurtPlayer(dmg, true, `>> TRUE SHOT — ${dmg}`, { attacker: e, rollCrit: false });
        } else if (isSpotter) {
          log(`>> ${e.designation} ARTILLERY BURST — ${dmg} TRUE.`);
          hurtPlayer(dmg, true, `>> ARTILLERY BURST — ${dmg}`, { attacker: e, rollCrit: false });
        } else if (e.rosterId === 'splinter') {
          const chip = Math.max(4, Math.floor(dmg * 0.35));
          hurtPlayer(chip, false, `>> SEARING LASER — ${chip}`, { attacker: e });
          addStructuredDebuff(sessionExtrasRef.current, {
            type: 'SEARING',
            turnsRemaining: 3,
          });
          log(`>> ${e.designation} SEARING MARK applied.`);
        } else {
          log(`>> ${e.designation} ARTILLERY FIRE — ${dmg}.`);
          hurtPlayer(dmg, false, `>> ARTILLERY — ${dmg}`, { attacker: e });
        }
        break;
      }
      case 'TAR_BIND': {
        const dmg = resolveRosterEnemyDamage(e, 'TAR_BIND');
        const rootDuration = getAlphaMechanic(e, 'rootDuration', 1);
        hurtPlayer(dmg, false, `>> TAR BIND — ${dmg}`, { attacker: e });
        addStructuredDebuff(sessionExtrasRef.current, {
          type: 'ROOTED',
          turnsRemaining: rootDuration,
        });
        log(`>> ${e.designation} ROOTED — defend/evade disabled (${rootDuration} turn${rootDuration > 1 ? 's' : ''}).`);
        if (e.rosterId === 'tar-choir') {
          const marked = markTarChoirOnHit(depthVariantRuntimeRef.current, e.rosterId);
          depthVariantRuntimeRef.current = marked.runtime;
          if (marked.logLine) log(marked.logLine);
        }
        break;
      }
      case 'STAMINA_TETHER': {
        const tether = applyHookWeaverTetherAction(squadRef.current, e);
        syncSquad(tether.squad);
        sessionExtrasRef.current = {
          ...sessionExtrasRef.current,
          hookWeaverTetheredUnitId: tether.tetheredId,
        };
        tether.logLines.forEach((line) => log(line));
        break;
      }
      case 'JAM_AUGMENT': {
        const slotCount = getAlphaMechanic(e, 'disabledAugmentCount', 1);
        const duration = getAlphaMechanic(e, 'disableDuration', 2);
        const slots: number[] = [];
        while (slots.length < Math.min(slotCount, 3)) {
          const slot = Math.floor(Math.random() * 3);
          if (!slots.includes(slot)) slots.push(slot);
        }
        sessionExtrasRef.current = {
          ...sessionExtrasRef.current,
          jammedAugmentSlot: slots[0] ?? null,
          jammedAugmentSlots: slots,
        };
        addStructuredDebuff(sessionExtrasRef.current, {
          type: 'JAMMED_AUGMENT',
          turnsRemaining: duration,
        });
        log(`>> ${e.designation} JAMMED AUGMENT — loadout slot(s) ${slots.map((s) => s + 1).join(', ')} disabled (${duration} turn${duration > 1 ? 's' : ''}).`);
        break;
      }
      default: break;
    }
    const rosterPatch = patchRosterAfterIntentExec(e, intent);
    if (e.unitId && Object.keys(rosterPatch).length > 0 && intent !== 'VOID_AMBUSH') {
      patchUnit(e.unitId, rosterPatch);
    }
  };

  const endEnemyTurn = (advanceIntent = true) => {
    if (isCombatTerminal()) return;
    if (operativeHpRef.current <= 0) return;
    if (allUnitsDefeated(squadRef.current)) {
      scheduleCombatVictoryResolution();
      return;
    }
    if (encounterModifierRuntimeRef.current) {
      const bleedPulse = resolveBleedingCyclePulse(encounterModifierRuntimeRef.current);
      encounterModifierRuntimeRef.current = bleedPulse.runtime;
      if (bleedPulse.damage > 0) {
        if (bleedPulse.logLine) log(bleedPulse.logLine);
        hurtPlayer(bleedPulse.damage, true, bleedPulse.logLine ?? undefined, { rollEvade: false, rollCrit: false });
        if (operativeHpRef.current <= 0) return;
      }
    }
    if (mutationEncounterRef.current.veilTarTurnsRemaining > 0) {
      mutationEncounterRef.current.veilTarTurnsRemaining -= 1;
    }
    if (env.combatObjective === 'SURVIVE_TURNS') {
      survivedEnemyTurnsRef.current += 1;
      const required = env.survivalTurnsRequired ?? 3;
      log(`>> RIFT DEFENSE — hostile cycle ${survivedEnemyTurnsRef.current}/${required} endured.`);
      applyObjectiveProgress(progressObjectiveOnEnemyTurnEnd(objectiveSessionRef.current));
      if (survivedEnemyTurnsRef.current >= required) {
        resolve(true);
        return;
      }
      if (resolutionRef.current != null) return;
    } else {
      applyObjectiveProgress(progressObjectiveOnEnemyTurnEnd(objectiveSessionRef.current));
      if (resolutionRef.current != null) return;
    }
    if (advanceIntent) {
      const combatRound = Math.max(1, balanceEncounterRef.current.playerTurns);
      const livingCount = aliveUnits(squadRef.current).length;
      syncSquad(squadRef.current.map((unit) => {
        if (!isUnitAlive(unit)) return unit;
        if (unit.isBoss && bossRuntimeRef.current) {
          const phase = bossPhaseRef.current;
          const nextIntent = rollBossIntent(phase);
          return { ...unit, intent: nextIntent, bossPhase: phase };
        }
        return advanceEnemyIntent(
          unit,
          combatDistrict,
          buildPlayerAIState(),
          squadRef.current,
          {
            hasAshToken: hasAshOnBoard(),
            combatRound,
            isLastEnemyAlive: livingCount <= 1,
          },
        );
      }).map((unit) => {
        if (isUnitAlive(unit)) {
          recordIntentGenerated(intentTelemetryRef.current, unit.intent, {
            depth: combatDistrict,
          });
        }
        return unit;
      }));
      const warning = aliveUnits(squadRef.current)
        .map((u) => formatIntentWarningBanner(u.intent, u))
        .find((w) => w != null) ?? null;
      if (warning) {
        setPhaseAlert(`>> INTENT ALERT — ${warning}`);
        log(`>> INTENT ALERT — ${warning}`);
        setTimeout(() => setPhaseAlert(null), 2200);
      }
    }
    if (advanceIntent && aliveUnits(squadRef.current).some((unit) => isEnemyFractured(unit))) {
      syncSquad(recoverFracturedUnits(squadRef.current));
      log('>> FRACTURED HOSTILES — armor layers rebuilding.');
    }
    enemyActionQueueRef.current = [];
    rabidFlurryExpandedRef.current = new Set();
    if (operativeClass === 'ENVOY') {
      tickVeilRotEndOfEnemyTurn(
        squadRef.current,
        classCombatRef.current,
        (raw, tag, options, targetId) => hurtEnemy(raw, tag, 'STRIKE', {
          channel: options?.channel ?? 'OCCULT',
          targetId: options?.targetId ?? targetId,
          rollCrit: options?.rollCrit,
          indirectDamage: true,
        }),
        log,
      );
    }
    const nextTarget = nextDefaultTarget(squadRef.current);
    if (nextTarget) selectTarget(nextTarget);
    if (hollowLungsActive(squadRef.current)) {
      const breath = applyAshenBreathDebt(
        sessionExtrasRef.current,
        combatMaxSoulAnchorRef.current,
      );
      log(breath.logLine);
      setPlayerMaxAnchorDebt(sessionExtrasRef.current.playerMaxHpDebt);
      setOperativeHp((prev) => {
        const next = clampPlayerHpToEffectiveMax(
          prev,
          sessionExtrasRef.current,
          combatMaxSoulAnchorRef.current,
        );
        operativeHpRef.current = next;
        return next;
      });
    }
    startPlayerTurn(primaryAliveUnit(squadRef.current)!);
  };

  const startPlayerTurn = (_e: EnemyCombatProfile) => {
    if (isCombatTerminal()) return;
    balanceEncounterRef.current.playerTurns += 1;
    lifecycleFloatLabelsRef.current = {};
    lifecycleFloatTonesRef.current = {};
    sessionExtrasRef.current.reaverDamagedThisPlayerTurn = false;
    setOperativeHp((prev) => {
      const next = clampPlayerHpToEffectiveMax(
        prev,
        sessionExtrasRef.current,
        combatMaxSoulAnchorRef.current,
      );
      operativeHpRef.current = next;
      return next;
    });
    tickCombatSessionExtras(sessionExtrasRef.current);
    combatChanceRef.current.shadowStepEvadeActive = false;
    if (staminaRef.current > 0 || (operativeClass === 'AEGIS' && abyssalRef.current > 0)) {
      combatChanceRef.current.momentumShiftEvadeDisabled = false;
    }
    clearVoidWardShroud();
    if (combatBuffRef.current.ashenMantleTurnsRemaining > 0) {
      combatBuffRef.current.ashenMantleTurnsRemaining -= 1;
      const mantleActive = combatBuffRef.current.ashenMantleTurnsRemaining > 0;
      setAbyssalWardActive(mantleActive);
      if (!mantleActive && mutationEncounterRef.current.spallShatterPending > 0) {
        const burst = mutationEncounterRef.current.spallShatterPending;
        mutationEncounterRef.current.spallShatterPending = 0;
        triggerSpallShatterBurst(burst);
      }
    }
    bloodBoundCarapaceRef.current = false;
    riftWardReadyRef.current = operativeClass === 'ENVOY';
    if (operativeClass === 'ENVOY') {
      applyPlayerTurnBlueprintHooks();
      const fluxRestore = Math.round(envoyCombatStateRef.current.fluxMaxCap * 0.15);
      if (fluxRestore > 0) {
        applyVeilFlux(fluxRestore);
        log('[VEIL FLUX] >> Operative siphon — +15% flux restored.');
      }
      const rotInfectedCount = aliveUnits(squadRef.current).filter(
        (u) => u.unitId && (classCombatRef.current.veilRotStacks[u.unitId] ?? 0) > 0,
      ).length;
      runEnvoyTurnStartBoons(
        envoyBoons,
        rotInfectedCount,
        log,
        (amount) => {
          setOperativeHp((p) => {
            const n = Math.min(maxSoulAnchor, p + amount);
            operativeHpRef.current = n;
            return n;
          });
        },
      );
    }
    if (combatBuffRef.current.demonLungCooldown > 0) {
      combatBuffRef.current.demonLungCooldown -= 1;
    }
    const runItemTurn = notifyRunItemPlayerTurnStart();
    const pendingStaminaCrash = Math.max(
      runItemTurn.staminaLoss,
      runItemCombatFlagsRef.current.staminaLossNextTurn,
    );
    runItemCombatFlagsRef.current.staminaLossNextTurn = 0;
    if (pendingStaminaCrash > 0) {
      applyStamina(-pendingStaminaCrash);
      log(`>> GRAVE-DUST AMPOULE // Crash response detected (−${pendingStaminaCrash} Stamina).`);
    }
    if (combatBuffRef.current.bonusApNextTurn > 0) {
      combatBuffRef.current.bonusApThisTurn += combatBuffRef.current.bonusApNextTurn;
      combatBuffRef.current.bonusApNextTurn = 0;
    }
    if (mutationEncounterRef.current.flawlessConduitPending) {
      combatBuffRef.current.bonusApThisTurn += 1;
      mutationEncounterRef.current.flawlessConduitPending = false;
      log('[FLAWLESS CONDUIT] >> Perfect parry — +1 AP this turn.');
    }
    if (mutationEncounterRef.current.momentumShiftPending) {
      combatBuffRef.current.bonusApThisTurn += 1;
      mutationEncounterRef.current.momentumShiftPending = false;
      log('[MOMENTUM SHIFT] >> Zero resource end — +1 AP this turn. Evade disabled until reserve or stamina returns.');
    }
    if (mutationEncounterRef.current.bloodTitheCooldown > 0) {
      mutationEncounterRef.current.bloodTitheCooldown -= 1;
    }
    if (mutationEncounterRef.current.ashenMantleCooldown > 0) {
      mutationEncounterRef.current.ashenMantleCooldown -= 1;
    }
    mutationEncounterRef.current.adrenalineSpikeUsed = false;
    mutationEncounterRef.current.executionerHighUsed = false;
    mutationEncounterRef.current.bloodForTimeUsed = false;
    Object.keys(graftCooldownsRef.current).forEach((abilityId) => {
      const key = abilityId as AegisAbilityId;
      const remaining = graftCooldownsRef.current[key] ?? 0;
      if (remaining > 0) {
        graftCooldownsRef.current[key] = remaining - 1;
      }
    });
    const bonusAp = combatBuffRef.current.bonusApThisTurn;
    combatBuffRef.current.bonusApThisTurn = 0;
    const apPenalty = sessionExtrasRef.current.playerApPenaltyNextTurn;
    const apCap = sessionExtrasRef.current.playerApCapNextTurn;
    const primerAp = consumeAdrenalinePrimerTurnBonus();
    if (apPenalty > 0) {
      sessionExtrasRef.current.playerApPenaltyNextTurn = 0;
      log(`>> MIASMA FATIGUE — −${apPenalty} AP this turn.`);
    }
    if (apCap != null) {
      sessionExtrasRef.current.playerApCapNextTurn = null;
      log(`>> VEIL STATIC RESIDUE — operative AP capped at ${apCap}.`);
    }
    if (primerAp > 0) {
      log(`>> ADRENALINE PRIMER — +${primerAp} AP this turn.`);
    }
    const baseAp = PLAYER_ACTION_POINTS_PER_TURN + incursionApBonus + bonusAp + primerAp - apPenalty;
    playerApRef.current = apCap != null
      ? Math.max(0, Math.min(apCap, baseAp))
      : Math.max(0, baseAp);
    setPlayerActionPoints(playerApRef.current);
    if (operativeClass === 'HEX_SHOT') {
      hexReloadUsedThisTurnRef.current = false;
      setHexReloadUsedThisTurn(false);
      dispatchHexShot({
        type: 'HEX_TURN_START',
        ap: playerApRef.current,
        encounter: classCombatRef.current,
        squad: squadRef.current,
      });
      const panic = tryHexShotPanicButton(
        hexShotBoons,
        classBoonEncounterRef.current,
        currentAmmoRef.current,
        playerApRef.current,
        maxAmmo,
        log,
      );
      if (panic) {
        setMagazineAmmo(Math.min(maxAmmo, currentAmmoRef.current + panic.ammo));
        playerApRef.current += panic.ap;
        setPlayerActionPoints(playerApRef.current);
      }
    }
    if (operativeClass === 'ENVOY') {
      classBoonEncounterRef.current.voidsBargainFirstStrike = true;
    }
    setIsPlayerTurn(true);
    if (!skipRegenRef.current) {
      applyStamina(staminaRef.current + COMBAT_ACTION.STAMINA_REGEN);
    } else if (staminaRef.current === 0) {
      log('[EXHAUSTED] >> Stamina regen suppressed — reserves at 0.');
    } else {
      log('[OVEREXERTION] >> Stamina regen suppressed this turn.');
    }
    skipRegenRef.current = false;
    if (godModeRef.current) {
      applyGodModeResources();
    } else if (staminaRef.current <= 0) {
      applyStamina(15);
      log('[STAMINA REBOUND] >> Zero reserves at turn start — operative enters at 15 STAM.');
    }
    if (
      operativeClass === 'ENVOY'
      && envoyCombatStateRef.current.isVoidSiphoned
      && !godModeRef.current
    ) {
      const siphonDmg = envoyCombatStateRef.current.voidSiphonedTurnDamage;
      hurtPlayer(
        siphonDmg,
        true,
        `>> [VOID-SIPHONED] — ${siphonDmg} TRUE self-damage.`,
      );
    }
    tickHexShotClassState(classCombatRef.current);
    setCycleState('TEXT_COMBAT');
    log('>> OPERATIVE TURN // Command deck online.');
    const danger = resolveStartOfTurnDangerPulse(
      squadRef.current,
      objectiveSessionRef.current,
    );
    if (danger.message) {
      setPhaseAlert(`>> ${danger.message}`);
      log(`>> DANGER — ${danger.message}`);
      if (danger.juiceEvent) {
        recordJuiceEvent(juiceTelemetryRef.current, danger.juiceEvent);
      }
      setTimeout(() => setPhaseAlert(null), 2400);
    }
  };

  const resolvePendingAttackDamage = (e: EnemyCombatProfile) => {
    const dmg = e.isBoss && bossRuntimeRef.current
      ? bossStrikeDamage(bossRuntimeRef.current, bossPhaseRef.current)
      : attackDmg(e).dmg;
    let unblockable = e.intent === 'OVERDRIVE_DISCHARGE' ? false : attackDmg(e).unblockable;
    if (e.intent === 'OVERDRIVE_DISCHARGE') unblockable = false;
    return { dmg, unblockable };
  };


  const resolveEnemyAction = (countering: boolean) => {
    if (isCombatTerminal()) return;
    const currentEnemy = enemyRef.current;
    if (!currentEnemy || operativeHpRef.current <= 0) {
      setEnemyActionStage(null);
      return;
    }
    if (!isUnitAlive(currentEnemy)) {
      setEnemyActionStage(null);
      if (allUnitsDefeated(squadRef.current)) {
        scheduleCombatVictoryResolution();
        return;
      }
      if (enemyActionQueueRef.current.length > 0) scheduleNextEnemyAction(countering);
      else endEnemyTurn(true);
      return;
    }
    setEnemyActionStage(null);
    const enemyId = currentEnemy.unitId;
    if (enemyId) {
      classCombatRef.current.riftSnareUnits = detonateRiftSnareOnUnit(
        enemyId,
        currentEnemy.designation,
        classCombatRef.current.riftSnareUnits,
        (raw, tag, options, targetId) => hurtEnemy(raw, tag, 'STRIKE', {
          channel: options?.channel ?? 'KINETIC',
          targetId: options?.targetId ?? targetId,
          abilityId: options?.abilityId as AegisAbilityId | undefined,
          rollCrit: options?.rollCrit ?? false,
          indirectDamage: options?.indirectDamage ?? true,
        }),
        log,
      );
    }
    if (
      operativeClass === 'HEX_SHOT'
      && classCombatRef.current.panopticonActive
      && enemyId
    ) {
      classCombatRef.current.panopticonActive = false;
      const overwatchMastery = isOverwatchMasteryActive(hexShotBoons);
      const counter = resolveIntentCounterplay({
        intent: currentEnemy.intent,
        playerActionTags: ['INTERRUPT', 'TRAP'],
        sourceCombatant: currentEnemy,
        classId: 'HEX_SHOT',
        abilityId: 'PANOPTICON_PROTOCOL',
        incomingDamage: currentEnemy.baseDamage,
      });
      recordIntentCountered(intentTelemetryRef.current, currentEnemy.intent, counter.counterQuality, {
        damagePrevented: counter.reducedDamageAmount,
        appliedFracture: counter.appliedFracture,
      });
      let interrupted = applyIntentCounterplayToEnemy(currentEnemy, {
        ...counter,
        cancelTelegraph: true,
      });
      interrupted = addCombatTag(interrupted, 'CONCUSSED');
      patchUnit(enemyId, interrupted);
      const panopticonDmg = overwatchMastery ? 16 : 8;
      hurtEnemy(panopticonDmg, '[PANOPTICON]', 'STRIKE', {
        channel: 'KINETIC',
        targetId: enemyId,
        abilityId: 'PANOPTICON_PROTOCOL' as AegisAbilityId,
        rollCrit: false,
        indirectDamage: true,
      });
      log('[PANOPTICON] >> Overwatch interrupt — hostile concussed, attack cancelled.');
      log('[HEX SHOT] >> Correct Round — intent interrupted.');
      classLoopTelemetryRef.current.panopticonInterrupts += 1;
      classLoopTelemetryRef.current.channelsDisrupted += 1;
      counter.logMessages.forEach((m) => log(`[PANOPTICON] >> ${m}`));
      applyObjectiveProgress(
        progressObjectiveOnChannelInterrupt(
          objectiveSessionRef.current,
          getIntentType(currentEnemy.intent),
        ),
      );
      dispatchHexShot({
        type: 'HEX_REEVALUATE_ULTIMATE',
        encounter: classCombatRef.current,
        squad: squadRef.current,
      });
      if (enemyActionQueueRef.current.length > 0) scheduleNextEnemyAction(countering);
      else if (allUnitsDefeated(squadRef.current)) scheduleCombatVictoryResolution();
      else endEnemyTurn(true);
      return;
    }
    if (cycleRef.current === 'DEFEND_PARRY' || cycleRef.current === 'DEFEND_WARD') return;
    if (voidWardPrimedRef.current && openParryWindow(currentEnemy, true)) return;
    const hpStrikeResolved = commitPendingPlayerDamage(false, undefined, currentEnemy);
    if (hpStrikeResolved && currentEnemy.intent === 'VOID_AMBUSH') {
      finalizeNullShadeVoidAmbush(currentEnemy);
    } else if (!hpStrikeResolved) {
      execIntent(currentEnemy);
    }
    if (operativeHpRef.current <= 0) return;
    if (enemyActionQueueRef.current.length > 0) {
      scheduleNextEnemyAction(countering);
      return;
    }
    if (allUnitsDefeated(squadRef.current)) scheduleCombatVictoryResolution();
    else endEnemyTurn();
  };

  const runEnemyActionAnimation = (countering: boolean) => {
    if (runItemCombatFlagsRef.current.delayedCylinderTargetId) {
      const cylinderTargetId = runItemCombatFlagsRef.current.delayedCylinderTargetId;
      const cylinderDamage = runItemCombatFlagsRef.current.delayedCylinderDamage || 18;
      runItemCombatFlagsRef.current.delayedCylinderTargetId = null;
      runItemCombatFlagsRef.current.delayedCylinderDamage = 0;
      const cylinderTarget = getUnitById(squadRef.current, cylinderTargetId);
      if (cylinderTarget?.unitId && (cylinderTarget.currentHp ?? 0) > 0) {
        hurtEnemy(cylinderDamage, '[RIGGED CYLINDER]', 'STRIKE', {
          channel: 'KINETIC',
          rollCrit: false,
          targetId: cylinderTarget.unitId,
        });
        log('>> RIGGED CYLINDER // Delayed combustion event.');
      }
    }
    const unitId = enemyActionQueueRef.current[0];
    const unit = unitId ? getUnitById(squadRef.current, unitId) : enemyRef.current;
    if (!unit || !isUnitAlive(unit)) {
      enemyActionQueueRef.current.shift();
      if (allUnitsDefeated(squadRef.current)) {
        scheduleCombatVictoryResolution();
        return;
      }
      if (enemyActionQueueRef.current.length > 0) runEnemyActionAnimation(countering);
      else endEnemyTurn(true);
      return;
    }
    // Slumped thralls never act; reanimated thralls consume one turn without attacking.
    if (unit.isSlumped || !canUnitAct(unit)) {
      enemyActionQueueRef.current.shift();
      log(`>> ${unit.designation} SLUMPED — cannot act.`);
      if (enemyActionQueueRef.current.length > 0) runEnemyActionAnimation(countering);
      else endEnemyTurn(true);
      return;
    }
    if (unit.skipNextAction && unit.unitId) {
      enemyActionQueueRef.current.shift();
      patchUnit(unit.unitId, { skipNextAction: false });
      log(`>> ${unit.designation} REANIMATED — recovering, action skipped.`);
      if (enemyActionQueueRef.current.length > 0) runEnemyActionAnimation(countering);
      else endEnemyTurn(true);
      return;
    }
    focusedUnitIdRef.current = unit.unitId ?? null;
    focusEnemy(unit);
    if (unit.unitId) {
      applyEnemyApDrainAtTurnStart(
        unit.unitId,
        unit.designation,
        classCombatRef.current,
        reduceEnemyAp,
        log,
      );
      applyEnvoyHeavyGravityApDrain(
        unit.unitId,
        classBoonEncounterRef.current,
        reduceEnemyAp,
        unit.designation,
        log,
      );
      runAgonizingHexOnEnemyTurn(
        envoyBoons,
        unit,
        classCombatRef.current,
        classBoonEncounterRef.current,
        (raw, targetId) => hurtEnemy(raw, '[AGONIZING HEX]', 'STRIKE', {
          channel: 'TRUE',
          targetId,
          rollCrit: false,
        }),
        log,
      );
    }
    const turnStart = CombatLifecycleManager.runOnTurnStart(unit, buildLifecycleContext());
    turnStart.logLines.forEach((line) => log(line));
    applyLifecycleExtras(turnStart.extras);
    applyLifecyclePlayerDelta(turnStart.playerHpDelta);
    applyLifecycleStaminaDelta(turnStart.playerStaminaDelta);
    if (turnStart.squad.length > 0) syncSquad(turnStart.squad);
    if (turnStart.forceDissolveUnitIds?.length) {
      for (const deadId of turnStart.forceDissolveUnitIds) {
        const deadUnit = getUnitById(squadRef.current, deadId);
        if (!deadUnit || isUnitAlive(deadUnit)) continue;
        beginDissolveForUnit(deadId, deadUnit, deadUnit.currentHp);
      }
      if (allUnitsDefeated(squadRef.current)) {
        scheduleCombatVictoryResolution();
      }
    }
    if (turnStart.statusFloatLabel && turnStart.statusFloatUnitId) {
      statusFloatSeqRef.current[turnStart.statusFloatUnitId] =
        (statusFloatSeqRef.current[turnStart.statusFloatUnitId] ?? 0) + 1;
      lifecycleFloatLabelsRef.current[turnStart.statusFloatUnitId] = turnStart.statusFloatLabel;
      publishSquadUi(squadRef.current);
    }
    if (
      unit.rosterId === 'fracture-hound'
      && unit.intent === 'STRIKE'
      && unit.unitId
      && enemyActionQueueRef.current[0] === unit.unitId
    ) {
      const attacksPerTurn = getAlphaMechanic(unit, 'attacksPerTurn', 0);
      const alreadyExpanded = unit.unitId
        ? rabidFlurryExpandedRef.current.has(unit.unitId)
        : false;
      if (
        attacksPerTurn >= 2
        && unit.isAlpha
        && unit.unitId
        && !alreadyExpanded
      ) {
        rabidFlurryExpandedRef.current.add(unit.unitId);
        const extra = attacksPerTurn - 1;
        enemyActionQueueRef.current.splice(1, 0, ...Array(extra).fill(unit.unitId));
        log(`>> ${unit.designation} RABID FLURRY — ${attacksPerTurn} strikes queued.`);
      } else if (
        !alreadyExpanded
        && enemyActionQueueRef.current[1] !== unit.unitId
        && Math.random() < FRACTURE_HOUND_DOUBLE_STRIKE_CHANCE
      ) {
        enemyActionQueueRef.current.splice(1, 0, unit.unitId);
        log(`>> ${unit.designation} DOUBLE STRIKE — twin cleave queued.`);
      }
    }
    setIsPlayerTurn(false);
    setEnemyActionStage('reading');
    log(`>> HOSTILE TURN // ${unit.designation} — ${formatIntentReadout(unit.intent)}`);

    if (isNullShadeVoidAmbush(unit) && unit.unitId) {
      voidAmbushWindowRef.current = { unitId: unit.unitId, damageDealt: 0 };
      patchUnit(unit.unitId, { isUntargetable: false });
      selectedTargetIdRef.current = unit.unitId;
      setSelectedTargetId(unit.unitId);
      setIsPlayerTurn(true);
      log(`>> VOID AMBUSH TELEGRAPH — deal ${VOID_AMBUSH_INTERRUPT_THRESHOLD} damage to interrupt.`);
      publishSquadUi(squadRef.current);
    }

    enemyTurnTimerRef.current = setTimeout(() => {
      enemyTurnTimerRef.current = null;
      if (isCombatTerminal()) return;

      if (voidAmbushWindowRef.current?.unitId === unitId) {
        closeVoidAmbushWindow();
      }

      const acting = unitId ? getUnitById(squadRef.current, unitId) : null;
      if (!acting || !isUnitAlive(acting) || operativeHpRef.current <= 0) {
        enemyActionQueueRef.current.shift();
        setEnemyActionStage(null);
        if (operativeHpRef.current <= 0) return;
        if (allUnitsDefeated(squadRef.current)) {
          scheduleCombatVictoryResolution();
          return;
        }
        if (enemyActionQueueRef.current.length > 0) scheduleNextEnemyAction(countering);
        else endEnemyTurn(true);
        return;
      }
      focusEnemy(acting);
      setEnemyActionStage('executing');

      const effectiveIntent = resolveEffectiveEnemyIntent(acting);
      const motionOptions = { arenaLayout: true, gridSlot: acting.gridSlot ?? null };
      const motionKind = classifyEnemyTurnMotion(effectiveIntent, motionOptions);
      const overlayVariant = getEnemyDeckStrikeVariant(effectiveIntent);
      const isBacklineMelee = acting.gridSlot?.startsWith('BL') === true
        && motionKind === 'melee';
      const isFrontlineMelee = acting.gridSlot?.startsWith('FL') === true
        && motionKind === 'melee'
        && !isBacklineMelee;
      const actingUnitId = acting.unitId ?? acting.designation;

      let animDurationMs = ENEMY_RANGED_ANIM_MS;

      if (motionKind === 'buff') {
        statusFloatSeqRef.current[actingUnitId] = (statusFloatSeqRef.current[actingUnitId] ?? 0) + 1;
        publishSquadUi(squadRef.current);
        animDurationMs = ENEMY_BUFF_ANIM_MS;
      } else {
        apparitionRef?.current?.triggerAttackEffect();

        if (isBacklineMelee && acting.unitId) {
          const dashUnitId = acting.unitId;
          backlineDashSeqRef.current[dashUnitId] = (backlineDashSeqRef.current[dashUnitId] ?? 0) + 1;
          backlineDashActiveRef.current[dashUnitId] = true;
          publishSquadUi(squadRef.current);
          animDurationMs = ENEMY_BACKLINE_MELEE_ANIM_MS;

          setTimeout(() => {
            if (isCombatTerminal()) return;
            if (overlayVariant) {
              showStrikeFeedback(overlayVariant);
              if (overlayVariant === 'hp') applyHpStrikeOnDeckImpact(acting);
            }
          }, BACKLINE_MELEE_DASH_IMPACT_MS);

          setTimeout(() => {
            backlineDashActiveRef.current[dashUnitId] = false;
            publishSquadUi(squadRef.current);
          }, BACKLINE_MELEE_DASH_TOTAL_MS);
        } else if (overlayVariant) {
          const applyStrike = () => {
            showStrikeFeedback(overlayVariant);
            if (overlayVariant === 'hp') applyHpStrikeOnDeckImpact(acting);
          };
          if (isFrontlineMelee) {
            animDurationMs = ENEMY_MELEE_ANIM_MS;
            setTimeout(() => {
              if (isCombatTerminal()) return;
              applyStrike();
            }, FRONTLINE_MELEE_IMPACT_MS);
          } else {
            animDurationMs = ENEMY_RANGED_ANIM_MS;
            // Align hit SFX / deck flash with ranged attack pose peak.
            setTimeout(() => {
              if (isCombatTerminal()) return;
              applyStrike();
            }, RANGED_ATTACK_SPRITE_IN_MS);
          }
        } else if (motionKind === 'melee') {
          animDurationMs = ENEMY_MELEE_ANIM_MS;
        }
      }

      enemyStrikeTimerRef.current = setTimeout(() => {
        enemyStrikeTimerRef.current = null;
        enemyActionQueueRef.current.shift();
        resolveEnemyAction(countering);
      }, animDurationMs);
    }, ENEMY_INTENT_READ_MS);
  };

  const resolveEnvoyWardSpeed = (enemy: EnemyCombatProfile): EnvoyWardExpansionSpeed => {
    const archetype = (enemy.spawnArchetype ?? 'MELEE') as EnemySpawnArchetype;
    if (archetype === 'HEAVY' || archetype === 'ARTILLERY') return 'slow';
    if (enemy.rosterId === 'scuttler' || enemy.rosterId === 'fracture-hound') return 'fast';
    return 'normal';
  };

  const openEnvoyWardWindow = (e: EnemyCombatProfile): boolean => {
    if (operativeClass !== 'ENVOY' || isExhausted) return false;
    const effectiveIntent = resolveEffectiveEnemyIntent(e);
    if (!isAttackIntent(effectiveIntent)) return false;
    const { dmg, unblockable } = resolvePendingAttackDamage(e);
    pendingDmgRef.current = dmg;
    pendingUnblockRef.current = unblockable;
    setEnvoyWardSpeed(resolveEnvoyWardSpeed(e));
    cycleRef.current = 'DEFEND_WARD';
    setCycleState('DEFEND_WARD');
    log('[VOID WARD] >> Hold to charge — release on ring overlap.');
    return true;
  };

  const finalizeEnvoyWard = (overlapRatio: number) => {
    const perfect = Math.abs(overlapRatio - 1.0) <= 0.05;
    cycleRef.current = 'TEXT_COMBAT';
    setCycleState('TEXT_COMBAT');
    if (perfect) {
      triggerHitstop(100);
      triggerHaptic('impactHeavy');
      const restore = hasEnvoyBoon(envoyBoons, 'PERFECTED_WARD') ? 50 : 30;
      applyVeilFlux(restore);
      if (hasEnvoyBoon(envoyBoons, 'PERFECTED_WARD')) {
        playerApRef.current += 1;
        setPlayerActionPoints(playerApRef.current);
      }
      preAppliedHpStrikeRef.current = 0;
      log(`[RIFT-WARD] >> Perfect overlap — 100% negated, +${restore}% flux restored.`);
    } else {
      triggerShake('light');
      triggerHaptic('notificationError');
      applyVeilFlux(-15);
      const mitigated = Math.max(1, Math.floor(pendingDmgRef.current * 0.5));
      hurtPlayer(
        mitigated,
        pendingUnblockRef.current,
        `[RIFT-WARD] >> Imperfect seal — ${mitigated} damage, −15% flux.`,
        { rollCrit: false },
      );
      log('[RIFT-WARD] >> Ward cracked — partial impact.');
    }
    if (operativeHpRef.current <= 0) return;
    if (enemyActionQueueRef.current.length > 0) scheduleNextEnemyAction(false);
    else if (allUnitsDefeated(squadRef.current)) scheduleCombatVictoryResolution();
    else endEnemyTurn(true);
  };

  const openParryWindow = (e: EnemyCombatProfile, fromVoidWard: boolean): boolean => {
    const effectiveIntent = resolveEffectiveEnemyIntent(e);
    if (effectiveIntent === 'WORLD_ENDER') {
      if (fromVoidWard) {
        log('[VOID WARD] >> World-Ender cannot be parried — shroud collapsed.');
        clearVoidWardShroud();
      }
      return false;
    }
    if (!isKineticMeleeEnemyStrike(e)) {
      if (fromVoidWard) {
        log('[VOID WARD] >> Non-kinetic channel — shroud misaligned.');
        clearVoidWardShroud();
      }
      return false;
    }
    if (!fromVoidWard || !voidWardPrimedRef.current) {
      return false;
    }
    const { dmg, unblockable } = resolvePendingAttackDamage(e);
    pendingDmgRef.current = dmg;
    pendingUnblockRef.current = unblockable;
    cycleRef.current = 'DEFEND_PARRY';
    setCycleState('DEFEND_PARRY');
    startParryRing();
    return true;
  };

  const runHostileTurnSkipBeat = (
    unitIds: string[],
    options: { centerLabel?: string; onComplete: () => void },
  ) => {
    if (unitIds.length === 0) {
      options.onComplete();
      return;
    }
    clearEnemyTurnTimers();
    skipTurnUnitIdsRef.current = new Set(unitIds);
    setIsPlayerTurn(false);
    setEnemyActionStage('reading');
    if (options.centerLabel) {
      setCenterSkipFloatSeq((seq) => seq + 1);
    } else {
      for (const unitId of unitIds) {
        statusFloatSeqRef.current[unitId] = (statusFloatSeqRef.current[unitId] ?? 0) + 1;
      }
    }
    publishSquadUi(squadRef.current);

    enemyTurnTimerRef.current = setTimeout(() => {
      enemyTurnTimerRef.current = null;
      if (isCombatTerminal()) return;
      setEnemyActionStage('executing');
      publishSquadUi(squadRef.current);
      enemyStrikeTimerRef.current = setTimeout(() => {
        enemyStrikeTimerRef.current = null;
        skipTurnUnitIdsRef.current = new Set();
        setEnemyActionStage(null);
        publishSquadUi(squadRef.current);
        options.onComplete();
      }, ENEMY_BUFF_ANIM_MS);
    }, ENEMY_INTENT_READ_MS);
  };

  const passToEnemy = (countering = false) => {
    if (isCombatTerminal()) return;
    expireRiposteIfNeeded();
    // Safety: 0-HP / dissolved squads must end combat even if a prior kill path skipped victory.
    if (allUnitsDefeated(squadRef.current)) {
      for (const unit of squadRef.current) {
        if (isUnitAlive(unit) || !unit.unitId) continue;
        beginDissolveForUnit(unit.unitId, unit, unit.currentHp);
      }
      scheduleCombatVictoryResolution();
      return;
    }

    const slumpTick = tickThrallSlumpsAtPlayerTurnEnd(
      squadRef.current,
      sessionExtrasRef.current.fleshWarpUnitIds ?? {},
    );
    slumpTick.logLines.forEach((line) => log(line));
    if (slumpTick.squad !== squadRef.current) syncSquad(slumpTick.squad);
    if (slumpTick.statusFloatLabel && slumpTick.statusFloatUnitId) {
      statusFloatSeqRef.current[slumpTick.statusFloatUnitId] =
        (statusFloatSeqRef.current[slumpTick.statusFloatUnitId] ?? 0) + 1;
      lifecycleFloatLabelsRef.current[slumpTick.statusFloatUnitId] = slumpTick.statusFloatLabel;
      publishSquadUi(squadRef.current);
    }
    if (slumpTick.forceDissolveUnitIds.length) {
      for (const deadId of slumpTick.forceDissolveUnitIds) {
        const deadUnit = getUnitById(squadRef.current, deadId);
        if (!deadUnit || isUnitAlive(deadUnit)) continue;
        beginDissolveForUnit(deadId, deadUnit, deadUnit.currentHp);
      }
      if (allUnitsDefeated(squadRef.current)) {
        scheduleCombatVictoryResolution();
        return;
      }
    }

    recordPlayerDefendStreak(
      sessionExtrasRef.current,
      sessionExtrasRef.current.playerDefendedThisTurn,
    );
    const guardBreak = primeReaverGuardBreak(squadRef.current, sessionExtrasRef.current);
    guardBreak.logLines.forEach((line) => log(line));
    if (guardBreak.squad.length > 0) syncSquad(guardBreak.squad);
    const bloodRush = applyBloodRushToReavers(squadRef.current, sessionExtrasRef.current);
    bloodRush.logLines.forEach((line) => log(line));
    if (bloodRush.squad.length > 0) syncSquad(bloodRush.squad);
    if (hasStructuredDebuff(sessionExtrasRef.current, 'HEXED')) {
      consumeRivalHexedDebuff(sessionExtrasRef.current);
      log('>> HEXED — curse fades at turn end.');
    }
    resolvePlayerTurnEndDebuffsRef.current();
    tickCombatSessionExtras(sessionExtrasRef.current);
    setSelectedAbility(null);
    syncSquad(squadRef.current.map((unit) => {
      const fortifyRemaining = unit.fortifyTurnsRemaining ?? 0;
      const evadeRemaining = unit.evadeTurnsRemaining ?? 0;
      let next = unit;
      if (fortifyRemaining > 0) {
        next = { ...next, fortifyTurnsRemaining: fortifyRemaining - 1 };
      }
      if (evadeRemaining > 0) {
        const remaining = evadeRemaining - 1;
        next = {
          ...next,
          evadeTurnsRemaining: remaining,
          evadeActive: remaining > 0,
        };
      }
      return next;
    }));
    clearEnemyTurnTimers();
    counteringEnemyRef.current = countering;
    rabidFlurryExpandedRef.current = new Set();
    tickMutationHazardsOnEnemyPhase();

    if (enemyStunPendingRef.current) {
      enemyStunPendingRef.current = false;
      log('>> HOSTILE STUNNED — Veil interference; turn forfeited.');
      const skipIds = aliveUnits(squadRef.current)
        .map((unit) => unit.unitId)
        .filter((unitId): unitId is string => Boolean(unitId));
      runHostileTurnSkipBeat(skipIds, {
        centerLabel: 'Enemy Turn Skipped',
        onComplete: () => endEnemyTurn(false),
      });
      return;
    }

    const budget = threatBudgetRef.current;
    const picks = pickThreatBudgetActions(squadRef.current, budget);
    if (picks.length === 0) {
      if (aliveUnits(squadRef.current).some((unit) => isEnemyFractured(unit))) {
        log('>> FRACTURED HOSTILES — staggered hostiles skip action this cycle.');
      }
      const skipIds = aliveUnits(squadRef.current)
        .map((unit) => unit.unitId)
        .filter((unitId): unitId is string => Boolean(unitId));
      runHostileTurnSkipBeat(skipIds, {
        centerLabel: 'Enemy Turn Skipped',
        onComplete: () => endEnemyTurn(true),
      });
      return;
    }
    const pickedIds = new Set(picks.map((pick) => pick.unitId));
    const fracturedSkipIds = aliveUnits(squadRef.current)
      .filter((unit) => isEnemyFractured(unit) && unit.unitId && !pickedIds.has(unit.unitId))
      .map((unit) => unit.unitId!)
      .filter(Boolean);
    if (fracturedSkipIds.length > 0) {
      runHostileTurnSkipBeat(fracturedSkipIds, {
        onComplete: () => {
          enemyActionQueueRef.current = picks.map((pick) => pick.unitId);
          runEnemyActionAnimation(countering);
        },
      });
      return;
    }
    enemyActionQueueRef.current = picks.map((pick) => pick.unitId);
    runEnemyActionAnimation(countering);
  };

  const initCombat = () => {
    let initialSquad = enemySquad?.length
      ? normalizeSquad(enemySquad)
      : enemyProfile
        ? squadFromSingleEnemy(initEnemyCombatLayers(enemyProfile))
        : spawnCombatSquad({ nodeIndex, district: combatDistrict });

    if (narrativeCombatBoons?.scouted) {
      initialSquad = initialSquad.map((unit) => ({
        ...unit,
        currentHp: Math.max(1, Math.floor(unit.currentHp * 0.9)),
      }));
    }

    encounterModifierRuntimeRef.current = createEncounterModifierCombatRuntime(encounterModifier);
    depthVariantRuntimeRef.current = createDepthVariantCombatRuntime();
    const encounterModStartLogs: string[] = [];
    encounterModStartLogs.push(...formatDepthVariantCombatIntro(initialSquad));
    if (encounterModifierRuntimeRef.current) {
      const folded = applyFoldedModifierToSquad(
        initialSquad,
        encounterModifierRuntimeRef.current,
      );
      initialSquad = folded.squad;
      encounterModifierRuntimeRef.current = folded.runtime;
      if (folded.logLine) encounterModStartLogs.push(folded.logLine);
      const coreSick = applyCoreSickModifierToSquad(
        initialSquad,
        encounterModifierRuntimeRef.current,
      );
      initialSquad = coreSick.squad;
      encounterModifierRuntimeRef.current = coreSick.runtime;
      if (coreSick.logLine) encounterModStartLogs.push(coreSick.logLine);
    }

    threatBudgetRef.current = threatBudget
      ?? (initialSquad.length >= 3 ? THREAT_BUDGET_ELITE : THREAT_BUDGET_STANDARD);
    arenaLayoutModeRef.current = resolveArenaLayoutMode(initialSquad.length);
    encounterHostileCountRef.current = initialSquad.length;
    syncSquad(initialSquad);
    const defaultTarget = nextDefaultTarget(initialSquad);
    if (defaultTarget) selectTarget(defaultTarget);
    operativeHpRef.current = initialOperativeHp; staminaRef.current = initialStamina;
    balanceEncounterRef.current = {
      playerTurns: 0,
      damageTaken: 0,
      healingReceived: 0,
      damageDealt: 0,
    };
    const entryAr = Math.max(
      startingAbyssalReservePercent,
      mutationModsRef.current.startingAbyssalPercent,
      primeUltimateAtStart ? COMBAT_ACTION.ABYSSAL_RESERVE_CAP : 0,
    );
    abyssalRef.current = entryAr;
    skipRegenRef.current = false;
    wardStrikeBonusRef.current = false;
    setStrikeArPrimed(false);
    counterRef.current = false;
    resolutionRef.current = null; dismissedRef.current = false;
    applyStamina(initialStamina);
    setAbyssalReserve(entryAr);
    setOperativeHp(initialOperativeHp);
    setAbyssalWardActive(false);
    setCounterPrepActive(false);
    voidWardPrimedRef.current = false;
    setVoidWardPrimed(false);
    setRunicBrands(0);
    classCombatRef.current.runicBrands = 0;
    riftWardReadyRef.current = operativeClass === 'ENVOY';
    combatBuffRef.current = {
      demonLungCooldown: 0,
      crimsonPactCharges: 0,
      bonusApThisTurn: 0,
      bonusApNextTurn: 0,
      ashenMantleTurnsRemaining: 0,
      initiativeQueued: false,
    };
    setInitiativeQueued(false);
    setInitiativeProcSeq(0);
    setApRollupDisplay(null);
    shadowstepProcRef.current = false;
    setShadowstepProcActive(false);
    mutationModsRef.current = aggregateMutationModifiers(leyLineMutations);
    mutationEncounterRef.current = createDefaultBoonEncounterState();
    classBoonEncounterRef.current = createDefaultClassBoonEncounterState();
    lastPlayerAbilityRef.current = null;
    runItemCombatFlagsRef.current = {
      bloodwireActive: false,
      bloodwireSpent: false,
      nullSpaceActive: false,
      voidglassDecoyActive: false,
      delayedCylinderTargetId: null,
      delayedCylinderDamage: 0,
      staminaLossNextTurn: 0,
      healingReceivedPenaltyPct: 0,
    };
    notifyRunItemCombatStart();
    weaponRuntimeRef.current = createDefaultWeaponRuntime();
    sessionExtrasRef.current = createDefaultCombatSessionExtras();
    graftEncounterSafetyRef.current = createDefaultGraftEncounterSafetyState();
    initPlayerMaxHpDebtTracking(sessionExtrasRef.current, combatMaxSoulAnchorRef.current);
    setPlayerMaxAnchorDebt(0);
    kineticBatteryChargedRef.current = false;
    combatChanceRef.current = createDefaultCombatChanceState();
    setMagazineAmmo(maxAmmo);
    setAegisOvercharged(false);
    voidSiphonedEnteredRef.current = false;
    setActiveReloadVisible(false);
    setHexReloadSuppressesAttackSfx(false);
    hexReloadUsedThisTurnRef.current = false;
    setHexReloadUsedThisTurn(false);
    setZeroProtocolVisible(false);
    zeroProtocolActiveRef.current = false;
    setCataclysmSigilVisible(false);
    syncFractureBreakTarget(null);
    dissolvedHiddenRef.current = new Set();
    dissolveSeqRef.current = {};
    adrenalinePrimerTurnsRef.current = adrenalinePrimerActive ? 3 : 0;
    setSuccessfulParryCount(0);
    setCataclysmReadyUi(false);
    cataclysmReadyPrevRef.current = false;
    setEnvoyRotStacksUi(0);
    setCatalyticConsoleVisible(false);
    combatPausedRef.current = false;
    classCombatRef.current = createDefaultClassCombatEncounterState();
    setRiposteReadyUi(false);
    classLoopTelemetryRef.current = createEmptyClassLoopTelemetry();
    intentTelemetryRef.current = createEmptyIntentTelemetry();
    juiceTelemetryRef.current = createEmptyJuiceTelemetry();
    objectiveSessionRef.current = buildEncounterObjectiveSession(
      env.encounterObjective ?? null,
      initialSquad,
    );
    syncObjectiveHud();
    if (env.encounterObjective || env.combatDirector) {
      emitJuice('OBJECTIVE_STARTED', {
        text: env.combatDirector
          ? `Director ${env.combatDirector.pressureLabel} ${env.combatDirector.pressureTotal}`
          : 'Objective online',
      });
    }
    if (narrativeCombatBoons?.veilWard) {
      sessionExtrasRef.current.playerShield = 15;
      sessionExtrasRef.current.narrativeVeilWardActive = true;
    }
    if (narrativeCombatBoons?.overcharged) {
      sessionExtrasRef.current.overchargedActive = true;
      if (operativeClass === 'AEGIS') {
        setAegisOvercharged(true);
      }
    }
    const preLockedSniper = initialSquad.find(
      (unit) => unit.rosterId === 'coil-spike-sniper'
        && unit.isAlpha
        && unit.isCharging
        && (unit.laserLockTurnsRemaining ?? 0) === 0,
    );
    if (preLockedSniper) {
      addStructuredDebuff(sessionExtrasRef.current, {
        type: 'LASER_SIGHT',
        turnsRemaining: getAlphaMechanic(preLockedSniper, 'lockOnTurns', 1),
      });
      log(`>> ${preLockedSniper.designation} EXECUTIONER LOCK — target pre-acquired.`);
    }
    const ghostedAp = narrativeCombatBoons?.ghosted ? 1 : 0;
    const entryPrimerAp = consumeAdrenalinePrimerTurnBonus();
    const entryAp = PLAYER_ACTION_POINTS_PER_TURN
      + incursionApBonus
      + Math.max(0, firstTurnBonusAp)
      + ghostedAp
      + entryPrimerAp;
    playerApRef.current = entryAp;
    setPlayerActionPoints(entryAp);
    if (operativeClass === 'HEX_SHOT') {
      const primedProtocol = primeUltimateAtStart
        ? HEX_MAGAZINE_CONFIG.maxProtocolCharges
        : 0;
      const hexInit = createInitialHexShotCombatState({
        hp: operativeHpRef.current,
        maxHp: maxSoulAnchor,
        stamina: staminaRef.current,
        maxStamina,
        ap: entryAp,
        ammo: maxAmmo,
        maxAmmo,
        protocolCharges: primedProtocol,
      });
      if (primeUltimateAtStart) {
        hexInit.isUltimateAvailable = true;
      }
      applyHexShotCombatState(hexInit);
    }
    if (primeUltimateAtStart && operativeClass === 'ENVOY') {
      const rotTarget = aliveUnits(initialSquad).find((unit) => unit.unitId);
      if (rotTarget?.unitId) {
        classCombatRef.current.veilRotStacks[rotTarget.unitId] = CATACLYSM_ROT_GATE;
      }
      const rotReady = evaluateEnvoyCataclysmReady(classCombatRef.current, initialSquad);
      const ready = rotReady && canFireWeaponUltimate(activeWeaponFamilyId);
      classCombatRef.current.cataclysmReady = ready;
      cataclysmReadyPrevRef.current = ready;
      setCataclysmReadyUi(ready);
      setEnvoyRotStacksUi(totalVeilRotStacks(classCombatRef.current));
      publishSquadUi(initialSquad);
    }
    if (primeUltimateAtStart) {
      log('>> DEV SANDBOX — ultimate charge primed for equipped weapon.');
    }
    setSelectedAbility(null);
    setResolutionOutcome(null);
    setIsPlayerTurn(true);
    // Combat opens on the operative's first turn without calling startPlayerTurn.
    balanceEncounterRef.current.playerTurns = 1;
    setCycleState('TEXT_COMBAT');
    setEnemyActionStage(null);
    preAppliedHpStrikeRef.current = 0;
    enemyStunPendingRef.current = false;
    log('>> COMBAT LINK ESTABLISHED');
    if (encounterModifierRuntimeRef.current) {
      const intro = resolveEncounterModifierIntroLog(encounterModifierRuntimeRef.current);
      encounterModifierRuntimeRef.current = intro.runtime;
      if (intro.logLine) log(intro.logLine);
    }
    encounterModStartLogs.forEach((line) => log(line));
    if (narrativeCombatBoons?.scouted) {
      log('>> SCOUTED BOON — hostile grid entered at −10% current HP.');
    }
    if (narrativeCombatBoons?.veilWard) {
      log('>> VEIL WARD BOON — +15 shield capacity active for this encounter.');
    }
    if (narrativeCombatBoons?.overcharged) {
      log('>> OVERCHARGED BOON — first damaging strike ignores all mitigation.');
    }
    if (entryPrimerAp > 0) {
      log(`>> ADRENALINE PRIMER — +${entryPrimerAp} AP this turn.`);
    }
    if (firstTurnBonusAp > 0) {
      log(`>> VEIL FRONT BONUS — FIRST-TURN +${firstTurnBonusAp} AP.`);
    }
    if (ghostedAp > 0) {
      log('>> GHOSTED BOON — +1 AP on operative first turn.');
    }
    applyPlayerTurnBlueprintHooks();
    log('>> OPERATIVE TURN // Command deck online.');
    {
      const linkAnchor = activeWeaponFamilyId
        ? getWeaponAnchorAttack(activeWeaponFamilyId)
        : null;
      const weaponName = linkAnchor?.weaponDisplayName ?? strikeStats.label;
      const attackName = linkAnchor?.displayName ?? 'BASIC';
      log(`>> WEAPON LINK: ${weaponName} // ${attackName}`);
    }
    if (env.isPlayerBlinded) log('>> ENV: OPERATIVE BLINDED — Counter Stance window tightened 15%.');
    if (env.hasTetanusGlitch) log('>> ENV: TETANUS GLITCH ACTIVE — exhaustion triggers 3 HP bleed.');
    if (env.startingStaminaPenalty > 0) log(`>> ENV: STAMINA PENALTY — entry ceiling reduced to 50.`);
    if (env.isEnemyPhaseShrouded) log('>> ENV: ENEMY PHASE SHROUDED — 20% miss chance on strikes.');
    if (env.bloodFrenzyActive) log('>> BLOOD FRENZY ACTIVE — melee damage leeches 15% to soul anchor.');
    if (env.combatObjective === 'SURVIVE_TURNS') {
      log(`>> DEFEND THE RIFT — survive ${env.survivalTurnsRequired ?? 3} hostile turn cycles.`);
    }
    formatObjectiveBriefing(objectiveSessionRef.current).forEach((line) => log(line));
    if (env.eliteModifier) log(`>> ELITE MODIFIER ACTIVE — ${env.eliteModifier.replace(/_/g, ' ')}`);
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      log(`>> HOSTILE GRID — ${initialSquad.length} unit(s) // threat budget ${threatBudgetRef.current}`);
      initialSquad.forEach((unit) => {
        log(`>> LOCK ${unit.gridSlot}: ${unit.designation} // CLASS ${unit.class}`);
      });
    } else {
      log(`>> ${initialSquad.length} hostile signature(s) on grid.`);
    }    if (entryAr > 0 && operativeClass === 'AEGIS') {
      log(`>> Abyssal reserve pre-charged to ${entryAr}%.`);
    }
    if (operativeClass === 'HEX_SHOT') {
      log(`>> MAGAZINE LOADED — ${maxAmmo}/${maxAmmo} rounds chambered.`);
      if (hexShotBoonMods.autoLoaderOnStart) {
        log('>> [AUTO-LOADER DECK] — full magazine chambered at engagement.');
      }
      if (hexShotBoonMods.maxHpMultiplier > 1) {
        const boosted = combatMaxSoulAnchorRef.current;
        setOperativeHp((p) => {
          const n = Math.min(boosted, p + (boosted - maxSoulAnchor));
          operativeHpRef.current = n;
          return n;
        });
        log('>> [KINETIC DAMPENERS] — defensive rig expands soul anchor ceiling.');
      }
    }
    if (operativeClass === 'ENVOY') {
      dispatchEnvoy({
        type: 'ENVOY_ENCOUNTER_START',
        fluxMaxCap,
        startingFlux: VEIL_FLUX_START - envoyBoonMods.startingFluxPenalty,
        masochisticChannel: envoyBoonMods.masochisticChannel,
      });
      log(`>> VEIL-FLUX RESERVOIR ONLINE — burn-rate economy capped at ${fluxMaxCap}%.`);
    }
    if (operativeClass === 'HEX_SHOT' && hexShotBoons.length > 0) {
      log(`>> HEX-SHOT BOONS ACTIVE — ${hexShotBoons.length} stacked.`);
    }
    if (operativeClass === 'ENVOY' && envoyBoons.length > 0) {
      log(`>> ENVOY BOONS ACTIVE — ${envoyBoons.length} stacked.`);
    }
    if (operativeClass === 'ENVOY' && hasEnvoyBoon(envoyBoons, 'DEEP_RESERVES')) {
      classBoonEncounterRef.current.deepReservesShieldActive = true;
      log('[DEEP RESERVES] >> Kinetic shield online.');
    }
    if (leyLineMutations.length > 0) {
      log(`>> LEY-LINE MUTATIONS ACTIVE — ${leyLineMutations.length} stacked.`);
    }
    bossRuntimeRef.current = bossProfile;
    bossPhaseRef.current = bossProfile?.currentPhase ?? 1;
    if (godModeActive) {
      godModeRef.current = true;
      applyGodModeResources();
      log('>> GOD MODE ACTIVE — 1000 true damage on every attack; resources locked at maximum.');
    }
  };
  useEffect(() => { initCombat(); }, []);

  const applyLethalRetaliation = (dmg: number) => {
    if (godModeRef.current) return;
    if ((env.lethalRetaliationDamage ?? 0) <= 0 || dmg <= 0) return;
    const feedback = env.lethalRetaliationDamage ?? 0;
    log(`[LETHAL RETALIATION] >> Hostile feedback — ${feedback} HP.`);
    if (feedback > 0) {
      playerViewportRef?.current?.triggerDamageEffect('hp');
    }
    setOperativeHp((p) => {
      const n = Math.max(p - feedback, 0);
      operativeHpRef.current = n;
      if (n <= 0) resolve(false);
      return n;
    });
  };

  const applyAbilityResolvedBoons = (abilityId: AegisAbilityId) => {
    lastPlayerAbilityRef.current = abilityId;
    resolveVoidResonanceOnAbilityResolve(
      leyLineMutations,
      abilityId,
      mutationEncounterRef.current,
      log,
    );
    if (boonMatchesAction(leyLineMutations, 'MOMENTUM_TRANSFER', abilityId)) {
      mutationEncounterRef.current.nextKineticApDiscount = 1;
      log('[MOMENTUM TRANSFER] >> Next [KINETIC] action −1 AP.');
    }
  };

  const buildHexHurtEnemy = () => (
    raw: number,
    tag: string,
    options?: {
      channel?: 'KINETIC' | 'OCCULT' | 'TRUE';
      fractureGain?: number;
      targetId?: string;
      abilityId?: HexShotAbilityId;
      rollCrit?: boolean;
      forceCrit?: boolean;
      indirectDamage?: boolean;
      innateArmorPressureLayers?: number;
    },
    targetId?: string,
  ): boolean => {
    const tid = options?.targetId ?? targetId ?? selectedTargetIdRef.current ?? undefined;
    let rollCrit = options?.rollCrit;
    if (options?.forceCrit) rollCrit = true;
    const astralLock = resolveAstralLockCrit(
      tid,
      options?.abilityId,
      options?.abilityId != null && getHexShotAbilityTags(options.abilityId).includes('BALLISTIC'),
      classCombatRef.current,
    );
    if (astralLock.forceCrit) {
      rollCrit = true;
      if (astralLock.consumeLock) {
        classCombatRef.current.astralLockUnitId = null;
        log('[ASTRAL TARGET-LOCK] >> Guaranteed ballistic critical.');
      }
    }
    const plan = activeClassGraftPlanRef.current;
    const scaleCtx = {
      currentAmmo: currentAmmoRef.current,
      maxAmmo,
      veilFlux: veilFluxRef.current,
      fluxMaxCap: envoyCombatStateRef.current.fluxMaxCap,
    };
    const scaled = plan ? scaleClassGraftDamage(raw, plan, scaleCtx) : raw;
    let channel = options?.channel ?? 'KINETIC';
    if (plan?.forceTrueDamage) channel = 'TRUE';
    if (plan?.guaranteedCrit) rollCrit = true;

    const pickTarget = (preferred?: string) => {
      if (plan?.randomTarget) {
        const pool = aliveUnits(squadRef.current);
        return pool[Math.floor(Math.random() * pool.length)]?.unitId ?? preferred;
      }
      return preferred;
    };

    let killed = false;
    const hits = plan?.hitCount ?? 1;
    const strikeTargets = resolveClassGraftStrikeTargetIds(plan, squadRef.current, tid);
    const targetLoop = strikeTargets.length > 0 ? strikeTargets : [pickTarget(tid)].filter(Boolean) as string[];
    for (const strikeTarget of targetLoop) {
      for (let hit = 0; hit < hits; hit += 1) {
        killed = hurtEnemy(scaled, tag, 'STRIKE', {
          channel,
          fractureGain: options?.fractureGain,
          targetId: strikeTarget,
          abilityId: options?.abilityId as AegisAbilityId,
          rollCrit,
          innateArmorPressureLayers: options?.innateArmorPressureLayers,
          indirectDamage: options?.indirectDamage,
        }) || killed;
      }
    }
    if (plan && plan.duplicateCastRatio > 0) {
      const echoTarget = pickTarget(tid);
      if (echoTarget) {
        hurtEnemy(
          Math.floor(scaled * plan.duplicateCastRatio),
          tag,
          'STRIKE',
          {
            channel,
            targetId: echoTarget,
            abilityId: options?.abilityId as AegisAbilityId,
            rollCrit: false,
            echoHit: true,
            indirectDamage: options?.indirectDamage,
          },
        );
      }
    }
    return killed;
  };

  const buildEnvoyHurtEnemy = () => (
    raw: number,
    tag: string,
    options?: {
      channel?: 'KINETIC' | 'OCCULT' | 'TRUE';
      fractureGain?: number;
      targetId?: string;
      abilityId?: EnvoyAbilityId;
      rollCrit?: boolean;
    },
    targetId?: string,
  ): boolean => {
    const tid = options?.targetId ?? targetId ?? selectedTargetIdRef.current ?? undefined;
    const plan = activeClassGraftPlanRef.current;
    const scaleCtx = {
      currentAmmo: currentAmmoRef.current,
      maxAmmo,
      veilFlux: veilFluxRef.current,
      fluxMaxCap: envoyCombatStateRef.current.fluxMaxCap,
    };
    const scaled = plan ? scaleClassGraftDamage(raw, plan, scaleCtx) : raw;
    let strikeRaw = scaled;
    if (options?.abilityId === 'CATACLYSM_SIGIL') {
      strikeRaw += getCataclysmicEchoDamageBonus(classBoonEncounterRef.current);
    }
    let channel = options?.channel ?? 'OCCULT';
    if (plan?.forceTrueDamage) channel = 'TRUE';
    let rollCrit = options?.rollCrit;
    if (plan?.guaranteedCrit) rollCrit = true;

    const pickTarget = (preferred?: string) => {
      if (plan?.randomTarget) {
        const pool = aliveUnits(squadRef.current);
        return pool[Math.floor(Math.random() * pool.length)]?.unitId ?? preferred;
      }
      return preferred;
    };

    let killed = false;
    const hits = plan?.hitCount ?? 1;
    const strikeTargets = resolveClassGraftStrikeTargetIds(plan, squadRef.current, tid);
    const targetLoop = strikeTargets.length > 0 ? strikeTargets : [pickTarget(tid)].filter(Boolean) as string[];
    for (const strikeTarget of targetLoop) {
      for (let hit = 0; hit < hits; hit += 1) {
        killed = hurtEnemy(strikeRaw, tag, 'STRIKE', {
          channel,
          fractureGain: options?.fractureGain,
          targetId: strikeTarget,
          abilityId: options?.abilityId as AegisAbilityId,
          rollCrit,
        }) || killed;
      }
    }
    if (plan && plan.duplicateCastRatio > 0) {
      const echoTarget = pickTarget(tid);
      if (echoTarget) {
        hurtEnemy(
          Math.floor(strikeRaw * plan.duplicateCastRatio),
          tag,
          'STRIKE',
          {
            channel,
            targetId: echoTarget,
            abilityId: options?.abilityId as AegisAbilityId,
            rollCrit: false,
            echoHit: true,
          },
        );
      }
    }
    return killed;
  };

  const applyPlayerGraftDebuff = (debuff: ReturnType<typeof resolveClassGraftFailDebuff>) => {
    if (debuff.playerConcussed) {
      log('>> GRAFT BACKLASH — operative CONCUSSED.');
    }
    if (debuff.playerExposed) {
      log('>> GRAFT BACKLASH — operative EXPOSED.');
    }
  };

  const applyClassGraftCastSetup = (
    graftPlan: ClassGraftCastPlan,
    targetId?: string | null,
  ): boolean => {
    if (graftPlan.extraStaminaCost > 0 && !spendStam(graftPlan.extraStaminaCost)) {
      log('[REJECTED] >> Insufficient stamina for graft tax.');
      return false;
    }
    if (graftPlan.hpCostPct > 0) {
      const hpCost = Math.ceil(maxSoulAnchor * (graftPlan.hpCostPct / 100));
      if (operativeHpRef.current <= hpCost) {
        log('[REJECTED] >> Insufficient soul anchor for graft HP cost.');
        return false;
      }
      setOperativeHp((p) => {
        const n = Math.max(p - hpCost, 0);
        operativeHpRef.current = n;
        return n;
      });
      log(`>> [${graftPlan.graftName.toUpperCase()}] — ${hpCost} HP tithe on cast.`);
    }
    if (graftPlan.evadeBuffPct > 0) {
      combatChanceRef.current.shadowStepEvadeActive = true;
      log(`>> [${graftPlan.graftName.toUpperCase()}] — +${graftPlan.evadeBuffPct}% evade until next turn.`);
    }
    if (graftPlan.selfDebuff) {
      log(`>> [${graftPlan.graftName.toUpperCase()}] — operative afflicted (${graftPlan.selfDebuff}).`);
    }
    if (graftPlan.dealSelfDamage > 0) {
      hurtPlayer(
        graftPlan.dealSelfDamage,
        true,
        `>> [${graftPlan.graftName.toUpperCase()}] — ${graftPlan.dealSelfDamage} self-damage.`,
      );
    }
    const sideEffects = collectClassGraftCastSideEffects(graftPlan, targetId);
    if (sideEffects.grantGhostCamoTurns) {
      classCombatRef.current.ghostCamoTurnsRemaining = Math.max(
        classCombatRef.current.ghostCamoTurnsRemaining,
        sideEffects.grantGhostCamoTurns,
      );
      log(`>> [${graftPlan.graftName.toUpperCase()}] — operative untargetable ${sideEffects.grantGhostCamoTurns} turn(s).`);
    }
    if (sideEffects.playerBleedDamage) {
      hurtPlayer(
        sideEffects.playerBleedDamage,
        true,
        `>> [${graftPlan.graftName.toUpperCase()}] — ${sideEffects.playerBleedDamage} bleed tithe.`,
      );
    }
    for (const { unitId, patch } of sideEffects.targetPatches) {
      const unit = getUnitById(squadRef.current, unitId);
      if (!unit) continue;
      patchUnit(unitId, applyClassGraftTargetPatch(unit, patch));
    }
    applyClassGraftEnemyApDrains(classCombatRef.current, sideEffects.enemyApDrainNextTurn);
    for (const drain of sideEffects.enemyApDrainNextTurn) {
      log(`>> [${graftPlan.graftName.toUpperCase()}] >> Target AP drain primed (−${drain.amount}).`);
    }
    return true;
  };

  const applyClassGraftLootDrop = (kind: string) => {
    if (kind === 'CREDITS') {
      const { next, granted } = accrueGraftSalvageCredits(graftEncounterSafetyRef.current);
      graftEncounterSafetyRef.current = next;
      if (granted > 0) onGraftLootDrop?.(`CREDITS:${granted}`);
      return;
    }
    onGraftLootDrop?.(kind);
  };

  const finalizeHexShotAbilityResult = (
    result: import('../data/hexShotAbilityExecutor').HexShotExecutionResult,
    graftPlan: ClassGraftCastPlan,
    squadBefore: Array<{ id: string | undefined; hp: number }>,
    abilityId: HexShotAbilityId,
  ) => {
    if (!result.ok) {
      playerApRef.current += result.refundAp;
      setPlayerActionPoints(playerApRef.current);
      if (result.refundAmmo) setMagazineAmmo(currentAmmoRef.current + result.refundAmmo);
    } else {
      finalizeClassGraftAfterAbility(
        graftPlan,
        squadBefore,
        squadRef.current,
        log,
        {
          applyFailDebuff: (debuff) => applyPlayerGraftDebuff(resolveClassGraftFailDebuff(debuff)),
          refundAmmo: () => setMagazineAmmo(Math.min(maxAmmo, currentAmmoRef.current + 1)),
          refundAp: () => {
            playerApRef.current += 1;
            setPlayerActionPoints(playerApRef.current);
          },
          dropLoot: applyClassGraftLootDrop,
        },
      );
    }
    if (result.ok) {
      runHexShotOnAbilityResolveBoons({
        boons: hexShotBoons,
        abilityId,
        ok: true,
        squad: squadRef.current,
        encounter: classBoonEncounterRef.current,
        maxStamina,
        currentAmmo: currentAmmoRef.current,
        log,
        restoreStamina: (amount) => applyStamina(staminaRef.current + amount),
        patchUnit,
        grantGuerillaEvade: () => {
          combatChanceRef.current.shadowStepEvadeActive = true;
        },
        dealHotSwapOccult: (amount) => {
          const pool = aliveUnits(squadRef.current);
          const target = pool[Math.floor(Math.random() * pool.length)];
          if (target?.unitId) {
            hurtEnemy(amount, '[HOT-SWAP]', 'STRIKE', {
              channel: 'OCCULT',
              targetId: target.unitId,
              abilityId: abilityId as AegisAbilityId,
              rollCrit: false,
              indirectDamage: true,
            });
          }
        },
      });
      if (graftPlan.effectiveTags.includes('TACTICAL')) {
        dispatchHexShot({
          type: 'HEX_REEVALUATE_ULTIMATE',
          encounter: classCombatRef.current,
          squad: squadRef.current,
        });
      }
      if (abilityUsesBallisticTags(abilityId)) {
        maybePromptReloadAfterBallistic();
      } else if (graftPlan.consumeAllAmmo && currentAmmoRef.current === 0) {
        maybePromptReloadAfterBallistic();
      }
    }
    activeClassGraftPlanRef.current = null;
    publishSquadUi(squadRef.current);
  };

  const executeHexShotClassAbility = (abilityId: HexShotAbilityId) => {
    if (abilityId === 'ZERO_PROTOCOL') {
      log('[REJECTED] >> Zero-Protocol channels via the mastery ping when overcharge and debuff align.');
      return;
    }
    if (cycleState !== 'TEXT_COMBAT' || !canPlayerCommand()) return;
    const graftId = resolveHexShotAbilityGraftId(hexShotAbilityGraftsRef.current, abilityId);
    const graftPlan = buildClassGraftCastPlan('HEX_SHOT', abilityId, graftId);
    activeClassGraftPlanRef.current = graftPlan;
    const cost = resolveClassAbilityCost('HEX_SHOT', abilityId);
    const ultimateSealed = encounterUltimateDisabled
      || isClassUltimateDisabledForEncounter('HEX_SHOT', hexShotAbilityGraftsRef.current, {}, false);
    if (ultimateSealed && cost.isUltimate) {
      log('[REJECTED] >> Ultimate channel sealed by Apex Graft.');
      activeClassGraftPlanRef.current = null;
      return;
    }
    const effectiveAp = applyHexShotTacticalReloadDiscount(
      hexShotBoons,
      abilityId,
      graftPlan.apCost,
      classBoonEncounterRef.current,
      log,
    );
    if (!spendActionPoints(effectiveAp)) {
      log('[REJECTED] >> Insufficient action points.');
      activeClassGraftPlanRef.current = null;
      return;
    }
    activeClassGraftApCostRef.current = effectiveAp;
    if (!applyClassGraftCastSetup(graftPlan, selectedTargetIdRef.current)) {
      playerApRef.current += effectiveAp;
      setPlayerActionPoints(playerApRef.current);
      activeClassGraftPlanRef.current = null;
      return;
    }
    const squadBefore = squadRef.current.map((unit) => ({ id: unit.unitId, hp: unit.currentHp }));
    lastPlayerAbilityRef.current = abilityId;
    // Fresh ammo-effect tracker + hit index for this cast.
    hexAmmoCastTrackerRef.current = createHexAmmoCastTracker();
    hexAmmoHitIndexRef.current = 0;
    const ammoOverride = effectiveGraftAmmoCost(graftPlan, currentAmmoRef.current);

    if (shouldApplyPhantomFeed(abilityId, graftPlan.effectiveTags)) {
      dispatchHexShot({ type: 'HEX_PHANTOM_FEED' });
      log('[PHANTOM FEED] >> Tactical rig cycles +1 round into the magazine.');
    }

    const runExecutor = (ultimatePerformance?: number) => {
      const execResult = executeHexShotAbility({
        abilityId,
        squad: squadRef.current,
        targetId: selectedTargetIdRef.current,
        strikeStats,
        currentAmmo: currentAmmoRef.current,
        maxAmmo,
        maxSoulAnchor,
        classState: classCombatRef.current,
        effectiveTags: graftPlan.effectiveTags,
        resolvedWeapon,
        onMagazineEmptied: () => {
          if (resolvedWeapon) {
            weaponRuntimeRef.current = {
              ...weaponRuntimeRef.current,
              magazineEmptiedThisCombat: true,
            };
          }
        },
        log,
        apCostOverride: graftPlan.apCost,
        ammoCostOverride: ammoOverride,
        ultimatePerformance,
        spendAmmo: (amount: number) => {
          if (
            amount > 0
            && hasHexShotBoon(hexShotBoons, 'VOID_BANDOLEER')
            && (
              getHexShotAbilityTags(abilityId).includes('VOID_AMMO')
              || isUsingWraithglassAmmo(abilityId, hexShotStateRef.current.currentAmmoType)
            )
          ) {
            const hpCost = Math.max(
              1,
              Math.floor(maxSoulAnchor * (hexShotBoonModsRef.current.voidAmmoHpCostPct / 100)),
            );
            setOperativeHp((p) => {
              const n = Math.max(1, p - hpCost);
              operativeHpRef.current = n;
              return n;
            });
            log('[VOID-BANDOLEER] >> Void shot fueled by soul anchor — 0 Ammo spent.');
            return true;
          }
          return spendAmmo(amount);
        },
        spendStamina: spendStam,
        spendStaminaPct: (pct) => {
          const costStam = Math.floor(staminaRef.current * (pct / 100));
          return costStam > 0 && spendStam(costStam);
        },
        hurtEnemy: buildHexHurtEnemy(),
        patchUnit,
        syncSquad,
        healOperative: (amount) => {
          applyHealRef.current(amount);
        },
        setShadowStepEvadeActive: (active) => {
          combatChanceRef.current.shadowStepEvadeActive = active;
        },
        reduceEnemyAp,
        emptyMagazine,
      });
      finalizeHexShotAbilityResult(execResult, graftPlan, squadBefore, abilityId);
    };

    runExecutor();
  };

  const executeEnvoyClassAbility = (abilityId: EnvoyAbilityId) => {
    if (abilityId === 'CATACLYSM_SIGIL') {
      log('[REJECTED] >> Null Circuit procs at 6+ Veil Rot stacks — use the mastery ping.');
      return;
    }
    if (cycleState !== 'TEXT_COMBAT' || !canPlayerCommand()) return;
    const graftId = envoyAbilityGraftsRef.current[abilityId];
    const graftPlan = buildClassGraftCastPlan('ENVOY', abilityId, graftId);
    activeClassGraftPlanRef.current = graftPlan;
    const cost = resolveClassAbilityCost('ENVOY', abilityId);
    const ultimateSealed = encounterUltimateDisabled
      || isClassUltimateDisabledForEncounter('ENVOY', {}, envoyAbilityGraftsRef.current, false);
    if (ultimateSealed && cost.isUltimate) {
      log('[REJECTED] >> Ultimate channel sealed by Apex Graft.');
      activeClassGraftPlanRef.current = null;
      return;
    }
    if (isEnvoyCastBlockedByVoidSiphon(
      graftPlan.effectiveTags,
      envoyCombatStateRef.current.isVoidSiphoned,
      envoyBoonModsRef.current.masochisticChannel,
    )) {
      log('[REJECTED] >> VOID-SIPHONED — SPELL and CURSE channels sealed until flux regenerates.');
      activeClassGraftPlanRef.current = null;
      return;
    }
    let effectiveAp = applyEnvoyWardWeaverApDiscount(
      envoyBoons,
      abilityId,
      graftPlan.apCost,
      classBoonEncounterRef.current,
      log,
    );
    const bloodMagic = tryEnvoyBloodMagicCast(
      envoyBoons,
      effectiveAp,
      playerApRef.current,
      maxSoulAnchor,
      operativeHpRef.current,
      log,
    );
    let apSpent = effectiveAp;
    if (bloodMagic) {
      apSpent = 0;
      setOperativeHp((p) => {
        const n = Math.max(1, p - bloodMagic.hpCost);
        operativeHpRef.current = n;
        return n;
      });
    } else if (!spendActionPoints(effectiveAp)) {
      log('[REJECTED] >> Insufficient action points.');
      activeClassGraftPlanRef.current = null;
      return;
    }
    activeClassGraftApCostRef.current = apSpent;
    if (!applyClassGraftCastSetup(graftPlan, selectedTargetIdRef.current)) {
      playerApRef.current += apSpent;
      setPlayerActionPoints(playerApRef.current);
      activeClassGraftPlanRef.current = null;
      return;
    }
    const squadBefore = squadRef.current.map((unit) => ({ id: unit.unitId, hp: unit.currentHp }));
    lastPlayerAbilityRef.current = abilityId;

    const runExecutor = (ultimatePerformance?: number) => {
      const execResult = executeEnvoyAbility({
        abilityId,
        squad: squadRef.current,
        targetId: selectedTargetIdRef.current,
        veilFlux: veilFluxRef.current,
        maxSoulAnchor,
        classState: classCombatRef.current,
        log,
        apCostOverride: graftPlan.apCost,
        fluxRegenOverride: graftPlan.fluxRegen,
        fluxCostOverride: graftPlan.fluxCost,
        ultimatePerformance,
        resolvedWeapon,
        weaponRuntime: weaponRuntimeRef.current,
        operativeHp: operativeHpRef.current,
        applyWeaponRuntimePatch,
        applyVeilFluxBonus: (delta) => applyVeilFlux(delta),
        applyHpSacrifice: (amount) => {
          if (amount <= 0) return;
          setOperativeHp((p) => {
            const n = Math.max(1, p - amount);
            operativeHpRef.current = n;
            return n;
          });
        },
        sessionExtras: sessionExtrasRef.current,
        spendStamina: spendStam,
        applyFluxDelta: (delta) => applyVeilFlux(delta),
        hurtEnemy: buildEnvoyHurtEnemy(),
        patchUnit,
        syncSquad,
        healOperative: (amount) => {
          applyHealRef.current(amount);
        },
        setShadowStepEvadeActive: (active) => {
          combatChanceRef.current.shadowStepEvadeActive = active;
        },
        reduceEnemyAp,
        cancelEnemyPreparedAttack: (unitId) => {
          if (enemyRef.current?.unitId === unitId && enemyActionStageRef.current === 'reading') {
            setEnemyActionStage(null);
            log('[MIND-SUNDER] >> Prepared attack cancelled.');
            classLoopTelemetryRef.current.channelsDisrupted += 1;
            log('[ENVOY] >> Ritual Collapsed — intent interrupted.');
          }
        },
      });
      if (!execResult.ok) {
        playerApRef.current += execResult.refundAp;
        setPlayerActionPoints(playerApRef.current);
      } else {
        // Phase 3 — prime Envoy catalyst + sequence payoff.
        const cat = catalystForEnvoyAbility(abilityId);
        if (cat) {
          const { previous, current } = primeEnvoyCatalyst(classCombatRef.current, cat);
          classLoopTelemetryRef.current.catalystsPrimed += 1;
          if (cat === 'ASH' || abilityId === 'RIFT_WARD' || abilityId === 'PHASE_STEP') {
            classLoopTelemetryRef.current.defensiveCatalystUses += 1;
          }
          const targetId = selectedTargetIdRef.current;
          const target = targetId ? getUnitById(squadRef.current, targetId) : null;
          const payoff = resolveEnvoyCatalystSequence(previous, current, target);
          if (previous) classLoopTelemetryRef.current.catalystSequencesTriggered += 1;
          payoff.logMessages.forEach((m) => log(`[CATALYST] >> ${m}`));
          if (previous && payoff.logMessages.length > 0) {
            emitJuice('ENVOY_CATALYST_RESONANCE', {
              text: payoff.logMessages[0],
            });
          }
          if (target?.unitId && (payoff.extraWardBreak || payoff.fractureTarget)) {
            const patched = applyEnvoyCatalystPayoffToTarget(target, payoff);
            patchUnit(target.unitId, patched);
            if (payoff.extraWardBreak) {
              classLoopTelemetryRef.current.wardsBroken += payoff.extraWardBreak;
            }
            if (payoff.fractureTarget) {
              classLoopTelemetryRef.current.fracturesAppliedByClass += 1;
            }
          }
          if (payoff.healAmount) {
            applyHealRef.current(payoff.healAmount);
          }
          if (payoff.shieldAmount) {
            sessionExtrasRef.current.playerShield =
              (sessionExtrasRef.current.playerShield ?? 0) + payoff.shieldAmount;
          }
          if (target && isEnemyFractured(target)) {
            classLoopTelemetryRef.current.fractureExploits += 1;
          }
        }
        let fluxDelta = execResult.fluxDelta ?? 0;
        fluxDelta = runEnvoyOnAbilityResolveBoons({
          boons: envoyBoons,
          abilityId,
          ok: true,
          squad: squadRef.current,
          targetId: selectedTargetIdRef.current,
          classState: classCombatRef.current,
          encounter: classBoonEncounterRef.current,
          fluxDelta,
          veilFluxBeforeCast: veilFluxRef.current,
          fluxMaxCap: envoyCombatStateRef.current.fluxMaxCap,
          maxHp: maxSoulAnchor,
          log,
          patchUnit,
          applyOccultShield: (amount) => {
            sessionExtrasRef.current.playerShield = (sessionExtrasRef.current.playerShield ?? 0) + amount;
          },
          healOperative: (amount) => {
            applyHealRef.current(amount);
          },
          echoSpellDamage: (amount, targetId) => {
            hurtEnemy(amount, '[ECHOING AETHER]', 'STRIKE', {
              channel: 'OCCULT',
              targetId,
              abilityId: abilityId as AegisAbilityId,
              rollCrit: false,
              echoHit: true,
            });
          },
          stripAllKineticArmor: () => {
            for (const unit of aliveUnits(squadRef.current)) {
              if (!unit.unitId) continue;
              patchUnit(unit.unitId, { kineticArmor: 0, baseKineticArmor: 0 });
            }
          },
        });
        if (fluxDelta !== 0) applyVeilFlux(fluxDelta);
        syncEnvoyFleshRotArmorDebuff(
          envoyBoons,
          squadRef.current,
          classCombatRef.current,
          patchUnit,
        );
        finalizeClassGraftAfterAbility(
          graftPlan,
          squadBefore,
          squadRef.current,
          log,
          {
            applyFailDebuff: (debuff) => applyPlayerGraftDebuff(resolveClassGraftFailDebuff(debuff)),
            refundAp: () => {
              playerApRef.current += 1;
              setPlayerActionPoints(playerApRef.current);
            },
            dropLoot: applyClassGraftLootDrop,
          },
        );
      }
      activeClassGraftPlanRef.current = null;
      publishSquadUi(squadRef.current);
    };

    runExecutor();
  };

  const executeOperativeAbility = (abilityId: string) => {
    if (operativeClass === 'HEX_SHOT') {
      executeHexShotClassAbility(abilityId as HexShotAbilityId);
      return;
    }
    if (operativeClass === 'ENVOY') {
      executeEnvoyClassAbility(abilityId as EnvoyAbilityId);
      return;
    }
    executeAbility(abilityId as AegisAbilityId);
  };
  executeOperativeAbilityRef.current = executeOperativeAbility;

  const executeAbility = (abilityId: AegisAbilityId) => {
    if (cycleState !== 'TEXT_COMBAT' || !canPlayerCommand() || !enemyRef.current) return;
    if (
      abilityId === 'STRIKE'
      && shouldUseWardenStrikePresentation({
        weaponFamilyId: resolvedWeapon?.familyId,
        abilityId: 'STRIKE',
      })
      && isWardenStrikeInputGuarded()
    ) {
      return;
    }
    if (
      encounterUltimateDisabled
      && getAbilityTags(abilityId).includes('ULTIMATE')
    ) {
      log('[REJECTED] >> Ultimate channel sealed by Apex Graft.');
      return;
    }
    if (
      hasStructuredDebuff(sessionExtrasRef.current, 'ASHEN_ROT')
      && isBuffOrDefendAbility(abilityId)
    ) {
      const rotCost = 50;
      applyStamina(Math.max(0, staminaRef.current - rotCost));
      log(`>> ROT TRIGGERED! −${rotCost} Stamina`);
    }
    const def = getAbilityDefinition(abilityId);
    const graftId = abilityGraftsRef.current[abilityId];
    const graftPlan = buildGraftCastPlan(abilityId, graftId);
    activeGraftPlanRef.current = graftPlan;
    activeGraftApCostRef.current = graftPlan.apCost;

    const graftCooldown = graftCooldownsRef.current[abilityId] ?? 0;
    if (graftCooldown > 0) {
      log(`[REJECTED] >> Graft cooldown active (${graftCooldown} turn${graftCooldown === 1 ? '' : 's'}).`);
      activeGraftPlanRef.current = null;
      return;
    }

    const graftAfford = canAffordGraftResources(
      graftPlan,
      abyssalRef.current,
      classCombatRef.current.runicBrands,
    );
    if (!graftAfford.ok) {
      log(`[REJECTED] >> Graft ${graftAfford.reason}.`);
      activeGraftPlanRef.current = null;
      return;
    }

    let apCost = graftPlan.apCost;
    if (
      mutationEncounterRef.current.nextKineticApDiscount > 0
      && graftPlan.effectiveTags.includes('KINETIC')
    ) {
      apCost = Math.max(0, apCost - mutationEncounterRef.current.nextKineticApDiscount);
      mutationEncounterRef.current.nextKineticApDiscount = 0;
    }
    if (!spendActionPoints(apCost)) {
      log('[REJECTED] >> Insufficient action points.');
      activeGraftPlanRef.current = null;
      return;
    }

    if (graftPlan.hpCostPct > (def.hpCostPct ?? 0)) {
      const extraHpPct = graftPlan.hpCostPct - (def.hpCostPct ?? 0);
      const hpCost = Math.ceil(maxSoulAnchor * (extraHpPct / 100));
      if (operativeHpRef.current <= hpCost) {
        log('[REJECTED] >> Insufficient soul anchor for graft HP cost.');
        playerApRef.current += apCost;
        setPlayerActionPoints(playerApRef.current);
        activeGraftPlanRef.current = null;
        return;
      }
      setOperativeHp((p) => {
        const n = Math.max(p - hpCost, 0);
        operativeHpRef.current = n;
        if (n <= 0) resolve(false);
        return n;
      });
      log(`>> [${graftPlan.graftName.toUpperCase()}] — ${hpCost} HP tithe on cast.`);
    }

    activeGraftReserveSpentRef.current = 0;
    if (graftPlan.brandTax > 0) {
      if (classCombatRef.current.runicBrands < graftPlan.brandTax) {
        log(`[REJECTED] >> Graft requires ${graftPlan.brandTax} Runic Brand${graftPlan.brandTax === 1 ? '' : 's'}.`);
        playerApRef.current += apCost;
        setPlayerActionPoints(playerApRef.current);
        activeGraftPlanRef.current = null;
        return;
      }
      consumeRunicBrands(graftPlan.brandTax);
      log(`>> [${graftPlan.graftName.toUpperCase()}] — ${graftPlan.brandTax} Runic Brand${graftPlan.brandTax === 1 ? '' : 's'} tithed.`);
    }
    if (graftPlan.consumeAllReserve) {
      activeGraftReserveSpentRef.current = abyssalRef.current;
      abyssalRef.current = 0;
      setAbyssalReserve(0);
      log(`>> [${graftPlan.graftName.toUpperCase()}] — all Reserve detonated (${activeGraftReserveSpentRef.current}%).`);
    } else if (graftPlan.reservePenalty > 0) {
      if (abyssalRef.current < graftPlan.reservePenalty) {
        log(`[REJECTED] >> Insufficient Reserve for graft tax (${graftPlan.reservePenalty}%).`);
        playerApRef.current += apCost;
        setPlayerActionPoints(playerApRef.current);
        activeGraftPlanRef.current = null;
        return;
      }
      const nextReserve = abyssalRef.current - graftPlan.reservePenalty;
      abyssalRef.current = nextReserve;
      setAbyssalReserve(nextReserve);
      log(`>> [${graftPlan.graftName.toUpperCase()}] — ${graftPlan.reservePenalty}% Reserve taxed.`);
    }

    if (graftPlan.grantShieldHits > 0) {
      mutationEncounterRef.current.juggernautShield = true;
      log(`>> [${graftPlan.graftName.toUpperCase()}] — ${graftPlan.grantShieldHits}-hit graft shield online.`);
    }
    if (graftPlan.evadeBuffPct > 0) {
      combatChanceRef.current.shadowStepEvadeActive = true;
      log(`>> [${graftPlan.graftName.toUpperCase()}] — +${graftPlan.evadeBuffPct}% evade until next turn.`);
    }
    if (graftPlan.cooldownTurns > 0) {
      graftCooldownsRef.current[abilityId] = graftPlan.cooldownTurns;
    }

    const squadBeforeAbility = squadRef.current.map((unit) => ({ ...unit, currentHp: unit.currentHp }));
    applyAbilityResolvedBoons(abilityId);

    const runtimeAbilityId = toRuntimeClassBasicId(abilityId, activeWeaponFamilyId);
    const equippedAnchor = activeWeaponFamilyId
      ? getWeaponAnchorAttack(activeWeaponFamilyId)
      : null;

    switch (runtimeAbilityId) {
      case 'STRIKE': {
        const targetBefore = enemyRef.current;
        const targetFractured = !!(targetBefore && isEnemyFractured(targetBefore));
        const weaponPlan = resolvedWeapon
          ? resolveAegisStrikeBasic({
            weapon: resolvedWeapon,
            runtime: weaponRuntimeRef.current,
            targetFractured,
          })
          : null;
        if (weaponPlan?.staminaCost && !spendStam(weaponPlan.staminaCost)) {
          log('[REJECTED] >> Insufficient stamina for heavy strike.');
          playerApRef.current += activeGraftApCostRef.current;
          setPlayerActionPoints(playerApRef.current);
          activeGraftPlanRef.current = null;
          return;
        }
        weaponPlan?.logLines.forEach((line) => log(line));
        const kinetic = weaponPlan?.kineticDamage ?? (def.baseKineticDamage ?? 10);
        const playerActionId = `pa-strike-${Date.now()}`;
        wardenPlayerActionIdRef.current = playerActionId;
        riposteCashedActionIdRef.current = null;
        ripostePrimaryTargetIdRef.current = targetBefore?.unitId
          ?? selectedTargetIdRef.current
          ?? primaryAliveUnit(squadRef.current)?.unitId
          ?? null;
        wardenRiposteBonusRef.current = 0;
        const strikeTag = `[${equippedAnchor?.displayName ?? "WARDEN'S STRIKE"}]`;
        const eradicated = hurtEnemy(kinetic, strikeTag, 'STRIKE', {
          channel: 'KINETIC',
          fractureGain: weaponPlan?.fractureGain ?? 25,
          abilityId: 'STRIKE',
          actionKind: 'STRIKE',
          playerActionKind: 'STRIKE',
          playerActionId,
        });
        if (weaponPlan?.occultRiderDamage && weaponPlan.occultRiderDamage > 0 && !eradicated) {
          hurtEnemy(weaponPlan.occultRiderDamage, '[VEIL EDGE RIDER]', 'STRIKE', {
            channel: 'OCCULT',
            fractureGain: 0,
            abilityId: 'STRIKE',
            playerActionKind: 'STRIKE',
            playerActionId,
            nestedPresentation: true,
          });
        }
        if (weaponPlan?.consumeTempo) {
          weaponRuntimeRef.current = consumeRiftEdgeTempo(weaponRuntimeRef.current);
        }
        const struck = enemyRef.current;
        chargeAr(weaponPlan?.reserveGain ?? def.reserveGain ?? 15, struck != null && isEnemyFractured(struck));
        imprintRunicBrand(def.brandsImprinted ?? 1);
        if (struck && fractureRatio(struck) > 0.5) {
          syncEnemy(addCombatTag(struck, 'CONCUSSED'));
        }
        applyLethalRetaliation(kinetic);
        if (eradicated) return;
        break;
      }
      case 'VEIL_PIERCER': {
        const occult = Math.max(8, Math.floor(strikeStats.strikeDamage * 0.85));
        const eradicated = hurtEnemy(occult, '[VEIL-PIERCER]', 'STRIKE', {
          channel: 'OCCULT',
          fractureGain: 15,
          abilityId: 'VEIL_PIERCER',
          ignoreDefenses: true,
        });
        chargeAr(def.reserveGain ?? 20);
        imprintRunicBrand(def.brandsImprinted ?? 1);
        if (eradicated) return;
        break;
      }
      case 'WRAITH_PARRY':
        log('[REJECTED] >> Void Ward is primed via [ PARRY ] — remove Wraith Parry from loadout.');
        playerApRef.current += def.apCost;
        setPlayerActionPoints(playerApRef.current);
        return;
      case 'RUIN':
      case 'GRAVE_BIND':
      case 'SHADOW_STEP':
      case 'NAIL_TO_GRID':
      case 'ASHEN_MANTLE':
      case 'BLOOD_TITHE':
      case 'DEMONS_LUNG':
      case 'CRIMSON_PACT':
      case 'DEVASTATE':
      case 'ABYSSAL_FAULT':
      case 'BLOOD_BOUND_CARAPACE':
      case 'REAVE': {
        const result = executeExtendedAbility({
          abilityId,
          squad: squadRef.current,
          targetId: selectedTargetIdRef.current,
          strikeStats,
          stamina: staminaRef.current,
          abyssalReserve: abyssalRef.current,
          operativeHp: operativeHpRef.current,
          maxSoulAnchor,
          runicBrands: classCombatRef.current.runicBrands,
          buffState: combatBuffRef.current,
          log,
          spendStamina: (cost) => spendStam(cost),
          spendStaminaPct: (pct) => {
            const cost = Math.floor(staminaRef.current * (pct / 100));
            return cost > 0 && spendStam(cost);
          },
          hurtEnemy: (raw, tag, source, opts, targetId) =>
            hurtEnemy(raw, tag, source as KineticDamageSource | undefined, {
              ...opts,
              targetId: targetId ?? opts?.targetId,
            }),
          patchUnit,
          syncSquad,
          chargeAr,
          consumeAbyssalPct: (pct) => {
            const consumed = Math.floor(abyssalRef.current * (pct / 100));
            const next = Math.max(0, abyssalRef.current - consumed);
            abyssalRef.current = next;
            setAbyssalReserve(next);
            return consumed;
          },
          consumeAbyssalFlat: (amount) => {
            if (abyssalRef.current < amount) return false;
            const next = abyssalRef.current - amount;
            abyssalRef.current = next;
            setAbyssalReserve(next);
            return true;
          },
          healOperative: (amount) => applyHealRef.current(amount),
          sacrificeHpPct: (pct) => {
            const cost = Math.ceil(maxSoulAnchor * (pct / 100));
            if (operativeHpRef.current <= cost) return false;
            setOperativeHp((p) => {
              const n = Math.max(p - cost, 0);
              operativeHpRef.current = n;
              if (n <= 0) resolve(false);
              return n;
            });
            return true;
          },
          grantBonusAp: (amount) => {
            combatBuffRef.current.bonusApThisTurn += amount;
            playerApRef.current += amount;
            setPlayerActionPoints(playerApRef.current);
          },
          grantBonusApNextTurn: (amount) => {
            combatBuffRef.current.bonusApNextTurn += amount;
          },
          setAegisOvercharged: (active) => {
            sessionExtrasRef.current.overchargedActive = active;
            setAegisOvercharged(active);
          },
          imprintBrand: (count) => imprintRunicBrand(count),
          setRunicBrands: setRunicBrandCount,
          consumeBrands: (mode) => consumeRunicBrands(mode),
          restoreStaminaPct: (pct) => {
            const restored = Math.floor(maxStamina * (pct / 100));
            applyStamina(staminaRef.current + restored);
          },
          reduceEnemyAp: (unitId, amount) => {
            const unit = getUnitById(squadRef.current, unitId);
            if (!unit) return;
            const nextAp = Math.max(0, (unit.enemyActionPoints ?? 1) - amount);
            patchUnit(unitId, { enemyActionPoints: nextAp });
          },
          ownedBoons: leyLineMutations,
          mutationMods: mutationModsRef.current,
          bloodTitheCooldown: mutationEncounterRef.current.bloodTitheCooldown,
          ashenMantleCooldown: mutationEncounterRef.current.ashenMantleCooldown,
          setBloodTitheCooldown: (turns) => {
            mutationEncounterRef.current.bloodTitheCooldown = turns;
          },
          setAshenMantleCooldown: (turns) => {
            mutationEncounterRef.current.ashenMantleCooldown = turns;
          },
          setVeilTarTurns: (turns) => {
            mutationEncounterRef.current.veilTarTurnsRemaining = turns;
          },
          activateBloodBoundCarapace: () => {
            bloodBoundCarapaceRef.current = true;
          },
          applyReaveBleed: (unitId, turns) => {
            mutationEncounterRef.current.reaveBleedUnits[unitId] = turns;
          },
          setShadowStepEvadeActive: (active) => {
            combatChanceRef.current.shadowStepEvadeActive = active;
          },
          setAshenMantleActive: (turns) => {
            combatBuffRef.current.ashenMantleTurnsRemaining = turns;
            setAbyssalWardActive(turns > 0);
            markPlayerDefendedRef.current();
          },
        });
        if (result.ok && abilityId === 'RUIN') {
          setRuinVfxSeq((n) => n + 1);
        }
        if (
          result.ok
          && boonMatchesAction(leyLineMutations, 'VENOMOUS_RUIN', abilityId)
          && mutationModsRef.current.ruinDotFracture > 0
        ) {
          for (const unit of aliveUnits(squadRef.current)) {
            if (unit.unitId) mutationEncounterRef.current.venomousRuinUnits.add(unit.unitId);
          }
          log('[VENOMOUS RUIN] >> Lingering fracture hazard seeded.');
        }
        if (result.ok && boonMatchesAction(leyLineMutations, 'JUGGERNAUT_PLATING', abilityId)) {
          mutationEncounterRef.current.juggernautShield = true;
          log('[JUGGERNAUT PLATING] >> Mobility shield primed.');
        }
        if (abilityId === 'SHADOW_STEP' && result.ok) {
          setInitiativeQueued(combatBuffRef.current.initiativeQueued);
        }
        if (!result.ok) {
          playerApRef.current += result.refundAp;
          setPlayerActionPoints(playerApRef.current);
        } else if (result.squad) {
          syncSquad(result.squad);
        }
        break;
      }
      default:
        log('[REJECTED] >> Ability not available.');
        playerApRef.current += apCost;
        setPlayerActionPoints(playerApRef.current);
        break;
    }

    const anyHostileKilled = squadBeforeAbility.some((before) => {
      if (!before.unitId) return false;
      const after = getUnitById(squadRef.current, before.unitId);
      return before.currentHp > 0 && (after == null || after.currentHp <= 0);
    });
    if (graftPlan.failDebuff && !anyHostileKilled) {
      log(`>> [${graftPlan.graftName.toUpperCase()}] — non-lethal cast, operative CONCUSSED.`);
    }
    if (graftPlan.reserveGenerationBonus > 0) {
      const reserveGain = Math.floor(
        graftPlan.reserveGenerationBonus * graftPlan.reserveGenerationMultiplier,
      );
      if (reserveGain > 0) {
        chargeAr(reserveGain);
        log(`>> [${graftPlan.graftName.toUpperCase()}] — +${reserveGain} Abyssal Reserve.`);
      }
    }

    activeGraftPlanRef.current = null;
    activeGraftReserveSpentRef.current = 0;
  };

  const onInitiativeProcComplete = useCallback(() => {
    setApRollupDisplay(null);
    shadowstepProcRef.current = false;
    setShadowstepProcActive(false);
  }, []);

  useEffect(() => () => {
    if (apRollupFrameRef.current != null) {
      cancelAnimationFrame(apRollupFrameRef.current);
    }
  }, []);

  const runShadowstepInitiativeProc = useCallback(() => {
    if (shadowstepProcRef.current || isCombatTerminal()) return;
    shadowstepProcRef.current = true;
    setShadowstepProcActive(true);
    combatBuffRef.current.initiativeQueued = false;
    setInitiativeQueued(false);
    setSelectedAbility(null);

    const startAp = playerApRef.current;
    const maxAp = PLAYER_ACTION_POINTS_PER_TURN;
    setApRollupDisplay(startAp);
    setInitiativeProcSeq((seq) => seq + 1);

    const rollupMs = 300;
    const startTime = Date.now();
    let peakFired = false;

    const tickApRollup = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(1, elapsed / rollupMs);
      const displayed = Math.round(startAp + (maxAp - startAp) * t);
      setApRollupDisplay(displayed);

      if (t >= 1 && !peakFired) {
        peakFired = true;
        playerApRef.current = maxAp;
        setPlayerActionPoints(maxAp);
        Vibration.vibrate([0, 12, 24, 48]);
        log('[SHADOW STEP] >> Initiative seized — bonus turn active.');
      }

      if (t < 1) {
        apRollupFrameRef.current = requestAnimationFrame(tickApRollup);
      } else {
        apRollupFrameRef.current = null;
      }
    };

    apRollupFrameRef.current = requestAnimationFrame(tickApRollup);
  }, [log]);

  const isMomentumShiftDepleted = (): boolean => (
    operativeClass === 'AEGIS'
      ? abyssalRef.current <= 0
      : staminaRef.current <= 0
  );

  const onEndTurn = () => {
    if (cycleState !== 'TEXT_COMBAT' || !isPlayerTurn || shadowstepProcRef.current || activeReloadVisible) return;
    Vibration.vibrate(12);
    if (combatBuffRef.current.initiativeQueued) {
      if (hasMutation(leyLineMutations, 'MOMENTUM_SHIFT') && isMomentumShiftDepleted()) {
        mutationEncounterRef.current.momentumShiftPending = true;
        combatChanceRef.current.momentumShiftEvadeDisabled = true;
      }
      runShadowstepInitiativeProc();
      return;
    }
    if (hasMutation(leyLineMutations, 'MOMENTUM_SHIFT') && isMomentumShiftDepleted()) {
      mutationEncounterRef.current.momentumShiftPending = true;
      combatChanceRef.current.momentumShiftEvadeDisabled = true;
    }
    passToEnemy(voidWardPrimedRef.current);
  };

  const onUltimatePing = () => {
    if (cycleState !== 'TEXT_COMBAT' || !isPlayerTurn) return;
    if (encounterUltimateDisabled) {
      log('[REJECTED] >> Ultimate channel sealed by Apex Graft.');
      return;
    }
    const activationToken = createUltimateActivationToken();
    ultimateActivationTokenRef.current = activationToken;
    traceUltimateActivation({
      event: 'ultimate-control-activated',
      weaponFamilyId: activeWeaponFamilyId,
      ultimateId: activeUltimateRecord?.id ?? null,
      activationToken,
    });
    const inputMode = resolveWeaponUltimateInputMode({
      simplifiedUltimateInputs: simplifiedUltimateInputs === true,
    });
    const skipMinigame = shouldSkipUltimateMinigame(inputMode);

    if (zeroProtocolReady) {
      if (skipMinigame) {
        const taps = buildSimplifiedUltimateRawResult('ZERO_PROTOCOL').tapCount ?? 1;
        log('>> [ZERO PROTOCOL] >> Simplified inputs — STANDARD grade commit.');
        finishZeroProtocol(taps, true);
        return;
      }
      zeroProtocolActiveRef.current = true;
      setZeroProtocolVisible(true);
      combatPausedRef.current = true;
      traceUltimateActivation({
        event: 'ultimate-interaction-requested',
        weaponFamilyId: activeWeaponFamilyId,
        ultimateId: 'ZERO_PROTOCOL',
        activationToken,
        interactionId: 'ZERO_PROTOCOL_GRID',
      });
      log('>> [ZERO PROTOCOL] >> Rapid execution grid online.');
      return;
    }
    if (cataclysmReady) {
      if (skipMinigame) {
        const nodes = buildSimplifiedUltimateRawResult('NULL_CIRCUIT').nodesCompleted ?? 1;
        log('>> [NULL CIRCUIT] >> Simplified inputs — STANDARD grade commit.');
        handleCataclysmResolve(nodes, true);
        return;
      }
      setCataclysmSigilVisible(true);
      combatPausedRef.current = true;
      traceUltimateActivation({
        event: 'ultimate-interaction-requested',
        weaponFamilyId: activeWeaponFamilyId,
        ultimateId: 'NULL_CIRCUIT',
        activationToken,
        interactionId: 'NULL_CIRCUIT_SIGIL',
      });
      log('>> [NULL CIRCUIT] >> Trace the void pattern.');
      return;
    }
    if (sliceReady) {
      if (skipMinigame) {
        log(`>> [${ABYSSAL_VERDICT_DISPLAY_NAME}] >> Simplified inputs — STANDARD grade commit.`);
        commitThreefoldBrandSimplified();
        return;
      }
      traceUltimateActivation({
        event: 'ultimate-interaction-requested',
        weaponFamilyId: activeWeaponFamilyId,
        ultimateId: 'THREEFOLD_BRAND',
        activationToken,
        interactionId: 'THREEFOLD_BRAND_SLICE',
      });
      onSlice();
      return;
    }
    if (stagedUltimateReady && activeUltimateRecord) {
      if (
        activeUltimateRecord.id === 'LAST_KNOCK'
        && currentAmmoRef.current <= 0
      ) {
        log('[LAST KNOCK] >> RELOAD REQUIRED — no rounds chambered.');
        return;
      }
      const tag = formatWeaponUltimateLogTag(activeUltimateRecord.weaponFamilyId);
      stagedWeaponUltimateIdRef.current = activeUltimateRecord.id;
      if (skipMinigame) {
        log(`>> ${tag} >> Simplified inputs — STANDARD grade commit.`);
        commitStagedWeaponUltimate('STANDARD', true);
        return;
      }
      setStagedWeaponUltimateId(activeUltimateRecord.id);
      combatPausedRef.current = true;
      traceUltimateActivation({
        event: 'ultimate-interaction-requested',
        weaponFamilyId: activeUltimateRecord.weaponFamilyId,
        ultimateId: activeUltimateRecord.id,
        activationToken,
        interactionId: 'WU4_STAGED',
      });
      // Interaction open only — no combat mutation / resolution commit yet.
      log(`>> ${tag} >> Interaction ready — complete the skill aperture to commit.`);
    }
  };

  const cancelWeaponUltimateInteraction = () => {
    // Free cancel — never spends Protocol / Rot / Abyssal Reserve.
    if (zeroProtocolVisible || zeroProtocolActiveRef.current) {
      zeroProtocolActiveRef.current = false;
      setZeroProtocolVisible(false);
      combatPausedRef.current = false;
      log('>> [ZERO PROTOCOL] >> Cancelled — free. Protocol Charges retained.');
      return;
    }
    if (cataclysmSigilVisible) {
      setCataclysmSigilVisible(false);
      combatPausedRef.current = false;
      log('>> [NULL CIRCUIT] >> Cancelled — free. Veil Rot retained.');
      return;
    }
    if (stagedWeaponUltimateIdRef.current || stagedWeaponUltimateId) {
      stagedWeaponUltimateIdRef.current = null;
      setStagedWeaponUltimateId(null);
      combatPausedRef.current = false;
      if (activeWeaponFamilyId) {
        log(`>> ${formatWeaponUltimateLogTag(activeWeaponFamilyId)} >> Cancelled — free. Charge retained.`);
      } else {
        log('>> [WEAPON ULTIMATE] >> Cancelled — free. Charge retained.');
      }
      return;
    }
    if (cycleRef.current === 'OFFENSE_SLICE') {
      abortCombatMinigames();
      cycleRef.current = 'TEXT_COMBAT';
      setCycleState('TEXT_COMBAT');
      setEviscerateTargetUnitId(null);
      combatPausedRef.current = false;
      log(`>> [${ABYSSAL_VERDICT_DISPLAY_NAME}] >> Cancelled — free. Abyssal Reserve retained.`);
    }
  };

  const handleZeroProtocolTap = () => {
    if (!zeroProtocolActiveRef.current) return;
    // Taps drive performance/feel only — damage resolves from the Protocol plan.
    triggerHaptic('impactLight');
    triggerShake('micro');
  };

  const pickPrimaryUltimateTarget = (): EnemyCombatProfile | null => {
    const focused = focusedUnitIdRef.current
      ? getUnitById(squadRef.current, focusedUnitIdRef.current)
      : null;
    if (focused?.unitId && isUnitAlive(focused)) return focused;
    return primaryAliveUnit(squadRef.current) ?? null;
  };

  const closeStagedWeaponUltimate = () => {
    stagedWeaponUltimateIdRef.current = null;
    setStagedWeaponUltimateId(null);
    combatPausedRef.current = false;
  };

  const spendAegisUltimateReserve = () => {
    abyssalRef.current = 0;
    setAbyssalReserve(0);
    setRunicBrands(0);
    classCombatRef.current.runicBrands = 0;
    setSuccessfulParryCount(0);
    classCombatRef.current.successfulParryCount = 0;
  };

  const spendHexProtocolCharges = () => {
    dispatchHexShot({
      type: 'HEX_EXECUTE_ZERO_PROTOCOL',
      encounter: classCombatRef.current,
      squad: squadRef.current,
    });
  };

  const spendEnvoyRotUltimateGate = () => {
    purgeAllVeilRotStacks(classCombatRef.current);
    setCataclysmReadyUi(false);
    cataclysmReadyPrevRef.current = false;
    classCombatRef.current.cataclysmReady = false;
    setEnvoyRotStacksUi(0);
  };

  const commitStagedWeaponUltimate = (
    grade: WeaponUltimateGrade,
    forceStandard = false,
  ) => {
    const ultimateId = stagedWeaponUltimateIdRef.current ?? stagedWeaponUltimateId;
    const token = ultimateActivationTokenRef.current;
    if (token && ultimateCommitLockRef.current === token) {
      traceUltimateActivation({
        event: 'ultimate-commit-finished',
        ultimateId,
        activationToken: token,
        detail: 'duplicate-commit-ignored',
      });
      return;
    }
    if (token) ultimateCommitLockRef.current = token;
    closeStagedWeaponUltimate();
    if (!ultimateId || !activeWeaponFamilyId) return;
    traceUltimateActivation({
      event: 'ultimate-commit-started',
      weaponFamilyId: activeWeaponFamilyId,
      ultimateId,
      activationToken: token,
    });
    if (!canFireWeaponUltimate(activeWeaponFamilyId)) {
      log(`[REJECTED] >> ${ultimateId} unavailable for equipped weapon.`);
      return;
    }
    const resolvedGrade: WeaponUltimateGrade = forceStandard ? 'STANDARD' : grade;
    const tag = formatWeaponUltimateLogTag(activeWeaponFamilyId);
    const hookAbilityId = resolveWeaponUltimateLegacyHookAbilityId(activeWeaponFamilyId);
    if (hookAbilityId) {
      lastPlayerAbilityRef.current = hookAbilityId;
    }
    const primary = pickPrimaryUltimateTarget();
    // Pose on ultimate commit — not only when first damage lands (multi-hit / 0-damage edge cases).
    triggerPlayerAttackPose(primary);

    if (ultimateId === 'REND_THE_VEIL') {
      if (!primary?.unitId) {
        log(`${tag} >> No target — channel collapses.`);
        return;
      }
      const tempoArmed = weaponRuntimeRef.current.riftEdgeTempoArmed === true;
      const plan = planRendTheVeil({
        grade: resolvedGrade,
        baseStrike: Math.max(10, strikeStats.strikeDamage),
        tempoArmed,
      });
      hurtEnemy(plan.kineticHitDamage, tag, 'STRIKE', {
        channel: 'KINETIC',
        targetId: primary.unitId,
        abilityId: hookAbilityId as AegisAbilityId | undefined,
        rollCrit: false,
      });
      hurtEnemy(plan.kineticHitDamage, tag, 'STRIKE', {
        channel: 'KINETIC',
        targetId: primary.unitId,
        abilityId: hookAbilityId as AegisAbilityId | undefined,
        rollCrit: false,
      });
      hurtEnemy(plan.occultRuptureDamage, tag, 'STRIKE', {
        channel: 'OCCULT',
        targetId: primary.unitId,
        abilityId: hookAbilityId as AegisAbilityId | undefined,
        rollCrit: false,
      });
      if (plan.consumeTempo) {
        weaponRuntimeRef.current = consumeRiftEdgeTempo(weaponRuntimeRef.current);
      }
      plan.notes.forEach((n) => log(`>> ${tag} ${n}`));
      spendAegisUltimateReserve();
      log(`>> ${tag} >> ${resolvedGrade} — veil rent.`);
      publishSquadUi(squadRef.current);
      if (allUnitsDefeated(squadRef.current)) {
        scheduleCombatVictoryResolution();
        return;
      }
      passToEnemy(false);
      return;
    }

    if (ultimateId === 'GRAVEFALL') {
      if (!primary?.unitId) {
        log(`${tag} >> No target — channel collapses.`);
        return;
      }
      const fractured = isEnemyFractured(primary);
      const plan = planGravefall({
        grade: resolvedGrade,
        baseStrike: Math.max(12, strikeStats.strikeDamage),
        targetFractured: fractured,
      });
      if (resolvedGrade === 'CLEAN' || resolvedGrade === 'PERFECT') {
        const strip = stripKineticArmor(primary, 1);
        if (strip.enemy.unitId) patchUnit(strip.enemy.unitId, strip.enemy);
        const refreshed = getUnitById(squadRef.current, primary.unitId) ?? primary;
        const fracturedNext = applyFractureDamage(refreshed, 18);
        if (fracturedNext.unitId) patchUnit(fracturedNext.unitId, fracturedNext);
      }
      hurtEnemy(plan.impactDamage, tag, 'STRIKE', {
        channel: 'KINETIC',
        targetId: primary.unitId,
        abilityId: hookAbilityId as AegisAbilityId | undefined,
        rollCrit: false,
      });
      if (plan.fractureCashoutHint && primary.unitId) {
        const after = getUnitById(squadRef.current, primary.unitId);
        if (after?.unitId && isUnitAlive(after) && isEnemyFractured(after)) {
          executeFractureBreak(after.unitId);
        }
      }
      if (plan.shockwaveSecondary && primary.unitId) {
        const splash = Math.max(1, Math.floor(plan.impactDamage * 0.35));
        for (const adj of adjacentAliveUnits(squadRef.current, primary.unitId).slice(0, 2)) {
          if (!adj.unitId) continue;
          hurtEnemy(splash, tag, 'STRIKE', {
            channel: 'KINETIC',
            targetId: adj.unitId,
            abilityId: hookAbilityId as AegisAbilityId | undefined,
        rollCrit: false,
          });
        }
      }
      plan.notes.forEach((n) => log(`>> ${tag} ${n}`));
      spendAegisUltimateReserve();
      log(`>> ${tag} >> ${resolvedGrade} — gravefall lands.`);
      publishSquadUi(squadRef.current);
      if (allUnitsDefeated(squadRef.current)) {
        scheduleCombatVictoryResolution();
        return;
      }
      passToEnemy(false);
      return;
    }

    if (ultimateId === 'SIXTH_SEAL') {
      if (!primary?.unitId) {
        log(`${tag} >> No target — channel collapses.`);
        return;
      }
      const plan = planSixthSeal({
        grade: resolvedGrade,
        magSize: Math.max(1, hexShotStateRef.current.maxAmmo),
      });
      const reloadQuality: ReloadQuality =
        plan.reloadQuality === 'PERFECT' ? 'PERFECT' : 'CLEAN';
      const ammoType = hexShotStateRef.current.currentAmmoType;
      dispatchHexShot({
        type: 'HEX_RESOLVE_RELOAD',
        quality: reloadQuality,
        ammoType,
        encounter: classCombatRef.current,
        squad: squadRef.current,
      });
      log(`>> ${tag} >> Cylinder sealed — ${plan.reloadQuality.toLowerCase()} reload (${ammoType}).`);
      const shotDamage = Math.max(
        4,
        Math.floor(strikeStats.strikeDamage * (resolvedGrade === 'PERFECT' ? 0.55 : resolvedGrade === 'CLEAN' ? 0.5 : 0.45)),
      );
      for (let i = 0; i < plan.precisionShots; i += 1) {
        if (currentAmmoRef.current <= 0) break;
        setMagazineAmmo(currentAmmoRef.current - 1);
        hurtEnemy(shotDamage, tag, 'STRIKE', {
          channel: 'KINETIC',
          targetId: primary.unitId,
          abilityId: hookAbilityId as AegisAbilityId | undefined,
        rollCrit: false,
        });
      }
      if (plan.emptyMagazineAfter) {
        setMagazineAmmo(0);
      }
      spendHexProtocolCharges();
      plan.notes.forEach((n) => log(`>> ${tag} ${n}`));
      log(`>> ${tag} >> ${resolvedGrade} — seal closed.`);
      publishSquadUi(squadRef.current);
      if (allUnitsDefeated(squadRef.current)) {
        scheduleCombatVictoryResolution();
        return;
      }
      passToEnemy(false);
      return;
    }

    if (ultimateId === 'LAST_KNOCK') {
      const knockPlan = planLastKnock({
        grade: resolvedGrade,
        currentAmmo: currentAmmoRef.current,
        baseBallistic: Math.max(10, strikeStats.strikeDamage),
      });
      if ('blocked' in knockPlan) {
        log(`[LAST KNOCK] >> ${knockPlan.reason}`);
        return;
      }
      if (!primary?.unitId) {
        log(`${tag} >> No target — channel collapses.`);
        return;
      }
      setMagazineAmmo(0);
      const strip = stripKineticArmor(primary, knockPlan.armorStrip);
      if (strip.enemy.unitId) patchUnit(strip.enemy.unitId, strip.enemy);
      const afterStrip = getUnitById(squadRef.current, primary.unitId) ?? strip.enemy;
      const fracturedNext = applyFractureDamage(afterStrip, knockPlan.fractureBonus);
      if (fracturedNext.unitId) patchUnit(fracturedNext.unitId, fracturedNext);
      hurtEnemy(knockPlan.breachDamage, tag, 'STRIKE', {
        channel: 'KINETIC',
        targetId: primary.unitId,
        abilityId: hookAbilityId as AegisAbilityId | undefined,
        rollCrit: false,
      });
      spendHexProtocolCharges();
      knockPlan.notes.forEach((n) => log(`>> ${tag} ${n}`));
      log(`>> ${tag} >> ${resolvedGrade} — door answered.`);
      publishSquadUi(squadRef.current);
      if (allUnitsDefeated(squadRef.current)) {
        scheduleCombatVictoryResolution();
        return;
      }
      passToEnemy(false);
      return;
    }

    if (ultimateId === 'FUNERAL_KNOT') {
      const plan = planFuneralKnot({
        grade: resolvedGrade,
        baseOccult: Math.max(8, Math.floor(strikeStats.strikeDamage * 0.85)),
      });
      const hurtFn = buildEnvoyHurtEnemy();
      for (const unit of aliveUnits(squadRef.current)) {
        if (!unit.unitId) continue;
        hurtFn(plan.baselineOccult, tag, {
          channel: 'OCCULT',
          targetId: unit.unitId,
          abilityId: hookAbilityId as AegisAbilityId | undefined,
        rollCrit: false,
        }, unit.unitId);
        const lantern = resolveLanternFluxPurgePayoff({
          familyId: 'envoy-echo-lantern',
          classState: classCombatRef.current,
          targetId: unit.unitId,
          baseDamage: Math.max(1, Math.floor(plan.baselineOccult * plan.detonationEfficiency)),
        });
        if (lantern.rotConsume > 0) {
          const bonus = Math.max(
            0,
            Math.floor(lantern.damage * plan.detonationEfficiency) - plan.baselineOccult,
          );
          if (bonus > 0) {
            hurtFn(bonus, tag, {
              channel: 'OCCULT',
              targetId: unit.unitId,
              abilityId: hookAbilityId as AegisAbilityId | undefined,
        rollCrit: false,
            }, unit.unitId);
          }
          consumeVeilRotStacks(classCombatRef.current, unit.unitId, lantern.rotConsume);
          lantern.logLines.forEach((line) => log(line.replace('ECHO LANTERN', 'FUNERAL KNOT')));
        }
      }
      plan.notes.forEach((n) => log(`>> ${tag} ${n}`));
      spendEnvoyRotUltimateGate();
      log(`>> ${tag} >> ${resolvedGrade} — knot torn.`);
      publishSquadUi(squadRef.current);
      if (allUnitsDefeated(squadRef.current)) {
        scheduleCombatVictoryResolution();
        return;
      }
      if (operativeHpRef.current <= 0) return;
      passToEnemy(false);
      return;
    }

    if (ultimateId === 'CRIMSON_REFRACTION') {
      const maxSafe = Math.min(
        PRISM_BASIC_HP_SACRIFICE_MAX,
        Math.max(1, Math.floor(getEffectiveMaxSoulAnchor() * PRISM_BASIC_HP_SACRIFICE_PCT)),
      );
      const plan = planCrimsonRefraction({
        grade: resolvedGrade,
        baseOccult: Math.max(8, Math.floor(strikeStats.strikeDamage * 0.9)),
        offeredHp: maxSafe,
        maxSafeOffer: maxSafe,
        operativeHp: operativeHpRef.current,
        veilFlux: veilFluxRef.current,
        brinkThresholdPct: PRISM_BRINK_FLUX_THRESHOLD,
      });
      if (plan.offeredHp > 0) {
        setOperativeHp((p) => {
          const n = Math.max(1, p - plan.offeredHp);
          operativeHpRef.current = n;
          return n;
        });
      }
      const hurtFn = buildEnvoyHurtEnemy();
      for (const unit of aliveUnits(squadRef.current)) {
        if (!unit.unitId) continue;
        hurtFn(plan.occultPerTarget, tag, {
          channel: 'OCCULT',
          targetId: unit.unitId,
          abilityId: hookAbilityId as AegisAbilityId | undefined,
        rollCrit: false,
        }, unit.unitId);
      }
      plan.notes.forEach((n) => log(`>> ${tag} ${n}`));
      spendEnvoyRotUltimateGate();
      log(`>> ${tag} >> ${resolvedGrade} — refraction complete.`);
      publishSquadUi(squadRef.current);
      if (allUnitsDefeated(squadRef.current)) {
        scheduleCombatVictoryResolution();
        return;
      }
      if (operativeHpRef.current <= 0) return;
      passToEnemy(false);
    }
  };

  const pickZeroProtocolTarget = (): EnemyCombatProfile | null => {
    const alive = aliveUnits(squadRef.current);
    if (alive.length === 0) return null;
    const priority = alive.find((u) => u.isBoss || u.isAlpha);
    if (priority) return priority;
    return alive.reduce((best, u) => ((u.currentHp ?? 0) > (best.currentHp ?? 0) ? u : best), alive[0]);
  };

  const finishZeroProtocol = (tapCount: number, forceStandard = false) => {
    zeroProtocolActiveRef.current = false;
    setZeroProtocolVisible(false);
    combatPausedRef.current = false;
    if (!canFireLegacyClassUltimate('ZERO_PROTOCOL', activeWeaponFamilyId)) {
      log('[REJECTED] >> Zero Protocol requires the Carbine.');
      return;
    }
    const resolved = resolveWeaponUltimateGrade({
      tapCount,
      forceStandard: forceStandard || undefined,
    });
    const performance = gradeToZeroProtocolPerformance(resolved.grade);
    const hexState = hexShotStateRef.current;
    const primary = pickZeroProtocolTarget();
    if (primary && primary.unitId) {
      const targetId = primary.unitId;
      const hasWard = (primary.occultWards ?? 0) > 0;
      const backline = primary.gridSlot?.startsWith('BL') ?? false;
      const target: ZeroProtocolTarget = {
        isBoss: primary.isBoss === true,
        hasKineticArmor: (primary.kineticArmor ?? 0) > 0,
        hasOccultWard: hasWard,
        hasVoidMark: classBoonEncounterRef.current.voidMarkedUnits[targetId] === true,
        isWardedOrSpectralOrBackline: hasWard || backline,
        telegraphing: enemyIsTelegraphing(primary),
      };
      const plan = computeZeroProtocolPlan({
        calibrated: hexState.calibratedAmmoTypes,
        currentAmmoType: hexState.currentAmmoType,
        performance,
        hasMinigameResult: true,
        target,
      });
      // Persistent riders applied before the true-damage burst.
      const armorNext = plan.sunderArmor > 0
        ? Math.max(0, (primary.kineticArmor ?? 0) - plan.sunderArmor)
        : primary.kineticArmor;
      const wardNext = plan.sunderWard > 0
        ? Math.max(0, (primary.occultWards ?? 0) - plan.sunderWard)
        : primary.occultWards;
      if (plan.sunderArmor > 0 || plan.sunderWard > 0) {
        patchUnit(targetId, { kineticArmor: armorNext, occultWards: wardNext });
      }
      if (plan.applyVoidMark) classBoonEncounterRef.current.voidMarkedUnits[targetId] = true;
      if (plan.apReduction > 0 || plan.applyStasisLock) {
        reduceEnemyAp(targetId, Math.max(1, plan.apReduction));
      }
      if (plan.stunNonBoss) reduceEnemyAp(targetId, 99);
      if (plan.bossDamageReductionPct > 0) reduceEnemyAp(targetId, 1);
      plan.notes.forEach((note) => log(`>> [ZERO PROTOCOL] ${note}`));
      triggerPlayerAttackPose(primary);
      hurtEnemy(plan.trueDamage, '[ZERO PROTOCOL]', 'STRIKE', {
        channel: 'TRUE',
        targetId,
        abilityId: 'ZERO_PROTOCOL' as AegisAbilityId,
        rollCrit: false,
      });
    }
    dispatchHexShot({
      type: 'HEX_EXECUTE_ZERO_PROTOCOL',
      encounter: classCombatRef.current,
      squad: squadRef.current,
    });
    log(`>> [ZERO PROTOCOL] >> ${resolved.grade} grade — firing solution complete. Protocol discharged.`);
  };

  const handleCataclysmResolve = (nodesCompleted: number, forceStandard = false) => {
    setCataclysmSigilVisible(false);
    combatPausedRef.current = false;
    if (!canFireLegacyClassUltimate('CATACLYSM_SIGIL', activeWeaponFamilyId)) {
      log('[REJECTED] >> Null Circuit requires the Scythe.');
      return;
    }
    const resolved = resolveWeaponUltimateGrade({
      nodesCompleted,
      forceStandard: forceStandard || undefined,
    });
    const effectiveNodes = resolved.effectiveNodes ?? Math.max(1, nodesCompleted);
    const rotTotal = totalVeilRotStacks(classCombatRef.current);
    const traceMultiplier = cataclysmSigilTraceMultiplier(effectiveNodes);
    const damage = computeCataclysmSigilDamage(rotTotal, traceMultiplier);
    const hurtFn = buildEnvoyHurtEnemy();
    const alive = aliveUnits(squadRef.current);
    triggerPlayerAttackPose(alive[0] ?? null);
    for (const unit of alive) {
      if (!unit.unitId) continue;
      if (getVeilRotStacks(classCombatRef.current, unit.unitId) > 0) {
        runHexBreakerOnRotPurge(envoyBoons, unit, (raw, targetId) => {
          hurtFn(raw, '[HEX-BREAKER]', {
            channel: 'OCCULT',
            targetId,
            rollCrit: false,
          }, targetId);
        }, log);
      }
    }
    for (const unit of alive) {
      if (!unit.unitId) continue;
      if (damage <= 0) break;
      hurtFn(damage, '[NULL CIRCUIT]', {
        channel: 'TRUE',
        targetId: unit.unitId,
        abilityId: 'CATACLYSM_SIGIL',
        rollCrit: false,
      }, unit.unitId);
    }
    purgeAllVeilRotStacks(classCombatRef.current);
    setCataclysmReadyUi(false);
    cataclysmReadyPrevRef.current = false;
    classCombatRef.current.cataclysmReady = false;
    setEnvoyRotStacksUi(0);
    // WU-3: no player backlash on imperfect / 0-node — STANDARD floor commits instead.
    if (resolved.grade === 'PERFECT') {
      triggerHitstop(150);
      triggerShake('heavy');
      triggerHaptic('impactHeavy');
      log(`>> [NULL CIRCUIT] >> PERFECT — pattern locked — ${damage} TRUE to all hostiles. Veil Rot purged.`);
    } else if (resolved.grade === 'CLEAN') {
      triggerShake('light');
      triggerHaptic('impactLight');
      log(
        `>> [NULL CIRCUIT] >> CLEAN (${Math.round(traceMultiplier * 100)}%) — ${damage} TRUE rupture. Veil Rot purged.`,
      );
    } else {
      triggerShake('light');
      triggerHaptic('impactLight');
      log(
        `>> [NULL CIRCUIT] >> STANDARD (${Math.round(traceMultiplier * 100)}%) — ${damage} TRUE rupture. Veil Rot purged.`,
      );
    }
    publishSquadUi(squadRef.current);
    if (allUnitsDefeated(squadRef.current)) {
      scheduleCombatVictoryResolution();
      return;
    }
    if (operativeHpRef.current <= 0) return;
  };

  const expireFractureBreak = (unitId: string) => {
    syncFractureBreakTarget(null);
    combatPausedRef.current = false;
    const unit = getUnitById(squadRef.current, unitId);
    if (unit?.unitId && isUnitAlive(unit)) {
      clearDissolveForLivingUnit(unit.unitId);
      patchUnit(unit.unitId, applyFracturedState(unit));
      log(`>> FRACTURE BREAK EXPIRED — ${unit.designation} enters FRACTURED state.`);
    }
    publishSquadUi(squadRef.current);
    if (allUnitsDefeated(squadRef.current)) {
      scheduleCombatVictoryResolution();
    }
  };

  const executeFractureBreak = (unitId: string) => {
    const unit = getUnitById(squadRef.current, unitId);
    if (!unit?.unitId) {
      syncFractureBreakTarget(null);
      combatPausedRef.current = false;
      publishSquadUi(squadRef.current);
      return;
    }
    fractureShatterSeqRef.current[unit.unitId] =
      (fractureShatterSeqRef.current[unit.unitId] ?? 0) + 1;
    unlockCombatPresentationAudio();
    playCombatPresentationCue('sfx.fracture.break');
    publishSquadUi(squadRef.current);
    const plan = planFractureBreachStrike(operativeClass, strikeStats);
    for (let i = 0; i < plan.hitCount; i += 1) {
      hurtEnemy(plan.damagePerHit, plan.tag, 'STRIKE', {
        channel: plan.channel,
        targetId: unit.unitId,
        rollCrit: plan.rollCrit,
      });
      triggerHaptic('impactLight');
    }
    const afterHits = getUnitById(squadRef.current, unit.unitId);
    if (operativeClass === 'ENVOY') {
      triggerShake('heavy');
      triggerHitstop(120);
    } else if (operativeClass === 'AEGIS') {
      if (afterHits?.unitId && isUnitAlive(afterHits)) {
        clearDissolveForLivingUnit(afterHits.unitId);
        patchUnit(afterHits.unitId, applyFracturedState(afterHits));
      }
      enemyStunPendingRef.current = true;
      triggerHitstop(100);
      triggerHaptic('impactHeavy');
    } else {
      triggerHitstop(80);
    }
    const refreshed = getUnitById(squadRef.current, unit.unitId);
    if (
      refreshed?.unitId
      && isUnitAlive(refreshed)
      && operativeClass !== 'AEGIS'
    ) {
      clearDissolveForLivingUnit(refreshed.unitId);
      patchUnit(refreshed.unitId, applyFracturedState(refreshed));
    }
    syncFractureBreakTarget(null);
    combatPausedRef.current = false;
    log(`>> FRACTURE BREACH — ${unit.designation} executed (${plan.hitCount} hit(s)).`);
    publishSquadUi(squadRef.current);
    if (allUnitsDefeated(squadRef.current)) {
      scheduleCombatVictoryResolution();
    }
  };
  executeFractureBreakRef.current = executeFractureBreak;

  useEffect(() => {
    if (!fractureBreakUnitId) return undefined;
    const timer = setTimeout(() => {
      expireFractureBreak(fractureBreakUnitId);
    }, FRACTURE_BREAK_PROMPT_MS);
    return () => clearTimeout(timer);
  }, [fractureBreakUnitId]);

  const onSlice = () => {
    if (cycleState !== 'TEXT_COMBAT' || !isPlayerTurn) return;
    if (encounterUltimateDisabled) {
      log('[REJECTED] >> Ultimate channel sealed by Apex Graft.');
      return;
    }
    if (!canFireLegacyClassUltimate('EVISCERATE', activeWeaponFamilyId)) {
      log('[REJECTED] >> Threefold Brand requires the Longsword.');
      return;
    }
    if (isExhausted) { log('[REJECTED] >> Exhausted — Threefold Brand offline.'); return; }
    if (abyssalRef.current < COMBAT_ACTION.ABYSSAL_RESERVE_CAP) {
      log('[REJECTED] >> Threefold Brand requires 100% Abyssal Reserve.');
      return;
    }
    log(`[${ABYSSAL_VERDICT_DISPLAY_NAME}] >> Execution aperture open.`);
    triggerSlice();
  };

  const onBloodForTime = () => {
    if (!hasMutation(leyLineMutations, 'BLOOD_FOR_TIME')) return;
    if (cycleState !== 'TEXT_COMBAT' || !isPlayerTurn) return;
    if (mutationEncounterRef.current.bloodForTimeUsed) {
      log('[REJECTED] >> Blood for Time already spent this turn.');
      return;
    }
    const cost = Math.max(1, Math.ceil(operativeHpRef.current * 0.15));
    if (operativeHpRef.current <= cost) {
      log('[REJECTED] >> Insufficient Soul Anchor for Blood for Time.');
      return;
    }
    mutationEncounterRef.current.bloodForTimeUsed = true;
    setOperativeHp((p) => {
      const n = Math.max(p - cost, 0);
      operativeHpRef.current = n;
      if (n <= 0) resolve(false);
      return n;
    });
    playerApRef.current += 1;
    setPlayerActionPoints(playerApRef.current);
    log(`[BLOOD FOR TIME] >> ${cost} HP tithed — +1 AP granted.`);
  };

  const onCatalyticConsole = () => {
    if (operativeClass !== 'ENVOY') return;
    if (cycleState !== 'TEXT_COMBAT' || !isPlayerTurn || shadowstepProcRef.current) return;
    if (catalyticConsoleVisible) return;
    const rotTotal = totalVeilRotStacks(classCombatRef.current);
    if (rotTotal <= 0) {
      log('[REJECTED] >> Catalytic Console requires Veil Rot on the board.');
      return;
    }
    if (playerApRef.current < CATALYTIC_CONSOLE_AP_COST) {
      log('[REJECTED] >> Insufficient AP for Catalytic Console.');
      return;
    }
    playerApRef.current -= CATALYTIC_CONSOLE_AP_COST;
    setPlayerActionPoints(playerApRef.current);
    setCatalyticConsoleVisible(true);
    combatPausedRef.current = true;
    log('>> [CATALYTIC CONSOLE] >> Hold & release against the infected grid.');
  };

  const finalizeCatalyticRelease = (overlapRatio: number) => {
    setCatalyticConsoleVisible(false);
    combatPausedRef.current = false;
    const hurtFn = buildEnvoyHurtEnemy();
    const result = executeCatalyticRelease(
      squadRef.current,
      classCombatRef.current,
      overlapRatio,
      (raw, tag, options, targetId) => hurtFn(raw, tag, options, targetId),
      log,
    );
    if (!result.perfect) {
      applyVeilFlux(-CATALYTIC_SLOPPY_FLUX_PENALTY);
      log(`>> [AETHERIC RUPTURE] — feedback drains ${CATALYTIC_SLOPPY_FLUX_PENALTY}% Veil-Flux.`);
    } else {
      triggerHitstop(120);
      triggerHaptic('impactHeavy');
    }
    publishSquadUi(squadRef.current);
    if (allUnitsDefeated(squadRef.current)) {
      scheduleCombatVictoryResolution();
      return;
    }
    if (operativeHpRef.current <= 0) return;
  };

  const onCombatReload = () => {
    if (operativeClass !== 'HEX_SHOT') return;
    if (cycleState !== 'TEXT_COMBAT' || !isPlayerTurn || shadowstepProcRef.current) return;
    if (activeReloadVisible || hexReloadUsedThisTurnRef.current) {
      if (hexReloadUsedThisTurnRef.current) {
        log('[REJECTED] >> Phase-Shift Reload already spent this turn.');
      }
      return;
    }
    tryOpenReloadMinigame(true);
  };

  const onVoidWardPrime = () => {
    if (operativeClass !== 'AEGIS') return;
    if (cycleState !== 'TEXT_COMBAT' || !isPlayerTurn || shadowstepProcRef.current) return;
    if (voidWardPrimedRef.current) {
      log('[REJECTED] >> Void Ward Shroud already primed.');
      return;
    }
    if (playerApRef.current < VOID_WARD_AP_COST) {
      log('[REJECTED] >> Insufficient AP for Void Ward Shroud.');
      return;
    }
    playerApRef.current -= VOID_WARD_AP_COST;
    setPlayerActionPoints(playerApRef.current);
    primeVoidWardShroud();
  };

  const handleActiveReloadResolve = (quality: ReloadQuality, ammoType: HexAmmoType) => {
    setActiveReloadVisible(false);
    const wasManual = hexShotStateRef.current.isManualReloadMinigameActive;
    const deadMansBlocksOvercharge = wasManual
      && isDeadMansSwitchReloadGraft(hexShotAbilityGraftsRef.current);
    const isPerfect = quality === 'PERFECT' && !deadMansBlocksOvercharge;
    // Legacy reload boons/weapon hooks are keyed on PERFECT | JAM.
    const legacyResult: ActiveReloadResult = isPerfect ? 'PERFECT' : 'JAM';
    const ammoMeta = HEX_AMMO_META[ammoType];
    const qualityLabel = quality === 'PERFECT' ? 'PERFECT' : quality === 'CLEAN' ? 'CLEAN' : 'FAILED';
    log(`>> [PHASE-SHIFT RELOAD] ${qualityLabel} — ${ammoMeta.chip} loaded.${isPerfect ? ' +1 Protocol // Overcharged primed.' : quality === 'FAILED' ? ' First shot −10%.' : ''}`);
    classLoopTelemetryRef.current.reloadsUsed += 1;
    if (isPerfect) classLoopTelemetryRef.current.perfectReloads += 1;
    // Phase 3 — soft reload: chamber bonus on perfect or tactical (manual) reload.
    if (isPerfect || wasManual) {
      classCombatRef.current.chamberBonusReady = true;
      classLoopTelemetryRef.current.chamberBonusGranted += 1;
      log('[CHAMBER] >> Next ballistic shot gains +15% damage (reload tempo).');
    }
    dispatchHexShot({
      type: 'HEX_RESOLVE_RELOAD',
      quality,
      ammoType,
      encounter: classCombatRef.current,
      squad: squadRef.current,
      deadMansSwitchBlocksOvercharge: deadMansBlocksOvercharge,
    });
    runHexShotOnReloadResolveBoons({
      boons: hexShotBoons,
      result: legacyResult,
      encounter: classBoonEncounterRef.current,
      mods: hexShotBoonMods,
      log,
      grantOccultShield: (amount) => {
        sessionExtrasRef.current.playerShield = (sessionExtrasRef.current.playerShield ?? 0) + amount;
      },
      grantAp: () => {
        playerApRef.current += 1;
        setPlayerActionPoints(playerApRef.current);
        dispatchHexShot({ type: 'HEX_SYNC_RESOURCES', patch: { ap: playerApRef.current } });
      },
    });
    if (resolvedWeapon) {
      const reloadHooks = runWeaponOnReloadHooks(buildWeaponHookContext());
      reloadHooks.logLines.forEach((line) => log(line));
      if (reloadHooks.runtimePatch) applyWeaponRuntimePatch(reloadHooks.runtimePatch);
      if (reloadHooks.staminaDelta) {
        applyStamina(staminaRef.current + reloadHooks.staminaDelta);
      }
    }
    if (
      resolvedWeapon
      && (
        resolvedWeapon.familyId === 'hex-silver-core-sidearm'
        || resolvedWeapon.familyId === 'hex-void-cannon'
        || resolvedWeapon.familyId === 'hex-pulse-rifle'
      )
    ) {
      const reloadCue = resolvedWeapon.familyId === 'hex-silver-core-sidearm'
        ? 'sfx.revolver.reload_sacrifice'
        : resolvedWeapon.familyId === 'hex-void-cannon'
          ? 'sfx.blackdoor.reload_sacrifice'
          : 'sfx.carbine.reload_sacrifice';
      playCombatPresentationCue(reloadCue);
    }
    // Re-enable Hex attack SFX after reload resolves (reload cue already played).
    setHexReloadSuppressesAttackSfx(false);
    if (isPerfect) {
      triggerHitstop(80);
      triggerHaptic('impactHeavy');
    } else {
      triggerShake('light');
      triggerHaptic('notificationError');
    }
  };

  const registerParryArena = (layout: ParryArenaLayout) => {
    parryArenaRef.current = layout;
  };

  const registerSliceArena = (layout: SliceArenaSize) => {
    sliceArenaRef.current = layout;
  };

  const hideParryOverlay = () => {
    setIsSuccessState(false);
    setIsFailureState(false);
    cycleRef.current = 'TEXT_COMBAT';
    setCycleState('TEXT_COMBAT');
  };

  const finishParryKillAfterHalo = () => {
    abortCombatMinigames();
    cycleRef.current = 'TEXT_COMBAT';
    setCycleState('TEXT_COMBAT');
    scheduleCombatVictoryResolution();
    return;
  };

  /** Exactly one parry outcome — void ward reflect and damage cannot diverge. */
  const finalizeParry = (passed: boolean) => {
    if (parryResolvedRef.current || cycleRef.current !== 'DEFEND_PARRY') return;
    parryResolvedRef.current = true;
    parryTapPendingRef.current = false;
    cancelAnimation(parryScaleSV);

    const retribution = retributionParryRef.current;
    if (retribution) {
      if (!passed) {
        hurtPlayer(
          retribution.occultDamage,
          false,
          `>> ASH DETONATION — ${retribution.occultDamage} occult`,
          { rollCrit: false },
        );
      } else {
        log('[PARRY LOCKED] >> Ash detonation contained.');
      }
      const pending = pendingDissolveRef.current;
      hideParryOverlay();
      retributionParryRef.current = null;
      pendingDissolveRef.current = null;
      if (pending) beginDissolveForUnit(pending.unitId, pending.profile, 0);
      if (operativeHpRef.current <= 0) return;
      if (allUnitsDefeated(squadRef.current)) {
        scheduleCombatVictoryResolution();
        return;
      }
      if (enemyActionQueueRef.current.length > 0) scheduleNextEnemyAction(false);
      else endEnemyTurn(true);
      return;
    }

    clearVoidWardShroud();

    if (passed) {
      Vibration.vibrate(15);
      triggerHitstop(100);
      triggerHaptic('impactHeavy');
      {
        const nextParries = successfulParryCount + 1;
        setSuccessfulParryCount(nextParries);
        classCombatRef.current.successfulParryCount = nextParries;
      }
      const pendingWeight = preAppliedHpStrikeRef.current > 0
        ? preAppliedHpStrikeRef.current
        : pendingDmgRef.current;
      preAppliedHpStrikeRef.current = 0;
      pendingDmgRef.current = 0;
      const e = enemyRef.current;
      if (e?.unitId && pendingWeight > 0) {
        const counter = resolveIntentCounterplay({
          intent: e.intent,
          playerActionTags: ['PARRY', 'FRACTURE', 'BLOCK'],
          sourceCombatant: e,
          perfectParry: true,
          classId: 'AEGIS',
          abilityId: 'WRAITH_PARRY',
          incomingDamage: pendingWeight,
        });
        recordIntentCountered(intentTelemetryRef.current, e.intent, counter.counterQuality, {
          damagePrevented: counter.reducedDamageAmount ?? pendingWeight,
          appliedFracture: true,
        });
        const fractured = applyFractureDamage(
          counter.appliedFracture || counter.cancelTelegraph
            ? applyIntentCounterplayToEnemy(e, { ...counter, appliedFracture: false })
            : e,
          pendingWeight,
        );
        const withFracturePayoff = counter.appliedFracture && !isEnemyFractured(fractured)
          ? applyFracturedState(fractured, { fromDefenseBreak: true })
          : fractured;
        patchUnit(e.unitId, withFracturePayoff);
        log(`[VOID WARD] >> Perfect lock — ${pendingWeight} fracture reflected.`);
        log('[AEGIS] >> Perfect Parry — Lock canceled, Riposte Ready.');
        armRiposteReady('PERFECT_PARRY');
        if (resolvedWeapon?.familyId === 'aegis-rift-edge') {
          weaponRuntimeRef.current = armRiftEdgeTempo(weaponRuntimeRef.current);
          log('[RIFT EDGE] >> Tempo armed — next basic carries Occult rider.');
        }
        classLoopTelemetryRef.current.parriesSuccessful += 1;
        classLoopTelemetryRef.current.perfectParries += 1;
        classLoopTelemetryRef.current.damagePreventedByParry += pendingWeight;
        classLoopTelemetryRef.current.fracturesAppliedByClass += 1;
        emitJuice('PERFECT_PARRY', { text: 'PERFECT PARRY — RIPOSTE READY' });
        playCombatPresentationCue('sfx.aegis.parry');
        emitJuice('FRACTURE_APPLIED', { text: 'Fracture from Perfect Parry' });
        if (counter.cancelTelegraph) {
          applyObjectiveProgress(
            progressObjectiveOnChannelInterrupt(
              objectiveSessionRef.current,
              getIntentType(e.intent),
            ),
          );
          emitJuice('INTENT_COUNTERED', { text: 'Lock canceled' });
        }
        counter.logMessages.forEach((m) => log(`[VOID WARD] >> ${m}`));
        const reflectPct = mutationModsRef.current.parryReflectPct;
        if (reflectPct > 0) {
          const hpReflect = Math.floor(pendingWeight * (reflectPct / 100));
          if (hpReflect > 0) {
            // Indirect — must not fire attack pose, Warden approach, or weapon ultimate presentation.
            hurtEnemy(hpReflect, '[SPIKED WARD]', 'STRIKE', {
              channel: 'KINETIC',
              targetId: e.unitId,
              indirectDamage: true,
              rollCrit: false,
            });
            log(`[SPIKED WARD] >> ${hpReflect} HP retaliation.`);
          }
        }
      }
      chargeAr(VOID_WARD_PERFECT_RESERVE_GAIN);
      imprintRunicBrand(1);
      log(`[VOID WARD] >> +${VOID_WARD_PERFECT_RESERVE_GAIN}% Reserve — 1 Runic Brand imprinted.`);
      runOnParryPerfect(buildAegisBoonHookCtx());
      hideParryOverlay();
      startParrySuccessBurst(() => {
        endEnemyTurn();
      });
      return;
    }
    hideParryOverlay();
    runOnParryFail(buildAegisBoonHookCtx());
    const pending = preAppliedHpStrikeRef.current > 0
      ? preAppliedHpStrikeRef.current
      : pendingDmgRef.current;
    preAppliedHpStrikeRef.current = 0;
    pendingDmgRef.current = 0;
    if (pending > 0) {
      const mitigated = Math.max(1, Math.floor(pending * 0.5));
      hurtPlayer(mitigated, pendingUnblockRef.current, `[VOID WARD] >> Barrier ruptured — ${mitigated} impact.`, {
        skipStrikeFx: true,
        attacker: enemyRef.current ?? undefined,
        rollCrit: false,
      });
    } else {
      log('[VOID WARD] >> Parry failed — barrier collapsed.');
    }
    if (operativeHpRef.current > 0) endEnemyTurn();
  };

  const finalizeParryRef = useRef(finalizeParry);
  finalizeParryRef.current = finalizeParry;

  const handleParryTimeout = (session: number) => {
    if (parryResolvedRef.current) return;
    if (session !== parrySessionRef.current || parryTapPendingRef.current) return;
    finalizeParryRef.current(false);
  };

  const adjudicateParryTap = (scale: number, tapX: number, tapY: number, session: number) => {
    parryTapPendingRef.current = false;
    if (session !== parrySessionRef.current || parryResolvedRef.current) return;
    const passed = isParryAttemptSuccessful(
      scale,
      tapX,
      tapY,
      parryArenaRef.current,
      parryTimingWindowBonus,
      parryTimingBlindPenalty,
    );
    finalizeParryRef.current(passed);
  };

  const adjudicateParryTapRef = useRef(adjudicateParryTap);
  adjudicateParryTapRef.current = adjudicateParryTap;

  const runAdjudicateParryTap = (scale: number, tapX: number, tapY: number, session: number) => {
    adjudicateParryTapRef.current(scale, tapX, tapY, session);
  };

  const startParryRing = () => {
    cancelAnimation(parryScaleSV);
    parrySessionRef.current += 1;
    const session = parrySessionRef.current;
    parryResolvedRef.current = false;
    parryTapPendingRef.current = false;
    clearParrySuccessBurst();
    setIsSuccessState(false);
    setIsFailureState(false);
    parryScaleSV.value = PARRY_RING_SCALE_START;
    requestAnimationFrame(() => {
      if (cycleRef.current !== 'DEFEND_PARRY' || session !== parrySessionRef.current) return;
      parryScaleSV.value = withTiming(
        PARRY_RING_SCALE_END,
        { duration: PARRY_DURATION, easing: ReanimatedEasing.linear },
        (finished) => {
          'worklet';
          if (finished) runOnJS(handleParryTimeout)(session);
        },
      );
    });
  };

  const onParryTap = (tapX: number, tapY: number) => {
    if (cycleRef.current !== 'DEFEND_PARRY' || parryResolvedRef.current || parryTapPendingRef.current) return;
    parryTapPendingRef.current = true;
    const session = parrySessionRef.current;
    runOnUI((x: number, y: number, s: number) => {
      'worklet';
      const scale = parryScaleSV.value;
      cancelAnimation(parryScaleSV);
      runOnJS(runAdjudicateParryTap)(scale, x, y, s);
    })(tapX, tapY, session);
  };

  const commitAbyssalVerdictDamage = (input: {
    dmg: number;
    gradeLabel: string;
    targetHint?: { gridSlot?: string | null } | null;
  }): void => {
    const useCinematic = shouldUseAbyssalVerdictPresentation({
      operativeClass,
      weaponFamilyId: activeWeaponFamilyId,
      abilityId: 'EVISCERATE',
      actionKind: 'ULTIMATE',
    });
    // Selected intent — then the same intercept resolver hurtEnemy uses.
    const selectedTargetId = eviscerateTargetUnitId
      ?? selectedTargetIdRef.current
      ?? enemyRef.current?.unitId
      ?? null;
    const resolvedTargetId = selectedTargetId
      ? resolveClassWardenInterceptTarget(
        squadRef.current,
        operativeClass,
        'EVISCERATE',
        selectedTargetId,
      )
      : null;

    if (!useCinematic) {
      triggerPlayerAttackPose(input.targetHint ?? enemyRef.current);
      const eradicated = hurtEnemy(input.dmg, `[${ABYSSAL_VERDICT_DISPLAY_NAME}]`, 'EVISCERATE', {
        channel: 'TRUE',
        abilityId: 'EVISCERATE',
        actionKind: 'ULTIMATE',
        targetId: resolvedTargetId ?? undefined,
        rollEvade: false,
      });
      if (!eradicated) applyEviscerateAftermath();
      if (eradicated) return;
      cycleRef.current = 'TEXT_COMBAT';
      setCycleState('TEXT_COMBAT');
      setEviscerateTargetUnitId(null);
      combatPausedRef.current = false;
      passToEnemy(false);
      return;
    }

    combatPausedRef.current = true;
    const presentationId = `abyssal-${Date.now()}`;
    abyssalLogBufferRef.current = [];
    abyssalDeferredOutcomeRef.current = null;
    const eradicated = hurtEnemy(input.dmg, `[${ABYSSAL_VERDICT_DISPLAY_NAME}]`, 'EVISCERATE', {
      channel: 'TRUE',
      abilityId: 'EVISCERATE',
      actionKind: 'ULTIMATE',
      targetId: resolvedTargetId ?? undefined,
      deferAbyssalVerdict: true,
      rollEvade: false,
    });
    // hurtEnemy mutates the ref; read past CFA narrowing from the null assignment above.
    type AbyssalDeferredOutcome = {
      unitId: string;
      evaded: boolean;
      damageApplied: number;
      killed: boolean;
    };
    const deferredOutcome = abyssalDeferredOutcomeRef.current as AbyssalDeferredOutcome | null;
    abyssalDeferredOutcomeRef.current = null;
    // Reserve flush / brands once at commit — not again at impact.
    if (!eradicated) applyEviscerateAftermath();
    const deferredLogLines = abyssalLogBufferRef.current ?? [];
    abyssalLogBufferRef.current = null;

    // Prefer the unit hurtEnemy actually resolved (post-intercept).
    const finalizedTargetId = deferredOutcome?.unitId
      ?? resolvedTargetId
      ?? selectedTargetId
      ?? enemyRef.current?.unitId
      ?? '';
    if (!finalizedTargetId) {
      for (const line of deferredLogLines) terminalLogRef.current?.(line);
      combatPausedRef.current = false;
      cycleRef.current = 'TEXT_COMBAT';
      setCycleState('TEXT_COMBAT');
      setEviscerateTargetUnitId(null);
      if (!eradicated) passToEnemy(false);
      return;
    }

    // ABYSSAL VERDICT cannot be evaded — presentation always treats as a landed hit.
    const damage = deferredOutcome?.damageApplied ?? input.dmg;
    const killed = eradicated;
    const affectedTargetIds = damage > 0 ? [finalizedTargetId] : [];
    const evadedTargetIds: string[] = [];

    abyssalPendingRef.current = {
      presentationId,
      unitId: finalizedTargetId,
      affectedTargetIds,
      evadedTargetIds,
      damage,
      critical: false,
      killed,
      pendingDissolve: killed,
      impactResolved: false,
      deferredLogLines,
    };

    try {
      unlockCombatPresentationAudio();
      playCombatPresentationCue('sfx.aegis.ultimate2');
    } catch {
      // optional charge cue
    }

    const started = beginAbyssalVerdictPresentation({
      presentationId,
      targetId: finalizedTargetId,
      affectedTargetIds,
      evadedTargetIds,
      damage,
      killed,
      critical: false,
      grade: input.gradeLabel,
      deferredLogLines,
    });

    if (!started) {
      // Asset / re-entry failure — reveal immediately, never soft-lock.
      const pending = abyssalPendingRef.current;
      abyssalPendingRef.current = null;
      for (const line of deferredLogLines) terminalLogRef.current?.(line);
      if (pending) delete visualHpHoldRef.current[pending.unitId];
      if (eradicated && pending) {
        const unit = getUnitById(squadRef.current, pending.unitId);
        if (unit && !isUnitAlive(unit)) beginDissolveForUnit(pending.unitId, unit, unit.currentHp);
      }
      publishSquadUi(squadRef.current);
      combatPausedRef.current = false;
      cycleRef.current = 'TEXT_COMBAT';
      setCycleState('TEXT_COMBAT');
      setEviscerateTargetUnitId(null);
      if (!eradicated) passToEnemy(false);
    }
  };

  const evaluateSlice = () => {
    if (isCombatTerminal()) return;
    const s = sliceSessionRef.current; if (s.evaluated) return;
    s.evaluated = true; clearSliceTimers(); activeSliceRef.current = -1; setActiveSliceIndex(-1);
    // Zero-input timeout must not spend Reserve or deal damage (Phase 3M runtime repair).
    if (s.hitCount <= 0) {
      cycleRef.current = 'TEXT_COMBAT';
      setCycleState('TEXT_COMBAT');
      setEviscerateTargetUnitId(null);
      combatPausedRef.current = false;
      log(`>> [${ABYSSAL_VERDICT_DISPLAY_NAME}] >> Aperture closed — no traces locked. Abyssal Reserve retained.`);
      return;
    }
    const resolved = resolveWeaponUltimateGrade({ hitCount: s.hitCount });
    const hits = resolved.effectiveHits ?? Math.max(1, s.hitCount);
    const base = scaleSlice(COMBAT_ACTION.EVISCERATE_DAMAGE);
    const dmg = hits >= 3 ? base : Math.floor(base * (hits / 3));
    log(
      resolved.grade === 'PERFECT'
        ? `[${ABYSSAL_VERDICT_DISPLAY_NAME}] >> PERFECT [3/3] — ${dmg} damage.`
        : `[${ABYSSAL_VERDICT_DISPLAY_NAME}] >> ${resolved.grade} [${hits}/3] — ${dmg} damage.`,
    );
    commitAbyssalVerdictDamage({
      dmg,
      gradeLabel: resolved.grade,
      targetHint: getUnitById(
        squadRef.current,
        eviscerateTargetUnitId ?? selectedTargetIdRef.current ?? '',
      ) ?? enemyRef.current,
    });
  };

  const commitThreefoldBrandSimplified = () => {
    if (!canFireLegacyClassUltimate('EVISCERATE', activeWeaponFamilyId)) {
      log(`[REJECTED] >> ${ABYSSAL_VERDICT_DISPLAY_NAME} requires the Longsword.`);
      return;
    }
    if (isExhausted) {
      log(`[REJECTED] >> Exhausted — ${ABYSSAL_VERDICT_DISPLAY_NAME} offline.`);
      return;
    }
    if (abyssalRef.current < COMBAT_ACTION.ABYSSAL_RESERVE_CAP) {
      log(`[REJECTED] >> ${ABYSSAL_VERDICT_DISPLAY_NAME} requires 100% Abyssal Reserve.`);
      return;
    }
    const resolved = resolveWeaponUltimateGrade(buildSimplifiedUltimateRawResult('THREEFOLD_BRAND'));
    const hits = resolved.effectiveHits ?? 1;
    const base = scaleSlice(COMBAT_ACTION.EVISCERATE_DAMAGE);
    const dmg = Math.floor(base * (hits / 3));
    log(`[${ABYSSAL_VERDICT_DISPLAY_NAME}] >> STANDARD simplified — ${dmg} damage.`);
    commitAbyssalVerdictDamage({
      dmg,
      gradeLabel: resolved.grade,
      targetHint: enemyRef.current,
    });
  };

  const queueSlice = (idx: number) => {
    if (isCombatTerminal()) return;
    if (idx >= 3) { evaluateSlice(); return; }
    activeSliceRef.current = idx; setActiveSliceIndex(idx);
    crossedRef.current = false;
    sliceTouchStartRef.current = null;
    const s = sliceSessionRef.current;
    if (s.segmentTimer) clearTimeout(s.segmentTimer);
    s.segmentTimer = setTimeout(() => { s.segmentTimer = null; sliceHandlersRef.current.queueNext(idx + 1); }, 1200);
  };

  const pulseSliceHitHaptic = () => {
    Vibration.vibrate(SLICE_HIT_HAPTIC_MS);
  };

  const registerSliceHit = (idx: number): boolean => {
    const s = sliceSessionRef.current;
    if (s.slicedIds.has(idx)) return false;
    s.slicedIds.add(idx);
    s.hitCount += 1;
    setSliceLines(s.lines.map((l) => (l.id === idx ? { ...l, isSliced: true } : l)));
    pulseSliceHitHaptic();
    apparitionRef?.current?.triggerDamageEffect();
    return true;
  };

  const tryValidateSliceSwipe = (x0: number, y0: number, x1: number, y1: number) => {
    if (isCombatTerminal()) return;
    const idx = activeSliceRef.current;
    if (idx === -1 || crossedRef.current || cycleRef.current !== 'OFFENSE_SLICE') return;

    const line = sliceSessionRef.current.lines.find((l) => l.id === idx);
    const arena = sliceArenaRef.current;
    if (!line || arena.width <= 0 || arena.height <= 0) return;

    const segment = getSliceLineSegment(line, arena);
    if (!segment || !swipeHitsSliceLine(x0, y0, x1, y1, segment)) return;

    validateSlice();
  };

  const validateSlice = () => {
    if (isCombatTerminal()) return;
    const idx = activeSliceRef.current;
    if (idx === -1 || crossedRef.current || cycleRef.current !== 'OFFENSE_SLICE') return;
    if (!sliceSessionRef.current.lines.some((l) => l.id === idx)) return;
    crossedRef.current = true;
    clearSliceTimers();
    registerSliceHit(idx);
    if (sliceSessionRef.current.hitFlashTimer) clearTimeout(sliceSessionRef.current.hitFlashTimer);
    sliceSessionRef.current.hitFlashTimer = setTimeout(() => {
      sliceSessionRef.current.hitFlashTimer = null;
      crossedRef.current = false;
      sliceTouchStartRef.current = null;
      sliceHandlersRef.current.queueNext(idx + 1);
    }, 180);
  };

  const triggerSlice = () => {
    if (isCombatTerminal()) return;
    clearSliceTimers();
    sliceSessionRef.current = { lines: [], hitCount: 0, slicedIds: new Set(), segmentTimer: null, hitFlashTimer: null, evaluated: false };
    crossedRef.current = false;
    sliceTouchStartRef.current = null;
    const angles = generateVariedSliceAngles(3);
    const lines: SliceLineConfig[] = angles.map((angleDeg, i) => ({
      id: i,
      centerXRatio: 0.5 + (Math.random() - 0.5) * ORIGIN_JITTER,
      centerYRatio: 0.5 + (Math.random() - 0.5) * ORIGIN_JITTER,
      angleDeg,
      isSliced: false,
    }));
    sliceSessionRef.current.lines = lines; setSliceLines(lines);
    activeSliceRef.current = 0; setActiveSliceIndex(0);
    const targetId = selectedTargetIdRef.current
      ?? focusedUnitIdRef.current
      ?? enemyRef.current?.unitId
      ?? null;
    setEviscerateTargetUnitId(targetId);
    cycleRef.current = 'OFFENSE_SLICE'; setCycleState('OFFENSE_SLICE');
    combatPausedRef.current = true;
    queueSlice(0);
  };
  sliceHandlersRef.current = { queueNext: queueSlice, validate: validateSlice, evaluate: evaluateSlice, trigger: triggerSlice };
  useEffect(() => () => {
    clearSliceTimers();
    clearParrySuccessBurst();
    if (enemyTurnTimerRef.current) clearTimeout(enemyTurnTimerRef.current);
    if (enemyTurnGapTimerRef.current) clearTimeout(enemyTurnGapTimerRef.current);
    if (enemyStrikeTimerRef.current) clearTimeout(enemyStrikeTimerRef.current);
  }, []);

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => cycleRef.current === 'OFFENSE_SLICE',
    onMoveShouldSetPanResponder: () => cycleRef.current === 'OFFENSE_SLICE',
    onPanResponderGrant: (e) => {
      if (cycleRef.current !== 'OFFENSE_SLICE' || crossedRef.current) return;
      sliceTouchStartRef.current = {
        x: e.nativeEvent.locationX,
        y: e.nativeEvent.locationY,
      };
    },
    onPanResponderMove: (e) => {
      if (cycleRef.current !== 'OFFENSE_SLICE' || crossedRef.current || activeSliceRef.current === -1) return;
      const start = sliceTouchStartRef.current;
      if (!start) return;
      tryValidateSliceSwipe(
        start.x,
        start.y,
        e.nativeEvent.locationX,
        e.nativeEvent.locationY,
      );
    },
    onPanResponderRelease: (e) => {
      if (cycleRef.current === 'OFFENSE_SLICE' && !crossedRef.current && activeSliceRef.current !== -1) {
        const start = sliceTouchStartRef.current;
        if (start) {
          tryValidateSliceSwipe(
            start.x,
            start.y,
            e.nativeEvent.locationX,
            e.nativeEvent.locationY,
          );
        }
      }
      sliceTouchStartRef.current = null;
    },
  })).current;

  const dismiss = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    const hp = operativeHpRef.current;
    const sample = balanceEncounterRef.current;
    onCombatComplete?.({
      victory: resolutionRef.current === 'VICTORY' && hp > 0,
      remainingHp: hp,
      remainingStamina: staminaRef.current,
      playerTurns: sample.playerTurns,
      damageTaken: sample.damageTaken,
      healingReceived: sample.healingReceived,
      damageDealt: sample.damageDealt,
      intentTelemetry: intentTelemetryRef.current,
      classLoopTelemetry: classLoopTelemetryRef.current,
      objectiveTelemetry: snapshotObjectiveTelemetry(),
      directorTelemetry: env.combatDirector
        ? {
            pressureTotal: env.combatDirector.pressureTotal,
            pressureLabel: env.combatDirector.pressureLabel,
            rewardMultiplier: env.combatDirector.rewardMultiplier,
            adjustmentsApplied: env.combatDirector.adjustmentsApplied,
            severity: env.combatDirector.severity,
            debugSummary: env.combatDirector.debugSummary,
          }
        : undefined,
      juiceTelemetry: juiceTelemetryRef.current,
    });
  }, [onCombatComplete]);

  const dismissRef = useRef(dismiss);
  dismissRef.current = dismiss;
  const resolutionSyncKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!onResolutionPanelChange) return;
    const syncKey =
      cycleState === 'RESOLUTION' && resolutionOutcome
        ? resolutionOutcome
        : 'idle';
    if (resolutionSyncKeyRef.current === syncKey) return;
    resolutionSyncKeyRef.current = syncKey;
    if (syncKey === 'idle') {
      onResolutionPanelChange(null);
      return;
    }
    const primary = objectiveSessionRef.current.primary;
    let objectiveCallout: string | null = null;
    if (primary?.status === 'COMPLETE') {
      objectiveCallout = primary.replacesPressure
        ? 'OBJECTIVE COMPLETE'
        : 'CONTRACT PROGRESS UPDATED';
    }
    onResolutionPanelChange({
      outcome: resolutionOutcome as 'VICTORY' | 'DEFEAT',
      onDismiss: () => dismissRef.current(),
      playerTurns: Math.max(1, balanceEncounterRef.current.playerTurns),
      hostilesDefeated: Math.max(1, encounterHostileCountRef.current),
      objectiveCallout,
    });
  }, [cycleState, resolutionOutcome, onResolutionPanelChange]);

  const isOperativeAbilityEnabled = (abilityId: string): boolean => {
    if (!isPlayerTurn || cycleState !== 'TEXT_COMBAT' || shadowstepProcRef.current) return false;
    if (operativeClass === 'HEX_SHOT' && isHexShotProcUltimate(abilityId)) return false;
    if (operativeClass === 'ENVOY' && isEnvoyProcUltimate(abilityId)) return false;
    const cost = resolveClassAbilityCost(operativeClass, abilityId);
    const ultimateSealed = encounterUltimateDisabled
      || (operativeClass === 'HEX_SHOT'
        ? isClassUltimateDisabledForEncounter('HEX_SHOT', hexShotAbilityGraftsRef.current, {}, false)
        : operativeClass === 'ENVOY'
          ? isClassUltimateDisabledForEncounter('ENVOY', {}, envoyAbilityGraftsRef.current, false)
          : false);
    if (ultimateSealed && cost.isUltimate) return false;
    if (operativeClass === 'HEX_SHOT') {
      const graftPlan = buildClassGraftCastPlan(
        'HEX_SHOT',
        abilityId,
        resolveHexShotAbilityGraftId(hexShotAbilityGraftsRef.current, abilityId as HexShotAbilityId),
      );
      if (playerActionPoints < graftPlan.apCost) return false;
      return isHexShotAbilityEnabled(
        abilityId as HexShotAbilityId,
        currentAmmo,
        maxAmmo,
        stamina,
        classCombatRef.current,
        effectiveGraftAmmoCost(graftPlan, currentAmmo),
      );
    }
    if (operativeClass === 'ENVOY') {
      const graftPlan = buildClassGraftCastPlan(
        'ENVOY',
        abilityId,
        envoyAbilityGraftsRef.current[abilityId as EnvoyAbilityId],
      );
      if (playerActionPoints < graftPlan.apCost) return false;
      if (isEnvoyCastBlockedByVoidSiphon(
        graftPlan.effectiveTags,
        envoyCombatStateRef.current.isVoidSiphoned,
        envoyBoonModsRef.current.masochisticChannel,
      )) {
        return false;
      }
      return isEnvoyAbilityEnabled(
        abilityId as EnvoyAbilityId,
        veilFlux,
        stamina,
        envoyCombatStateRef.current.isVoidSiphoned,
        envoyBoonModsRef.current.masochisticChannel,
        graftPlan.fluxCost,
      );
    }
    if (playerActionPoints < cost.apCost) return false;
    return isAbilityEnabled(abilityId as AegisAbilityId);
  };

  const getOperativeAbilityDisableReason = (abilityId: string): string | null => {
    if (isOperativeAbilityEnabled(abilityId)) return null;
    if (!isPlayerTurn || cycleState !== 'TEXT_COMBAT' || shadowstepProcRef.current) {
      return 'Wait for your combat phase.';
    }
    if (operativeClass === 'HEX_SHOT' && isHexShotProcUltimate(abilityId)) {
      return 'Proc ultimate unavailable.';
    }
    if (operativeClass === 'ENVOY' && isEnvoyProcUltimate(abilityId)) {
      return 'Proc ultimate unavailable.';
    }
    const cost = resolveClassAbilityCost(operativeClass, abilityId);
    const ultimateSealed = encounterUltimateDisabled
      || (operativeClass === 'HEX_SHOT'
        ? isClassUltimateDisabledForEncounter('HEX_SHOT', hexShotAbilityGraftsRef.current, {}, false)
        : operativeClass === 'ENVOY'
          ? isClassUltimateDisabledForEncounter('ENVOY', {}, envoyAbilityGraftsRef.current, false)
          : false);
    if (ultimateSealed && cost.isUltimate) {
      return 'Ultimate channel sealed by Apex Graft.';
    }
    if (operativeClass === 'HEX_SHOT') {
      const graftPlan = buildClassGraftCastPlan(
        'HEX_SHOT',
        abilityId,
        resolveHexShotAbilityGraftId(hexShotAbilityGraftsRef.current, abilityId as HexShotAbilityId),
      );
      if (playerActionPoints < graftPlan.apCost) {
        return `Requires ${graftPlan.apCost} AP (have ${playerActionPoints}).`;
      }
      return 'Insufficient ammo or stamina.';
    }
    if (operativeClass === 'ENVOY') {
      const graftPlan = buildClassGraftCastPlan(
        'ENVOY',
        abilityId,
        envoyAbilityGraftsRef.current[abilityId as EnvoyAbilityId],
      );
      if (playerActionPoints < graftPlan.apCost) {
        return `Requires ${graftPlan.apCost} AP (have ${playerActionPoints}).`;
      }
      if (isEnvoyCastBlockedByVoidSiphon(
        graftPlan.effectiveTags,
        envoyCombatStateRef.current.isVoidSiphoned,
        envoyBoonModsRef.current.masochisticChannel,
      )) {
        return 'Void Siphon — cast blocked.';
      }
      return 'Insufficient Veil Flux or stamina.';
    }
    const jammedSlots = sessionExtrasRef.current.jammedAugmentSlots?.length
      ? sessionExtrasRef.current.jammedAugmentSlots
      : sessionExtrasRef.current.jammedAugmentSlot != null
        ? [sessionExtrasRef.current.jammedAugmentSlot]
        : [];
    const graftPlan = buildGraftCastPlan(abilityId as AegisAbilityId, abilityGraftsRef.current[abilityId as AegisAbilityId]);
    return getAegisAbilityDisableReason(abilityId as AegisAbilityId, {
      isPlayerTurn,
      cycleState,
      shadowstepProc: shadowstepProcRef.current,
      encounterUltimateDisabled,
      playerAp: playerActionPoints,
      graftPlan,
      graftCooldown: graftCooldownsRef.current[abilityId as AegisAbilityId] ?? 0,
      jammedSlots,
      loadout: aegisLoadout,
      rooted: hasStructuredDebuff(sessionExtrasRef.current, 'ROOTED'),
      voidWardPrimed: voidWardPrimedRef.current,
      abyssalReserve,
      operativeHp,
      maxSoulAnchor,
      runicBrands,
      buffState: combatBuffRef.current,
      ashenMantleCooldown: mutationEncounterRef.current.ashenMantleCooldown,
      ashenMantleFree: mutationModsRef.current.ashenMantleFree,
    });
  };

  const isAbilityEnabled = (abilityId: AegisAbilityId): boolean => {
    if (!isPlayerTurn || cycleState !== 'TEXT_COMBAT' || shadowstepProcRef.current) return false;
    if (
      encounterUltimateDisabled
      && getAbilityTags(abilityId).includes('ULTIMATE')
    ) {
      return false;
    }
    if (hasStructuredDebuff(sessionExtrasRef.current, 'ROOTED')
      && (abilityId === 'WRAITH_PARRY' || abilityId === 'SHADOW_STEP')) {
      return false;
    }
    const jammedSlots = sessionExtrasRef.current.jammedAugmentSlots?.length
      ? sessionExtrasRef.current.jammedAugmentSlots
      : sessionExtrasRef.current.jammedAugmentSlot != null
        ? [sessionExtrasRef.current.jammedAugmentSlot]
        : [];
    if (jammedSlots.some((slot) => aegisLoadout[slot] === abilityId)) return false;
    const graftPlan = buildGraftCastPlan(abilityId, abilityGraftsRef.current[abilityId]);
    if ((graftCooldownsRef.current[abilityId] ?? 0) > 0) return false;
    if (playerActionPoints < graftPlan.apCost) return false;
    const graftAfford = canAffordGraftResources(graftPlan, abyssalReserve, runicBrands);
    if (!graftAfford.ok) return false;
    switch (abilityId) {
      case 'STRIKE':
        return true;
      case 'VEIL_PIERCER':
        return true;
      case 'WRAITH_PARRY':
        return !voidWardPrimedRef.current;
      case 'ASHEN_MANTLE':
      case 'RUIN':
      case 'GRAVE_BIND':
      case 'SHADOW_STEP':
      case 'NAIL_TO_GRID':
      case 'BLOOD_TITHE':
      case 'DEMONS_LUNG':
      case 'CRIMSON_PACT':
      case 'DEVASTATE':
      case 'ABYSSAL_FAULT':
      case 'BLOOD_BOUND_CARAPACE':
      case 'REAVE':
        return isExtendedAbilityEnabled(
          abilityId,
          stamina,
          abyssalReserve,
          operativeHp,
          maxSoulAnchor,
          combatBuffRef.current,
          runicBrands,
          {
            ashenMantleCooldown: mutationEncounterRef.current.ashenMantleCooldown,
            ashenMantleFree: mutationModsRef.current.ashenMantleFree,
          },
        );
      default:
        return false;
    }
  };

  const getAbilityAccent = (abilityId: string): string | undefined => {
    if (operativeClass !== 'AEGIS') return undefined;
    const aegisId = abilityId as AegisAbilityId;
    const graftId = abilityGraftsRef.current[aegisId];
    if (graftId) return getVeilGraftDefinition(graftId).accentColor;
    if (aegisId === 'WRAITH_PARRY' && voidWardPrimed) return P.parry;
    if (aegisId === 'ASHEN_MANTLE' && combatBuffRef.current.ashenMantleTurnsRemaining > 0) return WARD_STRIKE_ACCENT;
    return undefined;
  };

  const getStagedCostImpact = (abilityId: string): string => {
    return `COST: ${formatClassAbilityCostLine(operativeClass, abilityId)}`;
  };

  const getStagedAbilityDescription = (abilityId: string): string => {
    const cost = resolveClassAbilityCost(operativeClass, abilityId);
    const tagLine = cost.tags.length > 0 ? `TAGS: ${cost.tags.join(' // ')}` : '';
    const graftTags = operativeClass === 'HEX_SHOT'
      ? buildClassGraftCastPlan(
        'HEX_SHOT',
        abilityId as HexShotAbilityId,
        resolveHexShotAbilityGraftId(hexShotAbilityGraftsRef.current, abilityId as HexShotAbilityId),
      ).effectiveTags
      : undefined;
    const phantomFeed = operativeClass === 'HEX_SHOT'
      && shouldApplyPhantomFeed(abilityId as HexShotAbilityId, graftTags)
      ? 'INTRINSIC: Phantom Feed — +1 round cycled before resolve.'
      : '';
    const ammoHint = operativeClass === 'HEX_SHOT'
      ? formatHexAmmoCounterHint(abilityId as HexShotAbilityId)
      : null;
    const ammoLine = ammoHint ? `ROUND: ${ammoHint}` : '';
    // Ammo-type inheritance preview for BALLISTIC abilities (v1 refactor).
    const inheritsAmmo = operativeClass === 'HEX_SHOT'
      && abilityUsesBallisticTags(abilityId)
      && !isHexShotProcUltimate(abilityId);
    const ammoTypeLine = inheritsAmmo
      ? `AMMO: ${HEX_AMMO_META[hexShotStateRef.current.currentAmmoType].chip} — ${HEX_AMMO_META[hexShotStateRef.current.currentAmmoType].shortEffect}`
      : '';
    const riposteLine = operativeClass === 'AEGIS'
      && abilityCarriesStrikeTag(operativeClass, abilityId)
      && classCombatRef.current.riposteReady
      ? `RIPOSTE READY — next successful hit deals +${AEGIS_RIPOSTE_BONUS_KINETIC} Kinetic (misses hold).`
      : '';
    const catChip = operativeClass === 'ENVOY'
      ? formatCatalystChip(classCombatRef.current)
      : null;
    const catLine = catChip ? `CATALYST: ${catChip}` : '';
    // Zero Protocol readiness (Carbine weapon ultimate — Protocol Charges gate).
    const zeroProtocolLine = operativeClass === 'HEX_SHOT'
      && abilityId === 'ZERO_PROTOCOL'
      && canFireLegacyClassUltimate('ZERO_PROTOCOL', activeWeaponFamilyId)
      ? (hexShotStateRef.current.protocolCharges >= hexShotStateRef.current.maxProtocolCharges
        ? 'ZERO PROTOCOL READY — true-damage execution using calibrated ammo.'
        : `PROTOCOL: ${hexShotStateRef.current.protocolCharges}/${hexShotStateRef.current.maxProtocolCharges} — Perfect Phase-Shift Reloads generate Protocol.`)
      : '';
    return [cost.description, tagLine, ammoTypeLine, zeroProtocolLine, ammoLine, riposteLine, catLine, phantomFeed].filter(Boolean).join(' // ');
  };

  const confirmSelectedAbility = () => {
    if (!selectedAbility) return;
    const mode = classAbilityTargetMode(operativeClass, selectedAbility);
    if (mode === 'SINGLE') {
      const targetId = selectedTargetIdRef.current;
      if (!targetId || !canTargetWithClassAbility(operativeClass, squadRef.current, selectedAbility, targetId)) {
        log('[TARGET] >> Select a valid hostile on the grid.');
        publishSquadUi(squadRef.current);
        return;
      }
    }
    // Executors still require a living enemyRef bootstrap even for group / self casts.
    if (!enemyRef.current || !isUnitAlive(enemyRef.current)) {
      const fallback = primaryAliveUnit(squadRef.current);
      if (fallback) {
        enemyRef.current = fallback;
        setEnemy(fallback);
        focusedUnitIdRef.current = fallback.unitId ?? null;
      }
    }
    if (mode === 'ALL') {
      selectedTargetIdRef.current = null;
      setSelectedTargetId(null);
    }
    executeOperativeAbility(selectedAbility);
    setSelectedAbility(null);
    publishSquadUi(squadRef.current);
  };

  const stageAbility = (abilityId: string) => {
    const mode = classAbilityTargetMode(operativeClass, abilityId);
    if (mode === 'ALL') {
      selectedTargetIdRef.current = null;
      setSelectedTargetId(null);
      // Bootstrap executor context without marking a single cast target.
      if (!enemyRef.current || !isUnitAlive(enemyRef.current)) {
        const fallback = primaryAliveUnit(squadRef.current);
        if (fallback) {
          enemyRef.current = fallback;
          setEnemy(fallback);
          focusedUnitIdRef.current = fallback.unitId ?? null;
        }
      }
    }
    setSelectedAbility(abilityId);
  };

  const abortStagedAbility = () => {
    setSelectedAbility(null);
  };

  useEffect(() => {
    enemyActionStageRef.current = enemyActionStage;
    publishSquadUi(squadRef.current);
  }, [enemyActionStage]);

  useEffect(() => {
    if (!isPlayerTurn || cycleState !== 'TEXT_COMBAT') {
      setSelectedAbility(null);
    }
    publishSquadUi(squadRef.current);
  }, [isPlayerTurn, cycleState, selectedAbility, selectedTargetId, combatTurnPhase]);

  useEffect(() => {
    onWardPrimedChange?.(abyssalWardActive);
  }, [abyssalWardActive, onWardPrimedChange]);

  useEffect(() => {
    // Veil-Piercer keeps occult damage rules but must not show the purple primed aura.
    onAbilityPrimedChange?.(
      selectedAbility != null && selectedAbility !== 'VEIL_PIERCER',
    );
  }, [selectedAbility, onAbilityPrimedChange]);

  const envoyRotStacksTotal = operativeClass === 'ENVOY'
    ? totalVeilRotStacks(classCombatRef.current)
    : 0;
  const envoyCatalyticPayload = operativeClass === 'ENVOY'
    ? totalCatalyticPayload(classCombatRef.current)
    : 0;

  useEffect(() => {
    if (!onOperativeTelemetryChange) return;
    onOperativeTelemetryChange({
      operativeClass,
      operativeHp,
      maxSoulAnchor: getEffectiveMaxSoulAnchor(),
      maxAnchorDebt: playerMaxAnchorDebt,
      trueMaxSoulAnchor: combatMaxSoulAnchor,
      abyssalReserve,
      abyssalCap: mutationModsRef.current.abyssalCap,
      stamina,
      maxStamina,
      counterReady,
      voidWardPrimed,
      runicBrands,
      runicBrandCap: RUNIC_BRAND_CAP,
      eviscerateReady: operativeClass === 'AEGIS'
        && (sliceReady || stagedUltimateReady),
      zeroProtocolReady: operativeClass === 'HEX_SHOT'
        && (zeroProtocolReady || stagedUltimateReady),
      weaponUltimateReady: (sliceReady || zeroProtocolReady || cataclysmReady || stagedUltimateReady),
      weaponUltimateDisplayName: activeWeaponFamilyId
        ? (resolveWeaponUltimateDisplayName(activeWeaponFamilyId) ?? undefined)
        : undefined,
      currentAmmo,
      maxAmmo,
      overchargeMultiplier: operativeClass === 'HEX_SHOT'
        ? hexShotState.overchargeMultiplier
        : 0,
      hexAmmoType: operativeClass === 'HEX_SHOT' ? hexShotState.currentAmmoType : undefined,
      hexProtocolCharges: operativeClass === 'HEX_SHOT' ? hexShotState.protocolCharges : 0,
      hexMaxProtocolCharges: operativeClass === 'HEX_SHOT' ? hexShotState.maxProtocolCharges : 0,
      hexNextShotOvercharged: operativeClass === 'HEX_SHOT' ? hexShotState.nextShotOvercharged : false,
      overcharged: operativeClass === 'AEGIS' ? aegisOvercharged : false,
      veilFlux,
      fluxMaxCap: envoyCombatState.fluxMaxCap,
      envoyVoidSiphoned: envoyCombatState.isVoidSiphoned,
      envoySilenced: envoyCombatState.isVoidSiphoned && !envoyBoonMods.masochisticChannel,
      veilRotStacksTotal: envoyRotStacksTotal,
      catalyticPayloadEstimate: envoyCatalyticPayload,
      activeWeaponFamilyId: activeWeaponFamilyId ?? undefined,
      riftEdgeTempoArmed: weaponRuntimeRef.current.riftEdgeTempoArmed,
      previousCatalyst: operativeClass === 'ENVOY'
        ? (classCombatRef.current.previousCatalyst ?? null)
        : undefined,
      cleanCatalystCycleReady: operativeClass === 'ENVOY'
        && activeWeaponFamilyId === 'envoy-null-conduit'
        && (classCombatRef.current.previousCatalyst === 'NULL'
          || classCombatRef.current.previousCatalyst === 'BLOOD'),
      lanternDetonationReady: operativeClass === 'ENVOY'
        && activeWeaponFamilyId === 'envoy-echo-lantern'
        && envoyRotStacksTotal > 0,
      prismBrinkActive: operativeClass === 'ENVOY'
        && activeWeaponFamilyId === 'envoy-sanguine-prism'
        && veilFlux <= 25,
      prismSacrificePreview: operativeClass === 'ENVOY' && activeWeaponFamilyId === 'envoy-sanguine-prism'
        ? Math.min(8, Math.floor(getEffectiveMaxSoulAnchor() * 0.05))
        : undefined,
      prismCanPayFullSacrifice: operativeClass === 'ENVOY'
        && activeWeaponFamilyId === 'envoy-sanguine-prism'
        && operativeHp > Math.min(8, Math.floor(getEffectiveMaxSoulAnchor() * 0.05)),
    });
  }, [
    onOperativeTelemetryChange,
    operativeClass,
    operativeHp,
    combatMaxSoulAnchor,
    playerMaxAnchorDebt,
    abyssalReserve,
    stamina,
    maxStamina,
    counterReady,
    voidWardPrimed,
    runicBrands,
    sliceReady,
    zeroProtocolReady,
    cataclysmReady,
    stagedUltimateReady,
    aegisOvercharged,
    currentAmmo,
    maxAmmo,
    hexShotState.overchargeMultiplier,
    hexShotState.currentAmmoType,
    hexShotState.protocolCharges,
    hexShotState.maxProtocolCharges,
    hexShotState.nextShotOvercharged,
    veilFlux,
    envoyCombatState.isVoidSiphoned,
    envoyBoonMods.masochisticChannel,
    envoyRotStacksTotal,
    envoyCatalyticPayload,
    activeWeaponFamilyId,
    enemy?.currentHp,
  ]);

  const enemyAlive = (enemy?.currentHp ?? 0) > 0;
  const bloodForTimeOwned = hasMutation(leyLineMutations, 'BLOOD_FOR_TIME');

  const commandDeck = (
    <CombatCommandDeck
      loadout={activeLoadout}
      selectedAbility={selectedAbility}
      onSelectAbility={stageAbility}
      onConfirm={confirmSelectedAbility}
      onAbort={abortStagedAbility}
      onEndTurn={onEndTurn}
      actionPoints={playerActionPoints}
      displayActionPoints={apRollupDisplay}
      initiativeQueued={initiativeQueued}
      initiativeProcSeq={initiativeProcSeq}
      onInitiativeProcComplete={onInitiativeProcComplete}
      isActionEnabled={isOperativeAbilityEnabled}
      canSelectActions={isPlayerTurn && cycleState === 'TEXT_COMBAT' && !shadowstepProcActive}
      getActionDisableReason={getOperativeAbilityDisableReason}
      getAbilityLabel={(abilityId) => formatAbilityLabel(
        operativeClass,
        abilityId,
        activeWeaponFamilyId,
      )}
      getAbilityCategory={(abilityId) => resolveAbilityUiCategory(operativeClass, abilityId)}
      getAbilityEffectTags={(abilityId) => {
        if (resolvedWeapon && activeWeaponFamilyId) {
          const living = Math.max(1, aliveUnits(squad).length || 1);
          const card = resolveWeaponAnchorCardPresentation({
            classId: operativeClass,
            abilityId,
            weapon: resolvedWeapon,
            runtime: weaponRuntimeRef.current,
            stamina,
            currentAmmo,
            veilFlux,
            operativeHp,
            maxOperativeHp: combatMaxSoulAnchor,
            previousCatalyst: classCombatRef.current.previousCatalyst ?? null,
            pulseSpreadSecondaryCount: Math.max(0, living - 1),
            claymoreStaminaCommitted: !weaponRuntimeRef.current.claymoreBreakCashoutUsed,
            hexPerfectReload: false,
            riposteReady: classCombatRef.current.riposteReady,
            targetFractured: !!(enemyRef.current && isEnemyFractured(enemyRef.current)),
            lanternDetonationReady: operativeClass === 'ENVOY'
              && activeWeaponFamilyId === 'envoy-echo-lantern'
              && envoyRotStacksTotal > 0,
            prismCanPayFullSacrifice: operativeClass === 'ENVOY'
              && activeWeaponFamilyId === 'envoy-sanguine-prism'
              ? operativeHp > Math.min(8, Math.floor(combatMaxSoulAnchor * 0.05))
              : undefined,
          });
          if (card) return card.effectLine;
        }
        return formatAbilityCardEffectLine(operativeClass, abilityId, {
          equippedWeaponFamilyId: activeWeaponFamilyId,
        });
      }}
      getAbilityTargetMode={(abilityId) => classAbilityTargetMode(operativeClass, abilityId)}
      canEndTurn={isPlayerTurn && cycleState === 'TEXT_COMBAT' && !shadowstepProcActive}
      getStagedCostImpact={getStagedCostImpact}
      getStagedAbilityDescription={(abilityId) => {
        if (resolvedWeapon && activeWeaponFamilyId) {
          const living = Math.max(1, aliveUnits(squad).length || 1);
          const card = resolveWeaponAnchorCardPresentation({
            classId: operativeClass,
            abilityId,
            weapon: resolvedWeapon,
            runtime: weaponRuntimeRef.current,
            stamina,
            currentAmmo,
            veilFlux,
            operativeHp,
            maxOperativeHp: combatMaxSoulAnchor,
            previousCatalyst: classCombatRef.current.previousCatalyst ?? null,
            pulseSpreadSecondaryCount: Math.max(0, living - 1),
            riposteReady: classCombatRef.current.riposteReady,
            targetFractured: !!(enemyRef.current && isEnemyFractured(enemyRef.current)),
            lanternDetonationReady: operativeClass === 'ENVOY'
              && activeWeaponFamilyId === 'envoy-echo-lantern'
              && envoyRotStacksTotal > 0,
            prismCanPayFullSacrifice: operativeClass === 'ENVOY'
              && activeWeaponFamilyId === 'envoy-sanguine-prism'
              ? operativeHp > Math.min(8, Math.floor(combatMaxSoulAnchor * 0.05))
              : undefined,
          });
          if (card) return card.expandedDescription;
        }
        return getStagedAbilityDescription(abilityId);
      }}
      getActionAccent={getAbilityAccent}
      bloodForTimeAvailable={bloodForTimeOwned}
      bloodForTimeEnabled={
        bloodForTimeOwned
        && isPlayerTurn
        && cycleState === 'TEXT_COMBAT'
        && !mutationEncounterRef.current.bloodForTimeUsed
      }
      onBloodForTime={onBloodForTime}
      combatReloadAvailable={operativeClass === 'HEX_SHOT'}
      combatReloadEnabled={
        operativeClass === 'HEX_SHOT'
        && isPlayerTurn
        && cycleState === 'TEXT_COMBAT'
        && !shadowstepProcActive
        && !activeReloadVisible
        && !hexReloadUsedThisTurn
      }
      onCombatReload={onCombatReload}
      voidWardAvailable={operativeClass === 'AEGIS'}
      voidWardEnabled={
        operativeClass === 'AEGIS'
        && isPlayerTurn
        && cycleState === 'TEXT_COMBAT'
        && !shadowstepProcActive
        && playerActionPoints >= VOID_WARD_AP_COST
      }
      voidWardPrimed={voidWardPrimed}
      riposteReady={riposteReadyUi}
      riposteStatusTitle={riposteReadyUi ? 'RIPOSTE READY — 1' : null}
      riposteStatusShort={riposteReadyUi
        ? (
          classCombatRef.current.riposteExpiresAfterPlayerTurn != null
          && balanceEncounterRef.current.playerTurns
            >= classCombatRef.current.riposteExpiresAfterPlayerTurn
            ? 'Your next successful STRIKE this turn deals +16 Kinetic.'
            : 'Your next successful STRIKE before the end of your next player turn deals +16 Kinetic. Misses do not consume it.'
        )
        : null}
      isStrikeAbility={(abilityId) => abilityCarriesStrikeTag(operativeClass, abilityId)}
      onVoidWardPrime={onVoidWardPrime}
      catalyticConsoleAvailable={operativeClass === 'ENVOY'}
      catalyticConsoleEnabled={
        operativeClass === 'ENVOY'
        && isPlayerTurn
        && cycleState === 'TEXT_COMBAT'
        && !shadowstepProcActive
        && !catalyticConsoleVisible
        && !activeReloadVisible
        && envoyRotStacksTotal > 0
        && playerActionPoints >= CATALYTIC_CONSOLE_AP_COST
      }
      catalyticConsoleRotStacks={envoyRotStacksTotal}
      onCatalyticConsole={onCatalyticConsole}
      borderColor={theme.borderColor}
      primaryColor={theme.primaryColor}
      mutedColor={theme.mutedColor}
      frameless
      dashboardLayout
    />
  );

  const holdVictoryChrome =
    cycleState === 'RESOLUTION' && resolutionOutcome === 'VICTORY';

  // Must include staged WU-4 + OFFENSE_SLICE or the center ultimate circle opens state
  // without mounting CombatMinigameOverlayHost (Phase 3M repair).
  const classMinigameActive = isWeaponUltimateMinigameHostActive({
    activeReloadVisible,
    zeroProtocolVisible,
    cataclysmSigilVisible,
    catalyticConsoleVisible,
    stagedWeaponUltimateId,
    cycleState,
  });

  const renderStatusFeed = () => (
    !classMinigameActive ? (
    <View
      style={styles.statusFeedSlotStacked}
      pointerEvents="none"
    >
      {cycleState === 'TEXT_COMBAT' ? (
        <>
          {phaseAlert ? (
            <Text style={[styles.phaseAlert, { color: '#ef4444' }]}>{phaseAlert}</Text>
          ) : null}
          {objectiveHudLine ? (
            <Text style={[styles.phaseAlert, { color: '#fde68a' }]}>
              {`OBJ // ${objectiveHudLine}`}
            </Text>
          ) : null}
          {timelineHudLine ? (
            <Text style={[styles.exhaustedBanner, { color: '#7dd3fc' }]}>
              {`TL // ${timelineHudLine}`}
            </Text>
          ) : null}
          {isExhausted ? (
            <Text style={styles.exhaustedBanner}>
              {operativeClass === 'AEGIS'
                ? 'EXHAUSTED — COUNTER/SLICE OFFLINE'
                : 'EXHAUSTED — FLUX RESERVES OFFLINE'}
            </Text>
          ) : null}
          {env.isPlayerBlinded ? (
            <Text style={[styles.exhaustedBanner, { color: '#fbbf24' }]}>
              BLINDED — COUNTER WINDOW -15%
            </Text>
          ) : null}
        </>
      ) : null}
    </View>
    ) : null
  );

  const renderEnemyTurnPanel = () => {
    const intentLabel = enemy ? formatIntentReadout(enemy.intent) : 'RESOLVING';
    const stage = enemyActionStage === 'executing' ? 'executing' : 'reading';
    return (
      <CombatHostileTurnPanel
        intentLabel={intentLabel}
        stage={stage}
      />
    );
  };

  const showCommandDeck =
    !classMinigameActive
    && ((cycleState === 'TEXT_COMBAT' && isPlayerTurn)
    || holdVictoryChrome);

  const showEnemyTurnPanel =
    !classMinigameActive
    && cycleState === 'TEXT_COMBAT'
    && !isPlayerTurn
    && !holdVictoryChrome;

  const renderCommandDeckSlot = () => (
    <View style={styles.commandDeckAnchor}>
      {showCommandDeck ? commandDeck : null}
      {showEnemyTurnPanel ? renderEnemyTurnPanel() : null}
    </View>
  );

  const useEnemyArenaChrome = enemyChrome != null;

  const chromeSnapshot = useMemo(
    () => ({
      ultimatePingVisible: ultimatePingReady && enemyAlive,
      ultimatePingReady: ultimatePingReady && enemyAlive,
      ultimatePingDisabled: !isPlayerTurn
        || cycleState !== 'TEXT_COMBAT'
        || isExhausted
        || combatPausedRef.current
        || stagedWeaponUltimateId != null
        || zeroProtocolVisible
        || cataclysmSigilVisible,
      ultimatePingVariant: ultimatePingVariant,
      ultimatePingAccessibilityLabel: formatWeaponUltimatePingAccessibilityLabel(activeWeaponFamilyId),
      ultimatePingDisplayName: resolveWeaponUltimateDisplayName(activeWeaponFamilyId) ?? null,
      ultimatePingInteractionOpen: stagedWeaponUltimateId != null
        || zeroProtocolVisible
        || cataclysmSigilVisible
        || cycleState === 'OFFENSE_SLICE',
      masteryProgressVisible: masteryProgress.visible && isPlayerTurn && cycleState === 'TEXT_COMBAT',
      masteryProgressCurrent: masteryProgress.current,
      masteryProgressRequired: masteryProgress.required,
      masteryProgressAccent: masteryProgress.accent,
      onUltimatePing,
      parryVisible: cycleState === 'DEFEND_PARRY',
      wardVisible: cycleState === 'DEFEND_WARD',
      envoyWardSpeed,
      onEnvoyWardRelease: finalizeEnvoyWard,
      parryShrinkScale: parryScaleSV,
      parrySuccess: isSuccessState,
      parryFailure: isFailureState,
      parrySuccessBurstVisible: parrySuccessBurstActive,
      parryBurstArena,
      onParryTap,
      registerParryArena,
      registerSliceArena,
      sliceVisible: cycleState === 'OFFENSE_SLICE',
      eviscerateTargetUnitId,
      sliceLines,
      activeSliceIndex,
      ruinVfxSeq,
      slicePanHandlers: panResponder.panHandlers as Record<string, unknown>,
    }),
    [
      cycleState,
      parrySuccessBurstActive,
      parryBurstArena,
      ultimatePingReady,
      ultimatePingVariant,
      activeWeaponFamilyId,
      stagedWeaponUltimateId,
      zeroProtocolVisible,
      cataclysmSigilVisible,
      masteryProgress,
      sliceReady,
      enemyAlive,
      isPlayerTurn,
      isExhausted,
      envoyWardSpeed,
      isSuccessState,
      isFailureState,
      eviscerateTargetUnitId,
      sliceLines,
      activeSliceIndex,
      ruinVfxSeq,
      onUltimatePing,
      onParryTap,
      panResponder.panHandlers,
    ],
  );

  const renderClassMinigameOverlays = () => (
    <>
      <ActiveReloadOverlay
        visible={activeReloadVisible}
        mode={hexShotState.isAutoLoadMinigameActive ? 'flow' : 'tactical'}
        perfectWindowScale={hexShotBoonMods.gunsmithsCurseActive ? 0.5 : 1}
        currentAmmoType={hexShotState.currentAmmoType}
        onResolve={handleActiveReloadResolve}
      />
      <WeaponUltimateHostChrome
        active={
          zeroProtocolVisible
          || cataclysmSigilVisible
          || stagedWeaponUltimateId != null
          || cycleState === 'OFFENSE_SLICE'
        }
        title={
          zeroProtocolVisible
            ? '[ ZERO PROTOCOL ]'
            : cataclysmSigilVisible
              ? '[ NULL CIRCUIT ]'
              : stagedWeaponUltimateId
                ? `[ ${getWeaponUltimateById(stagedWeaponUltimateId).displayName} ]`
                : cycleState === 'OFFENSE_SLICE'
                  ? `[ ${ABYSSAL_VERDICT_DISPLAY_NAME} ]`
                  : '[ WEAPON ULTIMATE ]'
        }
        onCancel={cancelWeaponUltimateInteraction}
        simplified={simplifiedUltimateInputs === true}
      >
        <ZeroProtocolGridOverlay
          visible={zeroProtocolVisible}
          onTap={handleZeroProtocolTap}
          onComplete={(taps) => {
            if (taps <= 0) {
              cancelWeaponUltimateInteraction();
              return;
            }
            finishZeroProtocol(taps, false);
          }}
        />
        <CataclysmSigilOverlay
          visible={cataclysmSigilVisible}
          onResolve={(nodes) => {
            if (nodes <= 0) {
              cancelWeaponUltimateInteraction();
              return;
            }
            handleCataclysmResolve(nodes, false);
          }}
        />
        <WeaponUltimateStagedSkillOverlay
          visible={stagedWeaponUltimateId != null}
          ultimateId={stagedWeaponUltimateId}
          simplified={simplifiedUltimateInputs === true}
          onCancel={cancelWeaponUltimateInteraction}
          onComplete={({ grade }) => commitStagedWeaponUltimate(grade, false)}
        />
        {cycleState === 'OFFENSE_SLICE' ? (
          <VectorSliceOverlay
            visible
            lines={sliceLines}
            activeIndex={activeSliceIndex}
            panHandlers={panResponder.panHandlers}
            onArenaLayout={registerSliceArena}
          />
        ) : null}
      </WeaponUltimateHostChrome>
      <CatalyticConsoleOverlay
        visible={catalyticConsoleVisible}
        rotStacksTotal={envoyRotStacksTotal}
        payloadEstimate={envoyCatalyticPayload}
        onRelease={finalizeCatalyticRelease}
      />
    </>
  );

  const renderHubOverlays = () => (
    <>
      {!useEnemyArenaChrome ? (
        <>
          <ParryMatrixOverlay
            visible={cycleState === 'DEFEND_PARRY'}
            shrinkScale={parryScaleSV}
            success={false}
            failure={false}
            onTap={onParryTap}
            onArenaLayout={registerParryArena}
          />
          {parrySuccessBurstActive && parryBurstArena ? (
            <View style={styles.parryBurstHost} pointerEvents="none">
              <View
                style={{
                  width: parryBurstArena.width,
                  height: parryBurstArena.height,
                }}
              >
                <ParrySuccessBurstOverlay
                  key={parryBurstEpoch}
                  burstEpoch={parryBurstEpoch}
                  arena={parryBurstArena}
                />
              </View>
            </View>
          ) : null}
          <VectorSliceOverlay
            visible={cycleState === 'OFFENSE_SLICE'}
            lines={sliceLines}
            activeIndex={activeSliceIndex}
            panHandlers={panResponder.panHandlers}
            onArenaLayout={registerSliceArena}
          />
        </>
      ) : null}

      {!useEnemyArenaChrome && cycleState === 'DEFEND_WARD' ? (
        <EnvoyWardOverlay
          visible
          expansionSpeed={envoyWardSpeed}
          onRelease={finalizeEnvoyWard}
        />
      ) : null}
    </>
  );

  return (
    <View style={[styles.rootStacked, { borderColor: theme.borderColor }]}>
      {useEnemyArenaChrome ? <CombatChromeBridge {...chromeSnapshot} /> : null}
      {screenFlashActive && (
        <View style={styles.flashWrapStacked} pointerEvents="none">
          <VignetteFlashOverlay color={screenFlashColor} opacityAnim={screenFlashAnim} />
        </View>
      )}
      <View style={styles.commandDeckRow}>
        {renderStatusFeed()}
        {renderCommandDeckSlot()}
      </View>
      <CombatMinigameActiveBridge active={classMinigameActive} />
      <CombatMinigameOverlaySink>
        {renderClassMinigameOverlays()}
      </CombatMinigameOverlaySink>
      <CombatArenaOverlaySink>
        {renderHubOverlays()}
        <CombatFloatingFeedback
          key={combatFeedback?.nonce ?? 'idle'}
          event={combatFeedback?.event ?? null}
          onComplete={() => setCombatFeedback(null)}
        />
        <View style={styles.combatCenterFloatHost} pointerEvents="none">
          <CombatCenterStatusFloat
            triggerSeq={centerSkipFloatSeq}
            label={centerSkipFloatSeq > 0 ? 'Enemy Turn Skipped' : ''}
          />
        </View>
      </CombatArenaOverlaySink>
    </View>
  );
}

const abs = StyleSheet.absoluteFillObject;
const styles = StyleSheet.create({
  root: { flex: 1, width: '100%', alignSelf: 'stretch', minHeight: 0 },
  rootStacked: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    alignSelf: 'stretch',
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
    gap: 4,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    position: 'relative',
  },
  combatOverlayLayer: {
    ...abs,
    zIndex: 25,
  },
  combatCenterFloatHost: {
    ...abs,
    zIndex: 41,
    alignItems: 'center',
    justifyContent: 'center',
  },
  parryBurstHost: {
    ...abs,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 26,
  },
  operativeGaugePanel: {
    width: '100%',
    flexShrink: 0,
    gap: 2,
    paddingVertical: 4,
  },
  commandDeckRow: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    position: 'relative',
    gap: 3,
    backgroundColor: 'transparent',
  },
  statusFeedSlot: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '100%',
    minHeight: 52,
    maxHeight: 52,
    justifyContent: 'flex-end',
    gap: 4,
    paddingBottom: 4,
    paddingHorizontal: 2,
    overflow: 'hidden',
  },
  statusFeedSlotStacked: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '100%',
    minHeight: 40,
    maxHeight: 40,
    justifyContent: 'flex-end',
    gap: 2,
    paddingBottom: 2,
    paddingHorizontal: 2,
    overflow: 'hidden',
  },
  commandDeckAnchor: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  statusFeedCompact: {
    flexShrink: 0,
    width: '100%',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  actionStageStacked: {
    flexShrink: 0,
    width: '100%',
    position: 'relative',
    minHeight: 48,
  },
  flashWrapStacked: {
    ...abs,
    zIndex: 100,
    overflow: 'hidden',
  },
  panel: { flex: 1, borderWidth: 2, padding: 16, width: '100%', overflow: 'hidden', flexDirection: 'column', minHeight: 0 },
  panelStacked: {
    flexShrink: 0,
    borderWidth: 2,
    padding: 12,
    width: '100%',
    overflow: 'hidden',
    flexDirection: 'column',
  },
  header: { borderBottomWidth: 1, paddingBottom: 6, marginBottom: 8, flexShrink: 0 },
  headerText: { fontFamily: MONO, fontSize: 10, letterSpacing: 0.5, flexShrink: 1, flexWrap: 'wrap' },
  telemetryStack: {
    flexShrink: 0,
    width: '100%',
    marginBottom: 8,
    backgroundColor: '#000000',
  },
  threatMatrix: {
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 4,
    width: '100%',
  },
  threatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    width: '100%',
  },
  threatId: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    fontFamily: MONO,
    fontSize: 9,
    letterSpacing: 0.6,
    lineHeight: 12,
  },
  threatHp: {
    flexShrink: 0,
    fontFamily: MONO,
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    lineHeight: 12,
    textAlign: 'right',
    maxWidth: '38%',
  },
  intentReadout: {
    fontFamily: MONO,
    fontSize: 7,
    letterSpacing: 0.5,
    lineHeight: 10,
    opacity: 0.55,
    width: '100%',
  },
  telemetryDivider: {
    height: 1,
    width: '100%',
    backgroundColor: TELEMETRY_DIVIDER,
  },
  operativeCore: {
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 4,
    width: '100%',
  },
  telemetryLine: {
    fontFamily: MONO,
    fontSize: 9,
    letterSpacing: 0.6,
    lineHeight: 12,
    paddingVertical: 4,
    width: '100%',
  },
  tacticsStage: { flex: 1, minHeight: 0, marginBottom: 8 },
  tacticsStageStacked: { flexShrink: 0, marginBottom: 0 },
  canvas: {
    position: 'relative',
    flex: 1,
    minHeight: 120,
    flexDirection: 'column',
    justifyContent: 'flex-start',
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  canvasStacked: {
    flexShrink: 0,
    flexDirection: 'column',
    justifyContent: 'flex-start',
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  statusFeed: {
    flexShrink: 0,
    width: '100%',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  actionStage: {
    flexShrink: 0,
    width: '100%',
    position: 'relative',
    justifyContent: 'flex-end',
    backgroundColor: '#000000',
  },
  flashWrap: { ...abs, zIndex: 100, overflow: 'hidden' },
  phaseAlert: {
    fontFamily: MONO,
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 13,
    textAlign: 'left',
    letterSpacing: 0.8,
    width: '100%',
  },
  exhaustedBanner: {
    fontFamily: MONO,
    fontSize: 9,
    letterSpacing: 1,
    lineHeight: 12,
    textAlign: 'left',
    color: P.enemyHp,
    width: '100%',
  },
  aegisBanner: {
    fontFamily: MONO,
    fontSize: 8,
    letterSpacing: 1,
    lineHeight: 12,
    textAlign: 'left',
    width: '100%',
  },
  combatOverlayLayerLegacy: {
    ...abs,
    zIndex: 25,
  },
});
