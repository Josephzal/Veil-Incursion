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
  resolvePlayerEvadeChance,
  rollEvade,
} from '../data/combatChanceEngine';
import {
  COMBAT_CHANCE,
  createDefaultCombatChanceState,
  type CombatChanceEncounterState,
  type CombatFeedbackEvent,
} from '../types/combatChance';
import CombatFloatingFeedback from './combat/CombatFloatingFeedback';
import CombatCenterStatusFloat from './combat/CombatCenterStatusFloat';
import {
  DEFAULT_AEGIS_TECHNIQUE_LOADOUT,
  PLAYER_ACTION_POINTS_PER_TURN,
  RUNIC_BRAND_CAP,
  VOID_WARD_AP_COST,
  VOID_WARD_PERFECT_RESERVE_GAIN,
  type AegisAbilityId,
  type AegisTechniqueId,
  type AegisTechniqueLoadout,
  type AegisWeaponActionId,
} from '../types/aegisCombat';
import { buildAegisCombatSurface } from '../data/aegisCombatCompatibility';
import {
  aegisWeaponActionApCost,
  isAegisWeaponActionCatalogId,
} from '../data/aegisWeaponActionCatalog';
import { executeAegisWeaponActionPlan } from '../data/aegisWeaponActionExecutor';
import {
  beginAegisPlayerTurnWeaponState,
  armAegisTempo,
  clearDreadbound,
  clearEclipse,
  createDefaultAegisWeaponCombatState,
  expireAegisTempoAtPlayerTurnEnd,
  expireDoomfallReleaseAtTurnEnd,
  markDreadboundMastery,
  type AegisWeaponCombatState,
} from '../data/aegisWeaponCombatState';
import {
  previewDreadHorizonUnitIds,
  resolveDreadHorizonTargets,
  type AuthoredHitOutcome,
} from '../data/aegisWeaponActionRuntime';
import {
  DREADBIND_MASTERY_FRACTURE,
  ECLIPSE_EVADE_BONUS_PCT,
} from '../data/aegisWeaponActionResolveEngine';
import {
  createAegisControlPipelineSession,
  hubApplyAegisPlayerControl,
  hubResolveAegisInboundPlayerHit,
  scrubAegisStagedCombatCommand,
  type AegisControlPipelineSession,
} from '../data/aegisCombatHubRuntime';
import type { AegisControlInterruptReason } from '../data/aegisDoomfallInterruptEngine';
import { isAegisTechniqueId } from '../data/aegisTechniqueCatalog';
import { getAbilityDefinition } from '../data/aegisAbilities';
import { buildGraftCastPlan, canAffordGraftResources, scaleGraftDamage } from '../data/veilGraftEngine';
import {
  getUniversalGraftDefinition,
  readUniversalUpgradeValue,
  upgradeDamagePacketValue,
} from '../data/universalGraftRegistry';
import type { GraftCastPlan } from '../types/veilGraft';
import { resolveAegisAbilityGraftId } from '../data/aegisGraftTarget';
import {
  buildWeaponActionGraftCastPlan,
} from '../data/aegisWeaponActionGraftEngine';
import {
  applyMasochistsJoyAmplification,
} from '../data/aegisGraftPhaseE1e1Engine';
import {
  absorbHitAbsorbProtection,
  armHitAbsorbProtection,
  formatHitAbsorbProtectionAbsorbLog,
  formatHitAbsorbProtectionArmedLog,
  hitAbsorbProtectionDisplayName,
  readHitAbsorbProtectionFromBoonEncounter,
  writeHitAbsorbProtectionToBoonEncounter,
  type HitAbsorbProtectionSource,
} from '../data/hitAbsorbProtectionEngine';
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
import { formatCatalystChip } from '../data/envoyCatalystEngine';
import {
  catalystPrimeForEnvoyCast,
  resolveEnvoyCatalystCast,
} from '../data/envoyCatalystCastEngine';
import {
  clearSmokeArcAccuracyDownEndOfEnemyTurn,
  expireSanguineExposureEndOfEnemyTurn,
} from '../data/envoySanguineExposureEngine';
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
  commitTechniqueResources,
  resolveTechniqueResourceCosts,
  validateTechniqueCommitment,
  type TechniqueCommitSnapshot,
} from '../data/aegisTechniqueCommitEngine';
import {
  armRuneboundCarapace,
  clearRuneboundCarapace,
  createRuneboundCarapaceState,
  noteCarapaceInboundHit,
  resolveCarapaceAfterEnemyAction,
  type RuneboundCarapaceState,
} from '../data/aegisRuneboundCarapaceEngine';
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
import { getHexShotAbilityTags, HEX_SHOT_ABILITY_CATALOG } from '../data/hexShotAbilities';
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
  removeCombatTag,
  stackDoomedTag,
} from '../data/combatFractureEngine';
import type { WeaponFamilyId } from '../types/weapon';
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
import { resolveUnmakerTier3FractureBreakReserveGrant } from '../data/unmakerTier3FractureBreakEngine';
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
import type { CombatSessionExtras, StructuredPlayerDebuff } from '../types/combatHooks';
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
import {
  applyHexAmmoFractureBonus,
  isHexAmmoHeavyShot,
  isUnitMarked,
  mergeDurationTurns,
  splitHexAmmoDamageChannels,
  tickDurationMap,
} from '../data/hexShotPhaseH2aEngine';
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
  sanitizeHexShotCombatLoadout,
} from '../data/classAbilityUnlockEngine';
import { planFractureBreachStrike } from '../data/combatFractureBreachEngine';
import {
  isHitstopActive,
  triggerHitstop,
  triggerHaptic,
  triggerShake,
} from '../utils/combatJuice';
import {
  dispatchCombatPresentationFromJuice,
  registerCombatPresentationContactRevealListener,
} from '../utils/combatPresentationBus';
import { presentResolvedWeaponHit } from '../data/weaponCombatPresentation/presentResolvedWeaponHit';
import { scalePresentationMs } from '../data/weaponCombatPresentation/presentationSettings';
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
import {
  ABYSSAL_VERDICT_BRACKET_COLLAPSE_MS,
  isAbyssalVerdictEnemyEligible,
  previewAbyssalVerdictDamage,
  resolveAbyssalVerdictPresentationState,
  resolveConsoleUltimateMeterHeader,
  shouldFireAbyssalVerdictReadyNotification,
  type AbyssalVerdictHudSnapshot,
} from '../data/abyssalVerdictReadyUi';
import {
  planAbyssalVerdictAftermath,
  resolveAbyssalVerdictCommitFromGradeInput,
  type AbyssalVerdictStagedCommit,
} from '../data/abyssalVerdictCommitEngine';
import {
  gravefallBaseStrike,
  rendTheVeilBaseStrike,
} from '../data/aegisUltimatePowerEngine';
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
import { buildHexCombatSurface } from '../data/hexCombatCompatibility';
import { sanitizeHexFlexLoadout } from '../data/hexFlexLoadoutEngine';
import { buildEnvoyCombatSurface } from '../data/envoyCombatCompatibility';
import { sanitizeEnvoyFlexLoadout } from '../data/envoyFlexLoadoutEngine';
import {
  executeEnvoyWeaponAction,
} from '../data/envoyWeaponActionExecutor';
import {
  formatEnvoyWeaponActionEffectLine,
  formatEnvoyWeaponActionExpandedDescription,
  previewEnvoyWeaponAction,
} from '../data/envoyWeaponActionPreviewEngine';
import {
  formatEnvoyWeaponActionLabel,
  getEnvoyWeaponActionDefinition,
} from '../data/envoyWeaponActionCatalog';
import {
  isEnvoyWeaponActionId,
  isEnvoyWeaponActionLiveExecutable,
  isEnvoyWeaponFamilyId,
} from '../data/envoyWeaponActionRegistry';
import type { EnvoyWeaponActionId } from '../types/envoyWeaponAction';
import {
  executeHexWeaponAction,
  isHexWeaponActionEnabled,
  isLastWordLegalTarget,
  previewSixBellsRounds,
  SIX_BELLS_PACKET_DAMAGE,
  SLIPSHOT_BASE_DAMAGE,
  LAST_WORD_BASE_DAMAGE,
  CENTER_MASS_BASE_DAMAGE,
  CONTROLLED_BURST_PACKET_DAMAGE,
  CONTROLLED_BURST_ROUNDS,
  SUPPRESSIVE_BARRAGE_PACKET_DAMAGE,
  SUPPRESSIVE_BARRAGE_ROUNDS,
  CONTACT_FRONT_PACKET_DAMAGE,
  DEADBOLT_BASE_AUTHORED,
  DEADBOLT_PRIMED_AUTHORED,
  FATAL_FUNNEL_PRIMARY_AUTHORED,
  FATAL_FUNNEL_REAR_AUTHORED,
  THRESHOLD_AUTHORED,
  scaleSidearmAuthoredDamage,
  scaleHexWeaponAuthoredDamage,
  resolveContactFrontAllocation,
} from '../data/hexWeaponActionExecutor';
import {
  clearHexElusive,
  isHexElusiveEligibleIncoming,
  tryConsumeHexElusive,
} from '../data/hexElusiveEngine';
import {
  clearHexFiringSolution,
  clearHexFiringSolutionIfUnit,
  expireHexFiringSolutionAtPlayerTurnEnd,
  formatFiringSolutionLifetimePreview,
  FIRING_SOLUTION_ACCURACY_BONUS_PCT,
  hasFiringSolutionOn,
} from '../data/hexFiringSolutionEngine';
import {
  applyCarbineSuppressedDamage,
  clearHexCarbineSuppressed,
  clearHexCarbineSuppressedIfUnit,
  isHexCarbineSuppressedEligibleIncoming,
  CARBINE_SUPPRESSED_DAMAGE_MULT,
} from '../data/hexCarbineSuppressedEngine';
import {
  applyBlackDoorBacklineFalloff,
} from '../data/hexBlackDoorPositionEngine';
import {
  previewFatalFunnelUnitIds,
  resolveFatalFunnelLane,
} from '../data/hexFatalFunnelEngine';
import {
  clearHexThreshold,
  consumeHexThresholdArm,
  isHexThresholdEligibleEnemyAction,
  THRESHOLD_AUTHORED_DAMAGE,
} from '../data/hexThresholdEngine';
import {
  armHexDeadboltReloadOpportunity,
} from '../data/hexDeadboltEngine';
import {
  formatHexWeaponActionLabel,
  getHexWeaponActionDefinition,
  isDefinedHexWeaponActionId,
} from '../data/hexWeaponActionCatalog';
import { isHexWeaponActionExecutable } from '../data/hexWeaponActionRegistry';
import type { HexWeaponActionId } from '../types/hexWeaponAction';
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
import {
  advanceCinderlineHazardsAfterEnemyPhase,
  formatAshJacketSalvoPreview,
  formatBlacksiteTriagePreview,
  formatCinderlinePreview,
  resolveCinderlineSlotForUnit,
  resolveCinderlineTickForUnit,
} from '../data/hexShotPhaseH3bEngine';
import CombatTelemetryGaugeRow from './combat/CombatHorizontalGauge';
import type { ApparitionViewportRef } from './combat/ApparitionViewport';
import type { CombatPlayerViewportRef } from './combat/CombatPlayerViewport';
import type { CombatOperativeTelemetry } from './combat/CombatOperativeHud';
import CombatCommandDeck from './CombatCommandDeck';
import CombatHostileTurnPanel from './combat/CombatHostileTurnPanel';
import CounterfateHudStrip from './combat/CounterfateHudStrip';
import RitualCadenceHudStrip from './combat/RitualCadenceHudStrip';
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
import { createNineStrainCombatBridge } from '../data/nineStrain/combatBridge';
import { hostileSnapshotInput } from '../data/nineStrain/hostileField';
import { normalizeWeaponFamilyId } from '../data/weaponFamilyIdNormalize';
import { tryNormalizeRunItemId } from '../data/runItemIdAliases';
import { hasSupplyInstance } from '../data/cargoSupplyEngine';
import { getRunItemDefinition } from '../data/runItemRegistry';
import { resolveSupplyCombatTranslation } from '../data/cargoSupplyCombatSafetyEngine';
import { resolveHollowPointCritChanceBonus } from '../data/expeditionRequisitionRuntimeEngine';
import type { RequisitionEncounterDescriptor } from '../types/expeditionRequisition';

const TELEMETRY_DIVIDER = 'rgba(139, 92, 246, 0.2)';

const FRACTURE_HOUND_DOUBLE_STRIKE_CHANCE = 0.35;

const DEFEND_ABILITIES: AegisAbilityId[] = ['ASHEN_MANTLE', 'RUNEBOUND_CARAPACE'];
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
  /** ABYSSAL VERDICT ready/targeting HUD snapshot for CombatScreen chrome. */
  onAbyssalVerdictUiChange?: (ui: import('../data/abyssalVerdictReadyUi').AbyssalVerdictHudSnapshot | null) => void;
  /** Registers prime / cancel handlers for the Abyssal Verdict module. */
  registerAbyssalVerdictHandlers?: (handlers: {
    prime: () => void;
    cancel: () => void;
  } | null) => void;
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
  aegisLoadout?: AegisTechniqueLoadout;
  hexShotLoadout?: HexShotLoadout;
  envoyLoadout?: EnvoyLoadout;
  leyLineMutations?: LeyLineMutationId[];
  hexShotBoons?: HexShotBoonId[];
  envoyBoons?: EnvoyBoonId[];
  combatDistrict?: 1 | 2 | 3;
  /** Veil Front / employer first-turn-only AP bonuses (not Adrenaline Primer). */
  firstTurnBonusAp?: number;
  /** @deprecated Requisition runtime now owns Adrenaline Primer. */
  /** VOID'S TOLL and other incursion-wide AP ceiling bonuses. */
  incursionApBonus?: number;
  /** Fired when VOID'S TOLL triggers on an ultimate kill. */
  onVoidsTollTriggered?: () => void;
  /** Employer sponsor package — flat kinetic armor layers on operative. */
  playerKineticArmorBonus?: number;
  /** @deprecated Requisition runtime now owns Kinetic Battery. */
  /** Narrative bonus boons claimed for this combat encounter. */
  narrativeCombatBoons?: import('../types/narrativeBonusReward').PendingNarrativeCombatBoons;
  /** Active weapon family locked at run start. */
  activeWeaponFamilyId?: WeaponFamilyId | null;
  /** Dev combat sandbox — start with class ultimate meter charged for every weapon. */
  primeUltimateAtStart?: boolean;
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
  /** Encounter-scoped override that disables ultimate abilities. */
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
  onAbyssalVerdictUiChange,
  registerAbyssalVerdictHandlers,
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
  aegisLoadout = DEFAULT_AEGIS_TECHNIQUE_LOADOUT,
  hexShotLoadout = DEFAULT_HEX_SHOT_LOADOUT,
  envoyLoadout = DEFAULT_ENVOY_LOADOUT,
  leyLineMutations = [],
  hexShotBoons = [],
  envoyBoons = [],
  combatDistrict = 1,
  firstTurnBonusAp = 0,
  incursionApBonus = 0,
  onVoidsTollTriggered,
  playerKineticArmorBonus = 0,
  narrativeCombatBoons,
  activeWeaponFamilyId = null,
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
  operativeClass = 'AEGIS',
  cargoHealReceivedMultiplier = 1,
  encounterModifier = null,
}: TacticalCombatHubProps): React.JSX.Element {
  const {
    notifyRunItemPlayerTurnStart,
    notifyRunItemCombatStart,
    activeIncursion,
    peekActiveIncursion,
    persistNineStrainRuntime,
    beginRequisitionCombatEncounter,
    resolveRequisitionFirstTurnAp,
    resolveRequisitionDirectHostileDamage,
    resolveRequisitionKineticBatteryAction,
    resolveRequisitionHostileEffect,
  } = useRun();
  const activeIncursionRefLocal = useRef(activeIncursion);
  activeIncursionRefLocal.current = activeIncursion;
  const nineStrainBridgeRef = useRef(createNineStrainCombatBridge({
    initialState: activeIncursion.nineStrainRuntime,
  }));
  const [counterfateHudNonce, setCounterfateHudNonce] = useState(0);
  const runItemCombatFlagsRef = useRef({
    bloodwireActive: false,
    bloodwireSpent: false,
    nullSpaceActive: false,
    voidglassDecoyActive: false,
    delayedCylinderTargetId: null as string | null,
    delayedCylinderDamage: 0,
    staminaLossNextTurn: 0,
    healingReceivedPenaltyPct: 0,
    razorwireRootedUnits: new Map<string, {
      evadeChance: number;
      evadeActive: boolean;
      evadeTurnsRemaining: number;
    }>(),
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
      ? buildResolvedWeaponForRun(activeWeaponFamilyId)
      : null),
    [activeWeaponFamilyId],
  );
  const weaponRuntimeRef = useRef(createDefaultWeaponRuntime());
  const aegisWeaponCombatRef = useRef(createDefaultAegisWeaponCombatState());
  const aegisControlPipelineRef = useRef<AegisControlPipelineSession>(
    createAegisControlPipelineSession(),
  );
  const dualTargetIdsRef = useRef<[string | null, string | null]>([null, null]);
  const dualTargetPickStepRef = useRef(0);
  const [dualTargetIds, setDualTargetIds] = useState<[string | null, string | null]>([null, null]);
  const [dualTargetPickStep, setDualTargetPickStep] = useState(0);
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
  const aegisUltimateStrikePower = strikeStats.aegisUltimateStrikePower
    ?? strikeStats.strikeDamage;
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
  /** Phase D.2 — mirror of hit-absorb protection for operative HUD/status strip. */
  const [hitAbsorbProtectionUi, setHitAbsorbProtectionUi] = useState<{
    label: string;
    hits: number;
  } | null>(null);
  const [initiativeProcSeq, setInitiativeProcSeq] = useState(0);
  const [apRollupDisplay, setApRollupDisplay] = useState<number | null>(null);
  const [shadowstepProcActive, setShadowstepProcActive] = useState(false);
  const [enemyActionStage, setEnemyActionStage] = useState<EnemyActionStage>(null);
  const enemyActionStageRef = useRef<EnemyActionStage>(null);
  const [eviscerateTargetUnitId, setEviscerateTargetUnitId] = useState<string | null>(null);
  /** Primed Abyssal Verdict — waiting for enemy click. Does not consume Reserve. */
  const [abyssalVerdictPrimed, setAbyssalVerdictPrimed] = useState(false);
  const abyssalVerdictPrimedRef = useRef(false);
  /** Grade resolved by slice / simplified input — carried through FULL targeting confirm. */
  const [abyssalStagedCommit, setAbyssalStagedCommit] = useState<AbyssalVerdictStagedCommit | null>(null);
  const abyssalStagedCommitRef = useRef<AbyssalVerdictStagedCommit | null>(null);
  /** One aftermath finalization per successful AV commit (lethal and nonlethal). */
  const abyssalAftermathFinalizedRef = useRef(false);
  const triggerAbyssalVerdictSliceRef = useRef<() => void>(() => undefined);
  const abyssalReadyLatchedRef = useRef(false);
  const [abyssalReadyNotifySeq, setAbyssalReadyNotifySeq] = useState(0);
  const [abyssalCollapsingUnitId, setAbyssalCollapsingUnitId] = useState<string | null>(null);
  const abyssalCollapsingUnitIdRef = useRef<string | null>(null);
  const abyssalCommitLockRef = useRef(false);
  const commitAbyssalVerdictOnTargetRef = useRef<((unitId: string) => void) | null>(null);
  const primeAbyssalVerdictRef = useRef<() => void>(() => undefined);
  const publishSquadUiRef = useRef<(squad: EnemyCombatProfile[]) => void>(() => undefined);
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
  /** Presentation mirror of riftWardReadyRef for the pinned CLASS MECHANIC control. */
  const [riftWardReadyUi, setRiftWardReadyUi] = useState(false);

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
  const counterRef = useRef(false);
  const pendingDmgRef = useRef(0);
  const pendingUnblockRef = useRef(false);
  /** HP already applied when the red deck strike overlay appeared. */
  const preAppliedHpStrikeRef = useRef(0);
  const enemyStunPendingRef = useRef(false);
  const hitFlashSeqRef = useRef<Record<string, number>>({});
  /** Blood-burst pulse count latched with the latest hitFlash (Hex Cinder Sweep = 3). */
  const bloodBurstRepeatsRef = useRef<Record<string, number>>({});
  /** Blood mist size latched with the latest hitFlash (Nullbreach / Unmaker = 1.5). */
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
  /**
   * Weapon-bus hits: stash hitFlash / damage float / CRITICAL until presentation CONTACT
   * so numbers land with impact_spark (not at resolve time).
   */
  const pendingWeaponHitRevealRef = useRef<Record<string, {
    damage: number;
    critical: boolean;
    critChannel?: 'KINETIC' | 'OCCULT' | 'TRUE';
    bloodBurstRepeats: number;
    bloodMistScale: number;
    fallbackTimer: ReturnType<typeof setTimeout> | null;
  }>>({});
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
  /**
   * Enemy HP damage number for every class/weapon.
   * Call on the same beat as hitFlash / blood / contact / IMPACT VFX.
   */
  const publishEnemyDamageFloat = (unitId: string, amount: number) => {
    if (!(amount > 0) || !unitId) return;
    const dmgLabel = String(Math.max(0, Math.round(amount)));
    damageFloatSeqRef.current[unitId] = (damageFloatSeqRef.current[unitId] ?? 0) + 1;
    damageFloatLabelsRef.current[unitId] = dmgLabel;
    setTimeout(() => {
      if (damageFloatLabelsRef.current[unitId] === dmgLabel) {
        delete damageFloatLabelsRef.current[unitId];
      }
    }, 900);
  };

  const flushWeaponHitReveal = (unitId: string) => {
    const pending = pendingWeaponHitRevealRef.current[unitId];
    if (!pending) return;
    delete pendingWeaponHitRevealRef.current[unitId];
    if (pending.fallbackTimer) {
      clearTimeout(pending.fallbackTimer);
      pending.fallbackTimer = null;
    }
    hitFlashSeqRef.current[unitId] = (hitFlashSeqRef.current[unitId] ?? 0) + 1;
    bloodBurstRepeatsRef.current[unitId] = pending.bloodBurstRepeats;
    bloodMistScaleRef.current[unitId] = pending.bloodMistScale;
    if (pending.damage > 0) {
      publishEnemyDamageFloat(unitId, pending.damage);
    }
    if (pending.critical && pending.damage > 0) {
      const prev = critImpactSeqRef.current[unitId]?.seq ?? 0;
      critImpactSeqRef.current[unitId] = {
        seq: prev + 1,
        channel: pending.critChannel ?? 'KINETIC',
      };
      onPlayerCritImpact?.({
        unitId,
        channel: pending.critChannel ?? 'KINETIC',
      });
    }
    Vibration.vibrate(18);
    publishSquadUi(squadRef.current);
  };
  const skipTurnUnitIdsRef = useRef<Set<string>>(new Set());
  const [centerSkipFloatSeq, setCenterSkipFloatSeq] = useState(0);
  const backlineDashSeqRef = useRef<Record<string, number>>({});
  const backlineDashActiveRef = useRef<Record<string, boolean>>({});
  const retributionParryRef = useRef<{ unitId: string; occultDamage: number } | null>(null);
  const pendingDissolveRef = useRef<{ unitId: string; profile: EnemyCombatProfile; hp: number } | null>(null);
  const dissolveSeqRef = useRef<Record<string, number>>({});
  const dissolvedHiddenRef = useRef<Set<string>>(new Set());
  const requisitionBatteryConsumedEncounterIdsRef = useRef<Set<string>>(new Set());
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
  const runeboundCarapaceRef = useRef<RuneboundCarapaceState>(createRuneboundCarapaceState());
  /** Crimson Pact: at most one charge consumed per authored action id. */
  const crimsonPactConsumedActionRef = useRef<string | null>(null);
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
  const syncHitAbsorbProtectionUi = (encounter = mutationEncounterRef.current) => {
    const state = readHitAbsorbProtectionFromBoonEncounter(encounter);
    if (state.hitsRemaining <= 0) {
      setHitAbsorbProtectionUi(null);
      return;
    }
    setHitAbsorbProtectionUi({
      label: hitAbsorbProtectionDisplayName(state.source),
      hits: state.hitsRemaining,
    });
  };
  const armHitAbsorbOnEncounter = (
    source: HitAbsorbProtectionSource,
    charges: number,
  ) => {
    const current = readHitAbsorbProtectionFromBoonEncounter(mutationEncounterRef.current);
    const { next, applied } = armHitAbsorbProtection(current, source, charges);
    writeHitAbsorbProtectionToBoonEncounter(mutationEncounterRef.current, next);
    syncHitAbsorbProtectionUi();
    return { next, applied };
  };
  const activeGraftPlanRef = useRef<GraftCastPlan | null>(null);
  const activeGraftReserveSpentRef = useRef(0);
  const activeGraftApCostRef = useRef(0);
  /** Doomfall Charge snapshots the graft plan; Release reuses it without recommit. */
  const doomfallGraftPlanRef = useRef<GraftCastPlan | null>(null);
  /** Unmaker T3 — once-per-authored-action Fracture-break Reserve grant key. */
  const unmakerT3FractureBreakGrantedActionRef = useRef<string | null>(null);
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
  const syncNineStrainPlayerTurn = () => {
    const jammed = hasStructuredDebuff(sessionExtrasRef.current, 'SENSORY_JAMMED');
    const living = squadRef.current.filter((unit) => isUnitAlive(unit) && unit.unitId);
    nineStrainBridgeRef.current.syncHostileIntents(
      living.map((unit, index) => hostileSnapshotInput({
        unitId: unit.unitId as string,
        intentKind: String(unit.intent),
        countdown: estimateTurnsRemaining(unit.intent, unit),
        hostileTurnOrder: index,
        slot: unit.gridSlot,
        concealed: jammed,
        hp: unit.currentHp,
        maxHp: unit.maxHp,
        severity: jammed ? 'MODERATE' : getIntentSeverity(unit.intent),
        protectedPhase: unit.isBoss === true,
        designation: unit.designation,
      })),
      jammed,
    );
    nineStrainBridgeRef.current.runPlayerTurnStart();
    const presentation = nineStrainBridgeRef.current.presentation();
    if (presentation.lastRelease && presentation.lastRelease.packet > 0) {
      log(`>> COUNTERFATE RELEASE // ${Math.round(presentation.lastRelease.multiplier * 100)}% // ${presentation.lastRelease.packet}`);
    }
    setCounterfateHudNonce((value) => value + 1);
  };
  const parryTimingWindowBonus = parryWindowBonus * 0.02;
  const parryTimingBlindPenalty = env.isPlayerBlinded ? 0.015 : 0;
  const counterReady = operativeClass === 'AEGIS' && voidWardPrimed;
  const sliceReady = operativeClass === 'AEGIS'
    && abyssalReserve >= COMBAT_ACTION.ABYSSAL_RESERVE_CAP
    && !isExhausted
    && canFireLegacyClassUltimate('EVISCERATE', activeWeaponFamilyId);

  useEffect(() => {
    abyssalVerdictPrimedRef.current = abyssalVerdictPrimed;
  }, [abyssalVerdictPrimed]);

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
  const consoleUltimateReady = sliceReady
    || zeroProtocolReady
    || cataclysmReady
    || stagedUltimateReady;
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

  useEffect(() => {
    if (shouldFireAbyssalVerdictReadyNotification(abyssalReadyLatchedRef.current, consoleUltimateReady)) {
      setAbyssalReadyNotifySeq((n) => n + 1);
    }
    abyssalReadyLatchedRef.current = consoleUltimateReady;
    if (!sliceReady) {
      setAbyssalVerdictPrimed(false);
      abyssalVerdictPrimedRef.current = false;
      abyssalStagedCommitRef.current = null;
      setAbyssalStagedCommit(null);
      setAbyssalCollapsingUnitId(null);
      abyssalCommitLockRef.current = false;
    }
  }, [consoleUltimateReady, sliceReady]);
  const aegisCombatSurface = useMemo(() => {
    if (operativeClass !== 'AEGIS') return null;
    return buildAegisCombatSurface({
      weaponFamilyId: activeWeaponFamilyId,
      techniques: aegisLoadout,
    });
  }, [operativeClass, activeWeaponFamilyId, aegisLoadout]);
  const hexCombatSurface = useMemo(() => {
    if (operativeClass !== 'HEX_SHOT') return null;
    return buildHexCombatSurface({
      weaponFamilyId: activeWeaponFamilyId,
      flex: sanitizeHexFlexLoadout(hexShotLoadout),
    });
  }, [operativeClass, activeWeaponFamilyId, hexShotLoadout]);
  const envoyCombatSurface = useMemo(() => {
    if (operativeClass !== 'ENVOY') return null;
    return buildEnvoyCombatSurface({
      weaponFamilyId: activeWeaponFamilyId,
      flex: sanitizeEnvoyFlexLoadout(envoyLoadout),
    });
  }, [operativeClass, activeWeaponFamilyId, envoyLoadout]);
  const activeLoadout = useMemo((): readonly string[] => {
    if (operativeClass === 'HEX_SHOT') {
      return hexCombatSurface?.hudCards ?? buildHexCombatSurface({
        weaponFamilyId: activeWeaponFamilyId,
        flex: sanitizeHexFlexLoadout(hexShotLoadout),
      }).hudCards;
    }
    if (operativeClass === 'ENVOY') {
      return envoyCombatSurface?.hudCards ?? buildEnvoyCombatSurface({
        weaponFamilyId: activeWeaponFamilyId,
        flex: sanitizeEnvoyFlexLoadout(envoyLoadout),
      }).hudCards;
    }
    return aegisCombatSurface?.hudCards ?? buildAegisCombatSurface({
      weaponFamilyId: activeWeaponFamilyId,
      techniques: aegisLoadout,
    }).hudCards;
  }, [
    operativeClass,
    hexShotLoadout,
    envoyLoadout,
    aegisCombatSurface,
    hexCombatSurface,
    envoyCombatSurface,
    activeWeaponFamilyId,
    aegisLoadout,
  ]);
  const aegisTargetOpts = () => ({
    doomfallReleaseAvailable: aegisWeaponCombatRef.current.doomfallReleaseAvailable,
  });
  const clearAegisDualTargets = () => {
    dualTargetIdsRef.current = [null, null];
    dualTargetPickStepRef.current = 0;
    setDualTargetIds([null, null]);
    setDualTargetPickStep(0);
  };
  const scrubAegisCombatCommandAfterDoomfallInterrupt = () => {
    const scrubbed = scrubAegisStagedCombatCommand({
      selectedAbility: selectedAbilityRef.current,
      dualTargetIds: dualTargetIdsRef.current,
      dualPickStep: dualTargetPickStepRef.current,
      selectedTargetId: selectedTargetIdRef.current,
    });
    selectedAbilityRef.current = scrubbed.selectedAbility;
    setSelectedAbility(scrubbed.selectedAbility);
    clearAegisDualTargets();
    if (scrubbed.selectedTargetId == null) {
      selectedTargetIdRef.current = null;
      setSelectedTargetId(null);
    }
    publishSquadUiRef.current?.(squadRef.current);
  };
  const applyAegisHubControl = (
    reason: AegisControlInterruptReason,
    authoredActionId?: string | null,
    opts?: { applyDebuff?: boolean },
  ) => {
    if (operativeClass !== 'AEGIS') return;
    const result = hubApplyAegisPlayerControl({
      weaponState: aegisWeaponCombatRef.current,
      extras: sessionExtrasRef.current,
      pipelineSession: aegisControlPipelineRef.current,
      reason,
      authoredActionId,
      currentBrands: classCombatRef.current.runicBrands,
      applyDebuff: opts?.applyDebuff,
    });
    aegisWeaponCombatRef.current = result.weaponState;
    aegisControlPipelineRef.current = result.pipelineSession;
    syncAegisTempoPresentation(result.weaponState);
    if (result.brandGain > 0) imprintRunicBrand(result.brandGain);
    result.logs.forEach((line) => log(line));
    if (result.clearStagedCombatCommand) {
      scrubAegisCombatCommandAfterDoomfallInterrupt();
    }
  };
  const syncAegisTempoPresentation = (ws: AegisWeaponCombatState) => {
    if (ws.tempoArmed && !weaponRuntimeRef.current.riftEdgeTempoArmed) {
      weaponRuntimeRef.current = armRiftEdgeTempo(weaponRuntimeRef.current);
    } else if (!ws.tempoArmed && weaponRuntimeRef.current.riftEdgeTempoArmed) {
      weaponRuntimeRef.current = consumeRiftEdgeTempo(weaponRuntimeRef.current);
    }
  };
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
    nineStrainBridgeRef.current.markCommitted();
    nineStrainBridgeRef.current.noteCurrent({
      classId: 'HEX_SHOT',
      ammoSpent: true,
      magazineEmptyOrFull: currentAmmoRef.current === 0,
    });
    return true;
  };

  const emptyMagazine = () => {
    setMagazineAmmo(0);
  };

  useEffect(() => {
    hexShotStateRef.current = hexShotState;
  }, [hexShotState]);

  useEffect(() => {
    registerCombatPresentationContactRevealListener((reveal) => {
      flushWeaponHitReveal(reveal.targetId);
    });
    return () => {
      registerCombatPresentationContactRevealListener(null);
      Object.values(pendingWeaponHitRevealRef.current).forEach((pending) => {
        if (pending.fallbackTimer) clearTimeout(pending.fallbackTimer);
      });
      pendingWeaponHitRevealRef.current = {};
    };
  // flushWeaponHitReveal closes over stable refs / callbacks.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        // Same beat as contact VFX / hit flash — Armor/Ward still show HP damage.
        const riposteBonus = Math.max(0, pending.riposteBonusKinetic ?? 0);
        const baseShown = riposteBonus > 0
          ? Math.max(0, result.damage - riposteBonus)
          : result.damage;
        publishEnemyDamageFloat(pending.unitId, baseShown > 0 ? baseShown : result.damage);
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
        publishEnemyDamageFloat(primaryId, pending.damage);
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
    if (delta !== 0) {
      nineStrainBridgeRef.current.noteCurrent({
        classId: 'ENVOY',
        ordinaryGain: delta > 0,
        ordinarySpend: delta < 0,
        brinkEntered: !prev.isVoidSiphoned && next.veilFlux > 0 && next.veilFlux <= 25 && prev.veilFlux > 25,
      });
    }
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
      && classAbilityTargetMode(operativeClass, staged, operativeClass === 'AEGIS' ? aegisTargetOpts() : undefined) === 'ALL'
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
    const staged = selectedAbilityRef.current;
    const aegisOpts = operativeClass === 'AEGIS' ? aegisTargetOpts() : undefined;
    const targetMode = staged
      ? classAbilityTargetMode(operativeClass, staged, aegisOpts)
      : 'NONE';
    const playerSelecting = canPlayerCommand();
    const fractureBreachActive = fractureBreakUnitIdRef.current != null;
    const abyssalTargeting = abyssalVerdictPrimedRef.current === true
      && playerSelecting
      && !fractureBreachActive;
    const abilityTargeting = staged != null
      && !abyssalTargeting
      && (
        targetMode === 'SINGLE'
        || targetMode === 'ALL'
        || targetMode === 'DUAL'
        || targetMode === 'ROW'
        || targetMode === 'ONE_OR_TWO'
        || targetMode === 'COLUMN'
      );
    const targetingActive = playerSelecting || abilityTargeting || fractureBreachActive || abyssalTargeting;
    const validTargets = staged && abilityTargeting
      ? (
        operativeClass === 'AEGIS'
          ? validTargetsForAbility(nextSquad, staged, aegisOpts)
          : validTargetsForClassAbility(operativeClass, nextSquad, staged)
      )
      : [];
    const validIds = new Set(validTargets.map((u) => u.unitId));
    const rowPreviewIds = targetMode === 'ROW' && selectedTargetIdRef.current
      ? new Set(previewDreadHorizonUnitIds(nextSquad, selectedTargetIdRef.current))
      : null;
    const columnPreviewIds = targetMode === 'COLUMN' && selectedTargetIdRef.current
      ? new Set(previewFatalFunnelUnitIds(nextSquad, selectedTargetIdRef.current))
      : null;
    const inputMode = resolveWeaponUltimateInputMode({
      simplifiedUltimateInputs: simplifiedUltimateInputs === true,
    });
    const simplified = shouldSkipUltimateMinigame(inputMode);
    onSquadUiChange({
      squadSize: aliveUnits(nextSquad).length,
      targetingActive,
      abilityTargetingActive: abilityTargeting || abyssalTargeting,
      abyssalVerdictTargetingActive: abyssalTargeting,
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
        const abyssalEligible = abyssalTargeting && isAbyssalVerdictEnemyEligible({
          alive,
          dissolveHidden: dissolvedHiddenRef.current.has(unitId),
        });
        const targetable = fractureBreachActive
          ? (alive && isFractureBreachTarget)
          : abyssalTargeting
            ? abyssalEligible
            : targetingActive && alive && (
              !staged || !abilityTargeting || validIds.has(u.unitId!) || hookValid
            );
        const blocked = staged != null && abilityTargeting && targetMode === 'SINGLE'
          && isUnitBlockedForClassAbility(operativeClass, nextSquad, staged, unitId)
          && !hookValid;
        const stagedAv = abyssalStagedCommitRef.current;
        const abyssalPreview = abyssalEligible && stagedAv
          ? previewAbyssalVerdictDamage({
            currentHp: u.currentHp,
            kineticArmor: u.kineticArmor,
            grade: stagedAv.grade,
            sliceDamagePenalty,
          })
          : abyssalEligible
            ? previewAbyssalVerdictDamage({
              currentHp: u.currentHp,
              kineticArmor: u.kineticArmor,
              simplifiedInputs: simplified,
              sliceDamagePenalty,
            })
            : null;
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
          enemyClass: u.class,
          rosterId: u.rosterId,
          isDead: !isUnitAlive(u),
          isSelected: targetMode === 'ALL'
            ? false
            : targetMode === 'DUAL' || targetMode === 'ONE_OR_TWO'
              ? dualTargetIdsRef.current[0] === u.unitId
                || dualTargetIdsRef.current[1] === u.unitId
              : targetMode === 'COLUMN'
                ? (u.unitId != null && columnPreviewIds?.has(u.unitId) === true)
                : (u.unitId != null && rowPreviewIds?.has(u.unitId) === true)
                || selectedTargetIdRef.current === u.unitId
                // While an ability is armed, focus alone must not look selected —
                // the player chooses targets after committing the action.
                || (selectedAbilityRef.current == null
                  && focusedUnitIdRef.current === u.unitId),
          dualAllocationIndex: (targetMode === 'DUAL' || targetMode === 'ONE_OR_TWO')
            ? (dualTargetIdsRef.current[0] === u.unitId
              ? 1
              : dualTargetIdsRef.current[1] === u.unitId
                ? 2
                : null)
            : null,
          firingSolutionActive: operativeClass === 'HEX_SHOT'
            && u.unitId != null
            && classCombatRef.current.firingSolutionUnitId === u.unitId,
          carbineSuppressedActive: operativeClass === 'HEX_SHOT'
            && u.unitId != null
            && classCombatRef.current.carbineSuppressedUnitId === u.unitId,
          isTargetable: targetable,
          fateboundMark: nineStrainBridgeRef.current.presentation().fateboundUnitId === unitId,
          fateboundObscured: nineStrainBridgeRef.current.presentation().concealed,
          isAoeAffected: targetMode === 'ALL' && targetable,
          abyssalVerdictTargetable: abyssalEligible === true,
          abyssalVerdictDimmed: abyssalTargeting && !abyssalEligible,
          abyssalVerdictPreview: abyssalPreview
            ? {
              damage: abyssalPreview.damage,
              remainingHp: abyssalPreview.remainingHp,
              remainingArmor: abyssalPreview.remainingArmor,
              lethal: abyssalPreview.lethal,
            }
            : null,
          abyssalVerdictCollapsing: abyssalCollapsingUnitIdRef.current === unitId,
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
  publishSquadUiRef.current = publishSquadUi;

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

    // ABYSSAL VERDICT targeting — full enemy region commits; no Reserve until cinematic path.
    if (abyssalVerdictPrimedRef.current) {
      commitAbyssalVerdictOnTargetRef.current?.(unitId);
      return;
    }

    const staged = selectedAbilityRef.current;
    const aegisOpts = operativeClass === 'AEGIS' ? aegisTargetOpts() : undefined;
    const targetMode = staged
      ? classAbilityTargetMode(operativeClass, staged, aegisOpts)
      : 'NONE';

    if (staged && (targetMode === 'DUAL' || targetMode === 'ONE_OR_TWO')) {
      if (!canTargetWithClassAbility(operativeClass, squadRef.current, staged, unitId, aegisOpts)) {
        log('[TARGET] >> Select a valid hostile for this blade.');
        publishSquadUi(squadRef.current);
        return;
      }
      const step = dualTargetPickStepRef.current;
      const nextDual: [string | null, string | null] = [...dualTargetIdsRef.current];
      nextDual[step] = unitId;
      dualTargetIdsRef.current = nextDual;
      setDualTargetIds(nextDual);
      focusedUnitIdRef.current = unitId;
      enemyRef.current = unit;
      setEnemy(unit);
      selectedTargetIdRef.current = nextDual[0];
      setSelectedTargetId(nextDual[0]);
      if (step === 0) {
        dualTargetPickStepRef.current = 1;
        setDualTargetPickStep(1);
        publishSquadUi(squadRef.current);
        // Contact Front: first pick arms 4+0 confirm — do not auto-cast.
        if (targetMode === 'ONE_OR_TWO') return;
        return;
      }
      // Divergence (paired blades) may commit both blades to the same hostile.
      // Contact Front 2+2 still requires two distinct targets.
      if (nextDual[0] === nextDual[1] && (targetMode === 'ONE_OR_TWO' || staged !== 'DIVERGENCE')) {
        log(targetMode === 'ONE_OR_TWO'
          ? '[TARGET] >> Contact Front 2+2 requires two distinct targets.'
          : '[TARGET] >> Select two targets for this dual cast.');
        publishSquadUi(squadRef.current);
        return;
      }
      // Second pick — auto-execute (DUAL / Contact Front 2+2).
      executeOperativeAbilityRef.current(staged);
      selectedAbilityRef.current = null;
      setSelectedAbility(null);
      clearAegisDualTargets();
      publishSquadUi(squadRef.current);
      return;
    }

    if (staged && targetMode === 'ROW') {
      if (!canTargetWithClassAbility(operativeClass, squadRef.current, staged, unitId, aegisOpts)) {
        log('[TARGET] >> Select a valid row anchor on the grid.');
        publishSquadUi(squadRef.current);
        return;
      }
      selectedTargetIdRef.current = unitId;
      setSelectedTargetId(unitId);
      focusedUnitIdRef.current = unitId;
      enemyRef.current = unit;
      setEnemy(unit);
      publishSquadUi(squadRef.current);
      return;
    }

    if (staged && targetMode === 'COLUMN') {
      if (!canTargetWithClassAbility(operativeClass, squadRef.current, staged, unitId, aegisOpts)) {
        log('[TARGET] >> Select a valid column lane on the grid.');
        publishSquadUi(squadRef.current);
        return;
      }
      if (!resolveFatalFunnelLane(squadRef.current, unitId)) {
        log('[TARGET] >> Empty or invalid lane.');
        publishSquadUi(squadRef.current);
        return;
      }
      selectedTargetIdRef.current = unitId;
      setSelectedTargetId(unitId);
      focusedUnitIdRef.current = unitId;
      enemyRef.current = unit;
      setEnemy(unit);
      publishSquadUi(squadRef.current);
      return;
    }

    if (staged && targetMode === 'SINGLE') {
      if (!canTargetWithClassAbility(operativeClass, squadRef.current, staged, unitId, aegisOpts)) {
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
    const aegisOpts = operativeClass === 'AEGIS' ? aegisTargetOpts() : undefined;
    const targetMode = staged
      ? classAbilityTargetMode(operativeClass, staged, aegisOpts)
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
      nineStrainBridgeRef.current.noteCurrent({
        classId: 'AEGIS',
        ordinaryGain: true,
        reserveEntered50: abyssalRef.current < 50 && (abyssalRef.current + scaled) >= 50,
      });
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

  const resolveRuneboundCarapaceAfterEnemyAction = () => {
    const state = runeboundCarapaceRef.current;
    if (!state.armed || !state.pendingReflect) return;
    const attackerId = state.pendingAttackerId;
    const attacker = attackerId ? getUnitById(squadRef.current, attackerId) : null;
    const valid = !!(attacker?.unitId && isUnitAlive(attacker));
    const resolved = resolveCarapaceAfterEnemyAction(state, valid);
    runeboundCarapaceRef.current = resolved.next;
    if (resolved.reflect) {
      hurtEnemy(
        resolved.reflect.trueDamage,
        '[RUNEBOUND CARAPACE]',
        'STRIKE',
        {
          channel: 'TRUE',
          fractureGain: resolved.reflect.fracture,
          abilityId: 'RUNEBOUND_CARAPACE',
          rollCrit: false,
          rollEvade: false,
          targetId: resolved.reflect.attackerId,
          isDirectDamage: false,
          nestedPresentation: true,
        },
      );
      log(
        `>> [RUNEBOUND CARAPACE] — ${resolved.reflect.trueDamage} True + ${resolved.reflect.fracture} Fracture reflected.`,
      );
    } else if (resolved.consumed) {
      log('>> [RUNEBOUND CARAPACE] — carapace spent (attacker invalid).');
    }
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
    if (operativeHpRef.current <= 0 && operativeClass === 'AEGIS') {
      applyAegisHubControl('DEATH', `death-${Date.now()}`, { applyDebuff: false });
    }
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
    persistNineStrainRuntime(nineStrainBridgeRef.current.serialize());
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
  const isObjectiveCriticalSupplyTarget = (unitId: string | undefined): boolean => {
    if (!unitId) return false;
    const session = objectiveSessionRef.current;
    return [session.primary, ...session.secondary].some(
      (objective) =>
        objective?.status === 'ACTIVE' &&
        objective.markedUnitIds.includes(unitId),
    );
  };
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
          const safety = resolveSupplyCombatTranslation('eclipse_flare_ward_break', {
            isBoss: unit.isBoss === true,
            isObjectiveCritical: isObjectiveCriticalSupplyTarget(unit.unitId),
            revealedIntent: true,
          });
          const blindResult = applyFrontlineBlinded(
            squadRef.current,
            sessionExtrasRef.current,
            Math.min(result.frontlineBlindTurns, safety.maxControlTurns),
            { debuffDurationPct: resolvedWeapon?.statModifiers.debuffDurationPct },
          );
          blindResult.logLines.forEach((line) => log(line));
        }
      }
    } else if (result.frontlineBlindTurns && result.frontlineBlindTurns > 0) {
      const protectedTarget = aliveUnits(squadRef.current).find(
        (unit) => unit.isBoss || isObjectiveCriticalSupplyTarget(unit.unitId),
      );
      const safety = resolveSupplyCombatTranslation('veil_ash_grenade', {
        isBoss: protectedTarget?.isBoss === true,
        isObjectiveCritical: protectedTarget
          ? isObjectiveCriticalSupplyTarget(protectedTarget.unitId)
          : false,
        revealedIntent: true,
      });
      const blindResult = applyFrontlineBlinded(
        squadRef.current,
        sessionExtrasRef.current,
        Math.min(result.frontlineBlindTurns, safety.maxControlTurns),
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
        const safety = resolveSupplyCombatTranslation('razorwire_spool', {
          isBoss: unit.isBoss === true,
          isObjectiveCritical: isObjectiveCriticalSupplyTarget(unit.unitId),
          revealedIntent: true,
        });
        patchUnit(unit.unitId, {
          ...addCombatTag(unit, 'ROOTED'),
          evadeChance: 0,
          evadeActive: false,
          evadeTurnsRemaining: Math.min(unit.evadeTurnsRemaining ?? 0, safety.maxControlTurns),
        });
        runItemCombatFlagsRef.current.razorwireRootedUnits.set(unit.unitId, {
          evadeChance: unit.evadeChance ?? 0,
          evadeActive: unit.evadeActive ?? false,
          evadeTurnsRemaining: unit.evadeTurnsRemaining ?? 0,
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
          const safety = resolveSupplyCombatTranslation('black_iron_wedge', {
            isBoss: unit.isBoss === true,
            isObjectiveCritical: isObjectiveCriticalSupplyTarget(unit.unitId),
            revealedIntent: interruptible,
          });
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
            cancelTelegraph: safety.cancelRevealedIntent,
            appliedFracture: true,
          }));
          if (safety.translation === 'FULL') {
            counter.logMessages.forEach((m) => log(`>> BLACK-IRON WEDGE // ${m}`));
          } else {
            log('>> BLACK-IRON WEDGE // Protected intent disrupted; phase preserved.');
          }
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
        && hasSupplyInstance(activeIncursionRefLocal.current.cargo, runItemId);
      const apNeeded = fromRunSlot ? 0 : combatConsumableApCost(itemId);
      if (
        runItemId &&
        getRunItemDefinition(runItemId).useBehavior === 'mirror_salt_echo' &&
        (!lastPlayerAbilityRef.current ||
          lastPlayerAbilityRef.current === 'EVISCERATE' ||
          lastPlayerAbilityRef.current === 'DEVASTATE')
      ) {
        return false;
      }
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

  const shouldPreventHostileEffect = (
    effectId: string,
    eligible: boolean,
    unpreventable = false,
  ): boolean => {
    const encounter = peekActiveIncursion().activeCombatEncounter;
    return encounter
      ? resolveRequisitionHostileEffect(encounter, effectId, eligible, unpreventable)
      : false;
  };

  const applyHostileStructuredDebuff = (
    effectId: string,
    debuff: StructuredPlayerDebuff,
  ): boolean => {
    if (shouldPreventHostileEffect(effectId, true)) return false;
    addStructuredDebuff(sessionExtrasRef.current, debuff);
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
      /** Phase B.1 — Stun/Knockdown attached to this authored enemy action. */
      controlEffects?: readonly AegisControlInterruptReason[];
      authoredEnemyActionId?: string | null;
      environmental?: boolean;
      damageOverTime?: boolean;
      /** Indirect / no-attacker paths — never trigger Hex Elusive. */
      indirectDamage?: boolean;
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
    if (
      operativeClass === 'HEX_SHOT'
      && isHexElusiveEligibleIncoming({
        rawDamage: raw,
        hasAttacker: Boolean(options?.attacker),
        unblockable,
        rollEvade: options?.rollEvade,
        environmental: options?.environmental,
        damageOverTime: options?.damageOverTime,
        indirectDamage: options?.indirectDamage,
      })
      && classCombatRef.current.hexElusiveCharges > 0
    ) {
      const consumed = tryConsumeHexElusive({
        charges: classCombatRef.current.hexElusiveCharges,
      });
      classCombatRef.current.hexElusiveCharges = consumed.next.charges;
      if (consumed.forcedEvade) {
        emitCombatFeedback({ kind: 'PLAYER_EVADE' });
        playerViewportRef?.current?.triggerEvadeAfterimage();
        log('[ELUSIVE] >> Slipshot afterimage — direct attack whiffed.');
        return;
      }
    }
    if (
      operativeClass === 'HEX_SHOT'
      && classCombatRef.current.carbineSuppressedUnitId
      && isHexCarbineSuppressedEligibleIncoming({
        rawDamage: raw,
        attackerUnitId: options?.attacker?.unitId,
        suppressedUnitId: classCombatRef.current.carbineSuppressedUnitId,
        environmental: options?.environmental,
        damageOverTime: options?.damageOverTime,
        indirectDamage: options?.indirectDamage,
      })
    ) {
      const before = raw;
      raw = applyCarbineSuppressedDamage(raw);
      classCombatRef.current.carbineSuppressedAppliedThisAction = true;
      if (raw !== before) {
        log(`[SUPPRESSED] >> Direct attack ×${CARBINE_SUPPRESSED_DAMAGE_MULT.toFixed(2)} (${before} → ${raw}).`);
      }
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
        setRiftWardReadyUi(false);
        runEnvoyRiftWardTriggerBoons(wardBoonCtx);
        return;
      }
      riftWardReadyRef.current = false;
      setRiftWardReadyUi(false);
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
      nineStrainBridgeRef.current.noteInstinct({
        classId: 'ENVOY',
        riftPreventedDamage: raw,
        riftWouldReachHp: raw,
      });
      return;
    }
    if (mutationEncounterRef.current.juggernautShieldHits > 0 && raw > 0) {
      const before = readHitAbsorbProtectionFromBoonEncounter(mutationEncounterRef.current);
      const absorbed = absorbHitAbsorbProtection(before);
      writeHitAbsorbProtectionToBoonEncounter(mutationEncounterRef.current, absorbed.next);
      syncHitAbsorbProtectionUi();
      if (absorbed.absorbed) {
        log(formatHitAbsorbProtectionAbsorbLog(absorbed.source, absorbed.remaining));
      }
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
      const aegisWs = operativeClass === 'AEGIS'
        ? aegisWeaponCombatRef.current
        : null;
      let evadeChance = resolvePlayerEvadeChance({
        shadowStepEvadeActive: chanceState.shadowStepEvadeActive,
        gridGhostEvadeStacks: chanceState.gridGhostEvadeStacks,
        momentumShiftEvadeDisabled: chanceState.momentumShiftEvadeDisabled,
      });
      if (aegisWs?.committed) {
        evadeChance = 0;
      } else if (aegisWs?.eclipseActive) {
        evadeChance = Math.min(1, evadeChance + ECLIPSE_EVADE_BONUS_PCT / 100);
      }
      const evaded = rollEvade(evadeChance);
      const hit = evaded
        ? { evaded: true, critical: false, ignoreDefenses: false, critMultiplier: 1 as const }
        : resolveEnemyAttackHit(
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
        if (operativeClass === 'AEGIS' && aegisWs) {
          let nextWs = aegisWs;
          if (nextWs.eclipseActive) {
            nextWs = armAegisTempo(
              clearEclipse(nextWs),
              Math.max(1, balanceEncounterRef.current.playerTurns),
            );
            imprintRunicBrand(1);
            log('[ECLIPSE] >> Complete Evade — Tempo armed, 1 Brand.');
          } else if (resolvedWeapon?.familyId === 'aegis-paired-blades') {
            weaponRuntimeRef.current = armRiftEdgeTempo(weaponRuntimeRef.current);
            log('[RIFT EDGE] >> Tempo armed — next basic carries Occult rider.');
          }
          aegisWeaponCombatRef.current = nextWs;
          syncAegisTempoPresentation(nextWs);
        } else if (resolvedWeapon?.familyId === 'aegis-paired-blades') {
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
    const hostileControlEffects = operativeClass === 'AEGIS'
      ? (options?.controlEffects ?? []).filter((reason) => {
        const actionId = options?.authoredEnemyActionId
          ?? (options?.attacker?.unitId
            ? `enemy-${options.attacker.unitId}-${options.attacker.intent ?? 'HIT'}`
            : 'enemy-control');
        return !shouldPreventHostileEffect(`${actionId}:${reason}`, true);
      })
      : (options?.controlEffects ?? []);
    if (
      operativeClass === 'AEGIS'
      && (
        dmg > 0
        || hostileControlEffects.length > 0
      )
    ) {
      const inbound = hubResolveAegisInboundPlayerHit({
        weaponState: aegisWeaponCombatRef.current,
        damage: dmg,
        unblockable,
        environmental: options?.environmental,
        damageOverTime: options?.damageOverTime,
        attackerUnitId: options?.attacker?.unitId ?? null,
        controlEffects: hostileControlEffects,
        authoredActionId: options?.authoredEnemyActionId
          ?? (options?.attacker?.unitId
            ? `enemy-${options.attacker.unitId}-${options.attacker.intent ?? 'HIT'}`
            : null),
        pipelineSession: aegisControlPipelineRef.current,
        currentBrands: classCombatRef.current.runicBrands,
      });
      dmg = inbound.damage;
      aegisWeaponCombatRef.current = inbound.weaponState;
      // Control interrupt / death scrub — drop snapshotted Doomfall graft plan.
      if (!inbound.weaponState.committed && !inbound.weaponState.doomfallReleaseAvailable) {
        doomfallGraftPlanRef.current = null;
      }
      aegisControlPipelineRef.current = inbound.pipelineSession;
      syncAegisTempoPresentation(inbound.weaponState);
      if (inbound.brandGain > 0) imprintRunicBrand(inbound.brandGain);
      inbound.logs.forEach((line) => log(line));
      for (const reason of hostileControlEffects) {
        if (reason === 'STUN' || reason === 'KNOCKDOWN') {
          addStructuredDebuff(sessionExtrasRef.current, {
            type: reason,
            turnsRemaining: 1,
          });
          log(`[CONTROL] >> ${reason} applied.`);
        }
      }
      if (inbound.clearStagedCombatCommand) {
        scrubAegisCombatCommandAfterDoomfallInterrupt();
      }
    }
    if (dmg > 0) {
      if (operativeClass === 'AEGIS' && runeboundCarapaceRef.current.armed) {
        runeboundCarapaceRef.current = noteCarapaceInboundHit(runeboundCarapaceRef.current, {
          armed: true,
          hasAttacker: !!options?.attacker?.unitId,
          attackerId: options?.attacker?.unitId ?? null,
          damageApplied: dmg,
          fullyNegated: false,
          unblockable,
          ranged: false,
          environmental: options?.environmental === true,
          damageOverTime: options?.damageOverTime === true,
          selfDamage: !options?.attacker,
          controlOnly: dmg <= 0 && hostileControlEffects.length > 0,
          mitigationBypass: unblockable,
        });
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
      const requisitionEncounter = activeIncursionRefLocal.current.activeCombatEncounter;
      const eligibleDirectHostileDamage = Boolean(
        options?.attacker
        && options.environmental !== true
        && options.damageOverTime !== true
        && options.indirectDamage !== true,
      );
      if (requisitionEncounter && eligibleDirectHostileDamage) {
        dmg = resolveRequisitionDirectHostileDamage(
          requisitionEncounter,
          dmg,
          true,
        );
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
      const mirrorPct = classCombatRef.current.soulTetherReflectPercent ?? 50;
      const mirror = Math.floor(dmg * (mirrorPct / 100));
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
      /**
       * Phase E.1a — Aegis weapon-action hit damage already includes graft
       * `damageMultiplier` / occult flat from `applyGraftTransformToWeaponPlan`.
       * Hub must not re-apply those. Phase E.1e.1 — Apex boss ×2 is applied at
       * WA delivery before this flag; Neutron reserve-add still resolves once.
       */
      graftDamagePreScaled?: boolean;
      /**
       * H.2a — Hex fixed-basic packets already include family ballisticDamagePct
       * from resolveHexBasicShot. Skip re-applying that layer in hurtEnemy.
       */
      weaponFamilyBallisticAlreadyScaled?: boolean;
      /** Burn/bleed/DoT — skip operative attack pose; still flash the damaged unit. */
      indirectDamage?: boolean;
      ignoreDefenses?: boolean;
      /** When false, skip enemy evade rolls (ABYSSAL VERDICT cannot be evaded). */
      rollEvade?: boolean;
      /**
       * Action-scoped accuracy bonus in percentage points (Rupture +15 / Firing Solution +15).
       * Fed into hit resolution — does not mutate enemy Evade.
       */
      accuracyBonusPct?: number;
      /** Optional hit/miss signal for Hex WA / Salvo landed accounting (not kill). */
      reportLanded?: (landed: boolean) => void;
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
    if (
      e
      && options?.indirectDamage !== true
      && options?.isDirectDamage !== false
    ) {
      nineStrainBridgeRef.current.recordNativeHit({
        targetId: e.unitId ?? targetId ?? 'unknown',
        damage: Math.max(0, raw),
      });
    }
    if (!e || !e.unitId) return false;
    const requisitionEncounter = activeIncursionRefLocal.current.activeCombatEncounter;
    const requisitionDirectActionEligible = Boolean(
      raw > 0
      && source
      && source !== 'COUNTER'
      && options?.playerActionId
      && !options?.echoHit
      && !options?.indirectDamage
      && !options?.nestedPresentation
      && options?.isDirectDamage !== false,
    );
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
          isHeavyShot: isHexAmmoHeavyShot({
            abilityId: hexAmmoAbilityId,
            abilityTags: hexAmmoTags,
          }),
          hitIndex: hexAmmoHitIndexRef.current,
          isBackline: working.gridSlot?.startsWith('BL') ?? false,
          isBoss: working.isBoss === true,
          targetId: working.unitId,
          targetHasKineticArmor: (working.kineticArmor ?? 0) > 0,
          targetHasOccultWard: (working.occultWards ?? 0) > 0,
          targetHasVoidMark: isUnitMarked(
            classBoonEncounterRef.current.voidMarkedUnits,
            classBoonEncounterRef.current.voidMarkTurnsRemaining,
            working.unitId,
          ),
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
    /** Occult packet deferred from Wraithglass conversion / flat rider (echoHit path). */
    let pendingHexAmmoOccult = 0;
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
          accuracyBonusPct: options?.accuracyBonusPct,
        },
        {
          abilityId: options?.abilityId,
          target: working,
          additiveCritChanceBonus: resolveHollowPointCritChanceBonus(
            peekActiveIncursion().requisitionRuntime,
            combatDistrict,
            requisitionDirectActionEligible,
          ),
          factionCritBonus: effectiveCritBonus + (
            operativeClass === 'HEX_SHOT'
            && hasHexShotBoon(hexShotBoons, 'DEAD_EYE')
            && currentAmmoRef.current >= maxAmmo
              ? hexShotBoonModsRef.current.ballisticCritBonusFullMag
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
          guaranteedCrits: (
            options?.playerActionId
            && crimsonPactConsumedActionRef.current === options.playerActionId
          )
            ? 0
            : (
              options?.echoHit
              || options?.indirectDamage
              || options?.nestedPresentation
              || options?.isDirectDamage === false
            )
              ? 0
              : combatBuffRef.current.crimsonPactCharges,
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
          options?.reportLanded?.(false);
          return false;
        }
        evadeImpactSeqRef.current[evadeUnitId] = (evadeImpactSeqRef.current[evadeUnitId] ?? 0) + 1;
        publishSquadUi(squadRef.current);
        apparitionRef?.current?.triggerStatEvade();
        log(`${tag} >> [ EVADED ] — ${working.designation} phased through the strike.`);
        // Still swing — evade is a miss outcome, not a cancelled cast.
        if (
          isPlayerTurnRef.current
          && Boolean(options?.abilityId)
          && !options?.indirectDamage
          && !options?.echoHit
          && !options?.nestedPresentation
        ) {
          triggerPlayerAttackPose(working);
        }
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
        options?.reportLanded?.(false);
        return false;
      }
      // Past evade — authored attack landed (damage may still be mitigated to 0).
      options?.reportLanded?.(true);
      if (
        hit.ignoreDefenses
        && combatBuffRef.current.crimsonPactCharges > 0
        && options?.playerActionId
        && crimsonPactConsumedActionRef.current !== options.playerActionId
        && !options?.echoHit
        && !options?.indirectDamage
        && !options?.nestedPresentation
        && options?.isDirectDamage !== false
      ) {
        crimsonPactConsumedActionRef.current = options.playerActionId;
        combatBuffRef.current.crimsonPactCharges -= 1;
        log('[CRIMSON PACT] >> Guaranteed critical charge consumed.');
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
    const fractureGainRaw = options?.fractureGain ?? 0;
    const fractureGain = operativeClass === 'HEX_SHOT'
      ? applyHexAmmoFractureBonus(fractureGainRaw, hexAmmoResult)
      : fractureGainRaw;
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
      const causesFractureBreak = willFractureBreak(working, scaledFractureGain);
      if (causesFractureBreak && operativeClass === 'AEGIS' && resolvedWeapon) {
        const t3Grant = resolveUnmakerTier3FractureBreakReserveGrant({
          weapon: resolvedWeapon,
          causesFractureBreak: true,
          abilityId: options?.abilityId,
          playerActionId: options?.playerActionId,
          echoHit: options?.echoHit === true,
          grantedForPlayerActionId: unmakerT3FractureBreakGrantedActionRef.current,
        });
        if (t3Grant.reserveGain > 0) {
          unmakerT3FractureBreakGrantedActionRef.current = t3Grant.nextGrantedForPlayerActionId;
          chargeAr(t3Grant.reserveGain);
          if (t3Grant.logLine) log(t3Grant.logLine);
        }
      }
      if (causesFractureBreak && !fractureBreakUnitIdRef.current) {
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
      // Phase H.1a — class-wide Chamber +15% retired (duplicate of Perfect Overcharge authority).
      if (classCombatRef.current.chamberBonusReady) {
        classCombatRef.current.chamberBonusReady = false;
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
          0,
          {
            skipFamilyBallisticPct: options?.weaponFamilyBallisticAlreadyScaled === true,
          },
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
      dmg = Math.max(0, Math.floor(dmg * ammoMult));
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
    // H.2a — after reload-grade amps, split Wraithglass conversion + flat Occult rider.
    if (hexAmmoResult && dmg > 0) {
      const split = splitHexAmmoDamageChannels(dmg, hexAmmoResult);
      dmg = split.primaryDamage;
      pendingHexAmmoOccult = split.occultDamage;
    } else if (hexAmmoResult && hexAmmoResult.flatOccultBonus > 0 && dmg <= 0) {
      pendingHexAmmoOccult = hexAmmoResult.flatOccultBonus;
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
          options?.graftDamagePreScaled ? { damageAlreadyScaled: true } : undefined,
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
        const masochist = applyMasochistsJoyAmplification(
          dmg,
          mutationEncounterRef.current.masochistBuff,
        );
        dmg = masochist.damage;
        mutationEncounterRef.current.masochistBuff = masochist.pendingBuff;
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
    let armorPierceLayers: 0 | 1 = 0;
    let wardPierceLayers: 0 | 1 = 0;
    const requisitionRuntime = peekActiveIncursion().requisitionRuntime;
    const batteryPreparation = requisitionRuntime?.combatPreparation;
    const batteryAvailable = batteryPreparation?.kind === 'kinetic_battery'
      && !batteryPreparation.consumedEncounterIds.includes(requisitionEncounter?.encounterId ?? '');
    if (
      requisitionEncounter
      && batteryAvailable
      && requisitionDirectActionEligible
      && dmg > 0
      && !requisitionBatteryConsumedEncounterIdsRef.current.has(requisitionEncounter.encounterId)
      && ((working.kineticArmor ?? 0) > 0 || (working.occultWards ?? 0) > 0)
    ) {
      const pierce = resolveRequisitionKineticBatteryAction(
        requisitionEncounter,
        options!.playerActionId!,
        {
          kineticArmor: working.kineticArmor ?? 0,
          occultWards: working.occultWards ?? 0,
        },
        true,
      );
      armorPierceLayers = pierce.armorPierceLayers;
      wardPierceLayers = pierce.wardPierceLayers;
      if (armorPierceLayers > 0 || wardPierceLayers > 0) {
        requisitionBatteryConsumedEncounterIdsRef.current.add(requisitionEncounter.encounterId);
      }
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
      const hit = resolveHostileHpHit(working, dmg, options.channel, {
        ignoreDefenses,
        armorPierceLayers,
        wardPierceLayers,
      });
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
        const deferCritForWeaponBus = Boolean(
          resolvedWeapon
          && source
          && !options?.echoHit
          && !options?.nestedPresentation
          && !options?.indirectDamage
          && options?.abilityId !== 'RUIN'
          && !options?.deferAbyssalVerdict
          && !deferCritForWarden
          && !isWardenStrikeInputGuarded()
          && !isAbyssalVerdictInputGuarded(),
        );
        if (deferCritForWarden) {
          wardenDeferredCritChannelRef.current = critChannel;
        } else if (deferCritForWeaponBus) {
          // CRITICAL UI flushes with presentation CONTACT (pendingWeaponHitRevealRef).
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
    // --- Hex Shot ammo secondary effects (strip / mark / AP / stasis / interrupt) ---
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
        const turns = Math.max(1, hexAmmoResult.voidMarkTurns);
        classBoonEncounterRef.current.voidMarkTurnsRemaining[ammoTid] = mergeDurationTurns(
          classBoonEncounterRef.current.voidMarkTurnsRemaining[ammoTid],
          turns,
        );
        classBoonEncounterRef.current.voidMarkedUnits[ammoTid] = true;
      }
      if (hexAmmoResult.applyStasisLock && hexAmmoResult.stasisTurns > 0) {
        classBoonEncounterRef.current.stasisLockTurnsRemaining[ammoTid] = mergeDurationTurns(
          classBoonEncounterRef.current.stasisLockTurnsRemaining[ammoTid],
          hexAmmoResult.stasisTurns,
        );
        log(`[AMMO] STASIS-LOCK // ${hexAmmoResult.stasisTurns} turn(s) on ${working.designation}.`);
      }
      if (hexAmmoResult.apReduction > 0) {
        reduceEnemyAp(ammoTid, hexAmmoResult.apReduction);
      }
      if (hexAmmoResult.interruptIntent && enemyIsTelegraphing(working)) {
        const counter = resolveIntentCounterplay({
          intent: working.intent,
          playerActionTags: ['INTERRUPT'],
          sourceCombatant: working,
          incomingDamage: working.baseDamage,
        });
        // Bosses: weaken/delay only — never full telegraph cancel (ammo engine note).
        const cancelTelegraph = working.isBoss !== true;
        recordIntentCountered(intentTelemetryRef.current, working.intent, counter.counterQuality, {
          damagePrevented: counter.reducedDamageAmount,
          appliedFracture: false,
        });
        patchUnit(ammoTid, applyIntentCounterplayToEnemy(working, {
          ...counter,
          cancelTelegraph,
          appliedFracture: false,
        }));
        if (working.isBoss) {
          log('[AMMO] STASIS-LOCK // boss intent weakened.');
        } else {
          log('[AMMO] STASIS-LOCK // telegraph interrupted.');
        }
      }
      recordHexAmmoEffect(hexAmmoCastTrackerRef.current, ammoTid, hexAmmoResult);
      hexAmmoResult.notes.forEach((note) => log(`[AMMO] ${note}`));
    }
    // Wraithglass occult conversion / flat rider — separate OCCULT packet; echoHit skips ammo re-entry.
    if (pendingHexAmmoOccult > 0 && source && working.unitId && !options?.echoHit) {
      hurtEnemy(pendingHexAmmoOccult, `${tag} [WRAITHGLASS OCCULT]`, source, {
        channel: 'OCCULT',
        targetId: working.unitId,
        abilityId: options?.abilityId,
        playerActionId: options?.playerActionId,
        echoHit: true,
        rollCrit: false,
        nestedPresentation: true,
        weaponFamilyBallisticAlreadyScaled: true,
      });
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
      // Pose on the swing even when wards/mitigation zero the packet.
      && (dmg > 0 || Boolean(options?.abilityId) || ultimateAttackPose)
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
      const useWardenStrike = shouldUseWardenStrikePresentation({
        weaponFamilyId: resolvedWeapon?.familyId,
        abilityId: options?.abilityId,
        actionKind: options?.actionKind,
        playerActionKind: options?.playerActionKind,
        nestedPresentation: options?.nestedPresentation,
      }) && !options?.indirectDamage && !options?.echoHit;
      // Follow-up hits (e.g. Veil Edge rider) while presentation is locked.
      const wardenFollowUp = useWardenStrike && isWardenStrikeInputGuarded();
      const willPresentWeaponHit = Boolean(
        resolvedWeapon
        && source
        && !options?.echoHit
        && !options?.nestedPresentation
        && options?.abilityId !== 'RUIN'
        && !options?.deferAbyssalVerdict
        && !useWardenStrike
        && !isWardenStrikeInputGuarded()
        && !isAbyssalVerdictInputGuarded(),
      );
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
        && resolvedWeapon?.familyId === 'hex-carbine'
        && burstTags.includes('RANGED'),
      );
      const pairedBladesBurst = Boolean(
        directWeaponHit
        && resolvedWeapon?.familyId === 'aegis-paired-blades',
      );
      const bloodBurstRepeats = carbineRangedBurst ? 3 : pairedBladesBurst ? 2 : 1;
      const bloodMistScale = (
        resolvedWeapon?.familyId === 'hex-shotgun'
        || resolvedWeapon?.familyId === 'aegis-claymore'
      ) ? 1.5 : 1;
      // Immediate hit FX for DoTs / class abilities. Weapon-bus + Warden + Abyssal
      // defer flash/blood/numbers to their CONTACT / IMPACT beat.
      if (!deferAbyssalHitFx && !willPresentWeaponHit && !(useWardenStrike && !wardenFollowUp)) {
        hitFlashSeqRef.current[e.unitId] = (hitFlashSeqRef.current[e.unitId] ?? 0) + 1;
        bloodBurstRepeatsRef.current[e.unitId] = bloodBurstRepeats;
        bloodMistScaleRef.current[e.unitId] = bloodMistScale;
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
      // Damage numbers with hit VFX. Warden / Abyssal / weapon-bus defer to contact.
      const deferDamageFloat = deferAbyssalHitFx
        || useWardenStrike
        || willPresentWeaponHit
        || (options?.nestedPresentation === true && isWardenStrikeInputGuarded());
      if (!deferDamageFloat) {
        publishEnemyDamageFloat(e.unitId, dmg);
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
      } else if (willPresentWeaponHit && resolvedWeapon) {
        const revealUnitId = e.unitId;
        const prevPending = pendingWeaponHitRevealRef.current[revealUnitId];
        if (prevPending?.fallbackTimer) clearTimeout(prevPending.fallbackTimer);
        const critChannelForReveal = critical
          ? (options?.abilityId === 'VEIL_PIERCER'
            ? 'KINETIC' as const
            : (options?.channel === 'OCCULT' || options?.channel === 'TRUE'
              ? options.channel
              : 'KINETIC' as const))
          : undefined;
        const fallbackTimer = setTimeout(() => {
          flushWeaponHitReveal(revealUnitId);
        }, scalePresentationMs(360));
        pendingWeaponHitRevealRef.current[revealUnitId] = {
          damage: dmg,
          critical: Boolean(critical && dmg > 0),
          critChannel: critical && dmg > 0 ? critChannelForReveal : undefined,
          bloodBurstRepeats,
          bloodMistScale,
          fallbackTimer,
        };
        try {
          unlockCombatPresentationAudio();
          presentResolvedWeaponHit({
            weaponFamilyId: resolvedWeapon.familyId,
            abilityId: options?.abilityId,
            targetId: revealUnitId,
            damage: dmg,
            critical: Boolean(critical && dmg > 0),
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
          // Presentation must never block combat — still reveal FX.
          flushWeaponHitReveal(revealUnitId);
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
    // H.2a — tick ammo status durations (Void-Mark / Stasis-Lock).
    classBoonEncounterRef.current.voidMarkTurnsRemaining = tickDurationMap(
      classBoonEncounterRef.current.voidMarkTurnsRemaining,
    );
    for (const id of Object.keys(classBoonEncounterRef.current.voidMarkedUnits)) {
      if ((classBoonEncounterRef.current.voidMarkTurnsRemaining[id] ?? 0) <= 0) {
        delete classBoonEncounterRef.current.voidMarkedUnits[id];
      }
    }
    classBoonEncounterRef.current.stasisLockTurnsRemaining = tickDurationMap(
      classBoonEncounterRef.current.stasisLockTurnsRemaining,
    );
  };

  const applyEviscerateAftermath = () => {
    const mods = mutationModsRef.current;
    abyssalRef.current = 0;
    setAbyssalReserve(0);
    // Phase C / E.1d.1: Ultimate never clears Runic Brands.
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

  /** Action-level AV finalization — once per successful commit, lethal or not. */
  const finalizeAbyssalVerdictAftermath = () => {
    const livingIds = aliveUnits(squadRef.current)
      .map((u) => u.unitId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
    const plan = planAbyssalVerdictAftermath({
      commitSucceeded: true,
      alreadyFinalized: abyssalAftermathFinalizedRef.current,
      livingEnemyIdsAfterDamage: livingIds,
    });
    if (!plan.shouldFinalize) return;
    abyssalAftermathFinalizedRef.current = true;
    applyEviscerateAftermath();
  };

  const clearAbyssalVerdictStagedGrade = () => {
    abyssalStagedCommitRef.current = null;
    setAbyssalStagedCommit(null);
  };

  const stageAbyssalVerdictGrade = (staged: AbyssalVerdictStagedCommit) => {
    abyssalStagedCommitRef.current = staged;
    setAbyssalStagedCommit(staged);
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
    nineStrainBridgeRef.current.markCommitted({
      actualCostsPaid: { ap: cost },
    });
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
      const prevented = shouldPreventHostileEffect(
        `enemy-${attacker.unitId ?? 'x'}-${attacker.intent}:BLEEDING`,
        true,
      );
      if (!prevented && !sessionExtrasRef.current.playerDebuffs.includes('BLEEDING')) {
        sessionExtrasRef.current.playerDebuffs = [
          ...sessionExtrasRef.current.playerDebuffs,
          'BLEEDING',
        ];
      }
      if (!prevented) log('>> PLAGUE SWARM — operative bleeding.');
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

  const scheduleNextEnemyAction = (countering: boolean, waitedMs = 0) => {
    if (isCombatTerminal() || enemyActionQueueRef.current.length === 0) return;
    if (isHitstopActive() || combatPausedRef.current) {
      // Safety: never park the hostile queue forever behind a stuck pause/hitstop.
      if (waitedMs >= 5000) {
        combatPausedRef.current = false;
        log('[COMBAT] >> Hostile queue resume — pause/hitstop watchdog cleared.');
      } else {
        setTimeout(() => scheduleNextEnemyAction(countering, waitedMs + 50), 50);
        return;
      }
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
          if (!shouldPreventHostileEffect(`enemy-${e.unitId ?? 'x'}-STRIKE:HEX_MARK`, true)) {
            log(applyRivalHexMark(sessionExtrasRef.current));
          }
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
        hurtPlayer(dmg, true, `>> PAVEMENT CRUSHER — ${dmg}`, {
          attacker: e,
          rollCrit: false,
          controlEffects: ['KNOCKDOWN'],
          authoredEnemyActionId: `enemy-${e.unitId ?? 'x'}-PAVEMENT_CRUSHER`,
        });
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
        if (!shouldPreventHostileEffect(`enemy-${e.unitId ?? 'x'}-VEIL_STATIC`, true)) {
          sessionExtrasRef.current = {
            ...sessionExtrasRef.current,
            playerApCapNextTurn: 2,
          };
          log(`>> ${e.designation} VEIL STATIC — operative AP capped next turn (2/3).`);
        }
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
        log(`>> ${e.designation} KINETIC AFTERSHOCK — ${dmg} impact.`);
        hurtPlayer(dmg, false, `>> KINETIC AFTERSHOCK — ${dmg}`, { attacker: e });
        const applied = applyHostileStructuredDebuff(`enemy-${e.unitId ?? 'x'}-KINETIC_AFTERSHOCK:ECHO`, {
          type: 'ECHO_DEBUFF',
          amount: dmg,
          turnsRemaining: 1,
        });
        if (applied) log(`>> ${e.designation} KINETIC AFTERSHOCK — echo primed.`);
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
        const applied = applyHostileStructuredDebuff(`enemy-${e.unitId ?? 'x'}-SENSORY_JAM`, {
          type: 'SENSORY_JAMMED',
          turnsRemaining: jamTurns,
        });
        if (applied) {
          log(`>> ${e.designation} SENSORY JAM — hostile intents obscured (${jamTurns} turn${jamTurns > 1 ? 's' : ''}).`);
        }
        break;
      }
      case 'HEX_MARK': {
        if (!shouldPreventHostileEffect(`enemy-${e.unitId ?? 'x'}-HEX_MARK`, true)) {
          log(applyRivalHexMark(sessionExtrasRef.current));
        }
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
        const applied = applyHostileStructuredDebuff(`enemy-${e.unitId ?? 'x'}-TARGET_LOCK`, {
          type: 'TARGET_LOCKED',
          turnsRemaining: 2,
        });
        if (e.unitId && e.rosterId === 'spotter') {
          patchUnit(e.unitId, { spotterLockedOn: true, isCharging: true });
        }
        if (applied) log(`>> ${e.designation} LOCKED ON — artillery primed.`);
        break;
      }
      case 'ASHEN_ROT': {
        const applied = applyHostileStructuredDebuff(`enemy-${e.unitId ?? 'x'}-ASHEN_ROT`, {
          type: 'ASHEN_ROT',
          turnsRemaining: 2,
        });
        if (applied) log(`>> ${e.designation} ASHEN ROT — buff/defend actions cost stamina.`);
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
        const applied = applyHostileStructuredDebuff(`enemy-${e.unitId ?? 'x'}-LASER_SIGHT`, {
          type: 'LASER_SIGHT',
          turnsRemaining: lockTurns,
        });
        if (applied) {
          log(
            e.rosterId === 'coil-spike-sniper' && lockTurns > 1
              ? `>> ${e.designation} LASER SIGHT — true damage lock acquired (${lockTurns}-turn wind-up).`
              : `>> ${e.designation} LASER SIGHT — true damage lock acquired.`,
          );
        }
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
          const applied = applyHostileStructuredDebuff(`enemy-${e.unitId ?? 'x'}-ARTILLERY_FIRE:SEARING`, {
            type: 'SEARING',
            turnsRemaining: 3,
          });
          if (applied) log(`>> ${e.designation} SEARING MARK applied.`);
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
        const applied = applyHostileStructuredDebuff(`enemy-${e.unitId ?? 'x'}-TAR_BIND:ROOTED`, {
          type: 'ROOTED',
          turnsRemaining: rootDuration,
        });
        if (applied) {
          log(`>> ${e.designation} ROOTED — defend/evade disabled (${rootDuration} turn${rootDuration > 1 ? 's' : ''}).`);
        }
        if (e.rosterId === 'tar-choir') {
          const marked = markTarChoirOnHit(depthVariantRuntimeRef.current, e.rosterId);
          depthVariantRuntimeRef.current = marked.runtime;
          if (marked.logLine) log(marked.logLine);
        }
        break;
      }
      case 'STAMINA_TETHER': {
        if (shouldPreventHostileEffect(`enemy-${e.unitId ?? 'x'}-STAMINA_TETHER`, true)) break;
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
        const applied = applyHostileStructuredDebuff(`enemy-${e.unitId ?? 'x'}-JAM_AUGMENT`, {
          type: 'JAMMED_AUGMENT',
          turnsRemaining: duration,
        });
        if (applied) {
          sessionExtrasRef.current = {
            ...sessionExtrasRef.current,
            jammedAugmentSlot: slots[0] ?? null,
            jammedAugmentSlots: slots,
          };
          log(`>> ${e.designation} JAMMED AUGMENT — loadout slot(s) ${slots.map((s) => s + 1).join(', ')} disabled (${duration} turn${duration > 1 ? 's' : ''}).`);
        }
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
    if (operativeClass === 'HEX_SHOT') {
      advanceCinderlineHazardsAfterEnemyPhase(classCombatRef.current);
    }
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
      expireSanguineExposureEndOfEnemyTurn(classCombatRef.current);
      clearSmokeArcAccuracyDownEndOfEnemyTurn(classCombatRef.current);
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
    runItemCombatFlagsRef.current.razorwireRootedUnits.forEach((snapshot, unitId) => {
      const unit = getUnitById(squadRef.current, unitId);
      if (!unit) return;
      patchUnit(unitId, {
        ...removeCombatTag(unit, 'ROOTED'),
        ...snapshot,
      });
    });
    runItemCombatFlagsRef.current.razorwireRootedUnits.clear();
    balanceEncounterRef.current.playerTurns += 1;
    if (operativeClass === 'HEX_SHOT') {
      if (classCombatRef.current.hexElusiveCharges > 0) {
        classCombatRef.current.hexElusiveCharges = clearHexElusive({
          charges: classCombatRef.current.hexElusiveCharges,
        }).charges;
        log('[ELUSIVE] >> Charge expired.');
      }
      classCombatRef.current.lastWordApRefundUsedThisPlayerTurn = false;
      // Threshold expires unused at the start of Hex's next player turn — no refunds.
      if (classCombatRef.current.thresholdArmed) {
        const cleared = clearHexThreshold({
          thresholdArmed: classCombatRef.current.thresholdArmed,
          thresholdSnapshot: classCombatRef.current.thresholdAmmoType
            ? {
              ammoType: classCombatRef.current.thresholdAmmoType,
              nextShotOvercharged: classCombatRef.current.thresholdNextShotOvercharged,
              overchargeMultiplier: classCombatRef.current.thresholdOverchargeMultiplier,
              firstShotPenaltyPending: classCombatRef.current.thresholdFirstShotPenaltyPending,
            }
            : null,
        });
        classCombatRef.current.thresholdArmed = cleared.thresholdArmed;
        classCombatRef.current.thresholdAmmoType = null;
        classCombatRef.current.thresholdNextShotOvercharged = false;
        classCombatRef.current.thresholdOverchargeMultiplier = 0;
        classCombatRef.current.thresholdFirstShotPenaltyPending = false;
        log('[THRESHOLD] >> Expired unused — shell and snapshotted modifiers lost.');
      }
    }
    if (operativeClass === 'AEGIS') {
      aegisWeaponCombatRef.current = beginAegisPlayerTurnWeaponState(
        aegisWeaponCombatRef.current,
        Math.max(1, balanceEncounterRef.current.playerTurns),
      );
      syncAegisTempoPresentation(aegisWeaponCombatRef.current);
    }
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
    runeboundCarapaceRef.current = clearRuneboundCarapace(runeboundCarapaceRef.current);
    riftWardReadyRef.current = operativeClass === 'ENVOY';
    setRiftWardReadyUi(operativeClass === 'ENVOY');
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
    if (apPenalty > 0) {
      sessionExtrasRef.current.playerApPenaltyNextTurn = 0;
      log(`>> MIASMA FATIGUE — −${apPenalty} AP this turn.`);
    }
    if (apCap != null) {
      sessionExtrasRef.current.playerApCapNextTurn = null;
      log(`>> VEIL STATIC RESIDUE — operative AP capped at ${apCap}.`);
    }
    const baseAp = PLAYER_ACTION_POINTS_PER_TURN + incursionApBonus + bonusAp - apPenalty;
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
    syncNineStrainPlayerTurn();
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


  const resolveEnemyAction = (countering: boolean, actedUnitId?: string | null) => {
    if (isCombatTerminal()) return;
    const resolvedActor = (
      actedUnitId
        ? getUnitById(squadRef.current, actedUnitId)
        : null
    ) ?? enemyRef.current;
    const currentEnemy = resolvedActor;
    if (!currentEnemy || operativeHpRef.current <= 0) {
      setEnemyActionStage(null);
      if (operativeHpRef.current <= 0) return;
      // Never stall the hostile phase when the acting ref was cleared mid-animation.
      if (allUnitsDefeated(squadRef.current)) {
        scheduleCombatVictoryResolution();
        return;
      }
      if (enemyActionQueueRef.current.length > 0) scheduleNextEnemyAction(countering);
      else endEnemyTurn(true);
      return;
    }
    if (currentEnemy.unitId && enemyRef.current?.unitId !== currentEnemy.unitId) {
      focusEnemy(currentEnemy);
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
    // W.4 — Threshold fires before the next eligible direct attack (pre-attack reaction).
    if (
      operativeClass === 'HEX_SHOT'
      && classCombatRef.current.thresholdArmed
      && enemyId
      && isHexThresholdEligibleEnemyAction(currentEnemy.intent)
    ) {
      const intentAtTrigger = currentEnemy.intent;
      const consumed = consumeHexThresholdArm({
        thresholdArmed: classCombatRef.current.thresholdArmed,
        thresholdSnapshot: classCombatRef.current.thresholdAmmoType
          ? {
            ammoType: classCombatRef.current.thresholdAmmoType,
            nextShotOvercharged: classCombatRef.current.thresholdNextShotOvercharged,
            overchargeMultiplier: classCombatRef.current.thresholdOverchargeMultiplier,
            firstShotPenaltyPending: classCombatRef.current.thresholdFirstShotPenaltyPending,
          }
          : null,
      });
      classCombatRef.current.thresholdArmed = consumed.next.thresholdArmed;
      classCombatRef.current.thresholdAmmoType = null;
      classCombatRef.current.thresholdNextShotOvercharged = false;
      classCombatRef.current.thresholdOverchargeMultiplier = 0;
      classCombatRef.current.thresholdFirstShotPenaltyPending = false;
      if (consumed.fired && consumed.snapshot) {
        const snap = consumed.snapshot;
        const attacker = getUnitById(squadRef.current, enemyId);
        if (attacker?.unitId && isUnitAlive(attacker)) {
          const prevAmmo = hexShotStateRef.current.currentAmmoType;
          hexShotStateRef.current = {
            ...hexShotStateRef.current,
            currentAmmoType: snap.ammoType,
            nextShotOvercharged: snap.nextShotOvercharged,
            overchargeMultiplier: snap.overchargeMultiplier,
            firstShotPenaltyPending: snap.firstShotPenaltyPending,
          };
          let dmg = scaleHexWeaponAuthoredDamage(THRESHOLD_AUTHORED_DAMAGE, resolvedWeapon);
          dmg = applyBlackDoorBacklineFalloff(dmg, !!attacker.gridSlot?.startsWith('BL'));
          lastPlayerAbilityRef.current = 'THRESHOLD';
          hexAmmoCastTrackerRef.current = createHexAmmoCastTracker();
          hexAmmoHitIndexRef.current = 0;
          hurtEnemy(dmg, '[THRESHOLD]', 'STRIKE', {
            channel: 'KINETIC',
            fractureGain: 10,
            abilityId: 'THRESHOLD' as AegisAbilityId,
            targetId: enemyId,
            weaponFamilyBallisticAlreadyScaled: true,
            playerActionId: `pa-hex-threshold-${Date.now()}`,
          });
          hexShotStateRef.current = {
            ...hexShotStateRef.current,
            currentAmmoType: prevAmmo,
          };
          log('[THRESHOLD] >> Pre-attack reaction resolved.');
        }
        const after = getUnitById(squadRef.current, enemyId);
        const lethal = !after || !isUnitAlive(after);
        const interrupted = !!after && isUnitAlive(after) && after.intent !== intentAtTrigger;
        if (lethal || interrupted) {
          if (lethal) log('[THRESHOLD] >> Attacker down — hostile action cancelled.');
          else log('[THRESHOLD] >> Interrupt — hostile action cancelled.');
          if (enemyActionQueueRef.current.length > 0) scheduleNextEnemyAction(countering);
          else if (allUnitsDefeated(squadRef.current)) scheduleCombatVictoryResolution();
          else endEnemyTurn(true);
          return;
        }
      }
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
      const panopticonDmg = upgradeDamagePacketValue(
        overwatchMastery ? 16 : 8,
        100,
        classCombatRef.current.panopticonDamagePercent ?? 100,
      );
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
    finalizeCarbineSuppressedAfterEnemyAction(currentEnemy.unitId);
    if (operativeClass === 'AEGIS') {
      resolveRuneboundCarapaceAfterEnemyAction();
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
      const cinderTick = resolveCinderlineTickForUnit(classCombatRef.current, unit);
      if (cinderTick) {
        hurtEnemy(cinderTick.damage, '[CINDERLINE SATURATION]', undefined, {
          channel: 'OCCULT',
          targetId: unit.unitId,
          rollCrit: false,
          indirectDamage: true,
          abilityId: 'CINDERLINE_SATURATION',
        });
        log(`[CINDERLINE] >> ${unit.designation} scorched on ${cinderTick.slot} — ${cinderTick.damage} Occult.`);
      }
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
        const actedUnitId = enemyActionQueueRef.current[0] ?? acting.unitId ?? null;
        if (actedUnitId) {
          const acted = getUnitById(squadRef.current, actedUnitId);
          if (acted) focusEnemy(acted);
        }
        enemyActionQueueRef.current.shift();
        resolveEnemyAction(countering, actedUnitId);
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
    if (operativeClass === 'AEGIS' && aegisWeaponCombatRef.current.committed) {
      if (fromVoidWard) {
        log('[VOID WARD] >> Committed — Parry and Evade suppressed.');
        clearVoidWardShroud();
      }
      return false;
    }
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

  const finalizeCarbineSuppressedAfterEnemyAction = (actorUnitId: string | null | undefined) => {
    if (operativeClass !== 'HEX_SHOT' || !actorUnitId) return;
    if (classCombatRef.current.carbineSuppressedUnitId !== actorUnitId) return;
    if (classCombatRef.current.carbineSuppressedAppliedThisAction) {
      const cleared = clearHexCarbineSuppressed({
        carbineSuppressedUnitId: classCombatRef.current.carbineSuppressedUnitId,
        carbineSuppressedAppliedThisAction: classCombatRef.current.carbineSuppressedAppliedThisAction,
      });
      classCombatRef.current.carbineSuppressedUnitId = cleared.carbineSuppressedUnitId;
      classCombatRef.current.carbineSuppressedAppliedThisAction = cleared.carbineSuppressedAppliedThisAction;
      log('[SUPPRESSED] >> Charge consumed.');
      return;
    }
    // Unused — expires at end of the affected enemy's action opportunity.
    const cleared = clearHexCarbineSuppressed({
      carbineSuppressedUnitId: classCombatRef.current.carbineSuppressedUnitId,
      carbineSuppressedAppliedThisAction: classCombatRef.current.carbineSuppressedAppliedThisAction,
    });
    classCombatRef.current.carbineSuppressedUnitId = cleared.carbineSuppressedUnitId;
    classCombatRef.current.carbineSuppressedAppliedThisAction = cleared.carbineSuppressedAppliedThisAction;
    log('[SUPPRESSED] >> Expired unused.');
  };

  const passToEnemy = (countering = false) => {
    if (isCombatTerminal()) return;
    if (operativeClass === 'AEGIS') {
      const endingTurn = Math.max(1, balanceEncounterRef.current.playerTurns);
      let ws = aegisWeaponCombatRef.current;
      ws = expireAegisTempoAtPlayerTurnEnd(ws, endingTurn);
      ws = expireDoomfallReleaseAtTurnEnd(ws);
      aegisWeaponCombatRef.current = ws;
      syncAegisTempoPresentation(ws);
    }
    if (operativeClass === 'HEX_SHOT') {
      const endingTurn = Math.max(1, balanceEncounterRef.current.playerTurns);
      const expired = expireHexFiringSolutionAtPlayerTurnEnd({
        firingSolutionUnitId: classCombatRef.current.firingSolutionUnitId,
        firingSolutionExpiresAfterPlayerTurn: classCombatRef.current.firingSolutionExpiresAfterPlayerTurn,
      }, endingTurn);
      classCombatRef.current.firingSolutionUnitId = expired.next.firingSolutionUnitId;
      classCombatRef.current.firingSolutionExpiresAfterPlayerTurn =
        expired.next.firingSolutionExpiresAfterPlayerTurn;
      if (expired.expired) {
        log('[FIRING SOLUTION] >> Mark expired.');
      }
    }
    clearAegisDualTargets();
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
    setRiftWardReadyUi(operativeClass === 'ENVOY');
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
    syncHitAbsorbProtectionUi();
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
      razorwireRootedUnits: new Map(),
    };
    notifyRunItemCombatStart();
    const requisitionEncounter: RequisitionEncounterDescriptor =
      activeIncursionRefLocal.current.activeCombatEncounter ?? {
        encounterId: `${
          activeIncursionRefLocal.current.currentNodeId || 'combat'
        }:${nodeIndex}`,
        kind: bossProfile
          ? 'BOSS'
          : env.eliteModifier ||
              initialSquad.some((unit) => unit.isAlpha === true)
            ? 'ELITE'
            : 'STANDARD',
      };
    beginRequisitionCombatEncounter(requisitionEncounter);
    activeIncursionRefLocal.current = {
      ...activeIncursionRefLocal.current,
      activeCombatEncounter: requisitionEncounter,
    };
    weaponRuntimeRef.current = createDefaultWeaponRuntime();
    nineStrainBridgeRef.current.hydrate(peekActiveIncursion().nineStrainRuntime);
    aegisWeaponCombatRef.current = createDefaultAegisWeaponCombatState();
    doomfallGraftPlanRef.current = null;
    aegisControlPipelineRef.current = createAegisControlPipelineSession();
    clearAegisDualTargets();
    sessionExtrasRef.current = createDefaultCombatSessionExtras();
    initPlayerMaxHpDebtTracking(sessionExtrasRef.current, combatMaxSoulAnchorRef.current);
    setPlayerMaxAnchorDebt(0);
    requisitionBatteryConsumedEncounterIdsRef.current = new Set();
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
      const applied = applyHostileStructuredDebuff(`enemy-${preLockedSniper.unitId ?? 'x'}-PRELOCK:LASER_SIGHT`, {
        type: 'LASER_SIGHT',
        turnsRemaining: getAlphaMechanic(preLockedSniper, 'lockOnTurns', 1),
      });
      if (applied) log(`>> ${preLockedSniper.designation} EXECUTIONER LOCK — target pre-acquired.`);
    }
    const ghostedAp = narrativeCombatBoons?.ghosted ? 1 : 0;
    let entryPrimerAp = 0;
    entryPrimerAp = resolveRequisitionFirstTurnAp(requisitionEncounter);
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
    syncNineStrainPlayerTurn();
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
      abilityId?: HexShotAbilityId | string;
      rollCrit?: boolean;
      forceCrit?: boolean;
      indirectDamage?: boolean;
      innateArmorPressureLayers?: number;
      weaponFamilyBallisticAlreadyScaled?: boolean;
      playerActionId?: string;
      accuracyBonusPct?: number;
    },
    targetId?: string,
  ): boolean => {
    const tid = options?.targetId ?? targetId ?? selectedTargetIdRef.current ?? undefined;
    let rollCrit = options?.rollCrit;
    if (options?.forceCrit) rollCrit = true;
    const astralLock = resolveAstralLockCrit(
      tid,
      options?.abilityId,
      options?.abilityId != null
        && options.abilityId !== 'THRESHOLD'
        && getHexShotAbilityTags(options.abilityId).includes('BALLISTIC'),
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

    let landed = false;
    const hits = plan?.hitCount ?? 1;
    const strikeTargets = resolveClassGraftStrikeTargetIds(plan, squadRef.current, tid);
    const targetLoop = strikeTargets.length > 0 ? strikeTargets : [pickTarget(tid)].filter(Boolean) as string[];
    for (const strikeTarget of targetLoop) {
      for (let hit = 0; hit < hits; hit += 1) {
        hurtEnemy(scaled, tag, 'STRIKE', {
          channel,
          fractureGain: options?.fractureGain,
          targetId: strikeTarget,
          abilityId: options?.abilityId as AegisAbilityId,
          rollCrit,
          innateArmorPressureLayers: options?.innateArmorPressureLayers,
          indirectDamage: options?.indirectDamage,
          weaponFamilyBallisticAlreadyScaled: options?.weaponFamilyBallisticAlreadyScaled,
          playerActionId: options?.playerActionId,
          accuracyBonusPct: options?.accuracyBonusPct,
          reportLanded: (didLand) => {
            if (didLand) landed = true;
          },
        });
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
            // Echo must not inherit fixed-basic family-scale bypass unless its own packet was pre-scaled.
            weaponFamilyBallisticAlreadyScaled: options?.weaponFamilyBallisticAlreadyScaled,
            playerActionId: options?.playerActionId,
          },
        );
      }
    }
    return landed;
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
          dropLoot: () => {},
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
      log('[REJECTED] >> Ultimate channel unavailable for this encounter.');
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
        graftPlan,
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
        operativeCurrentHp: operativeHpRef.current,
        operativeMaxHp: getEffectiveMaxSoulAnchor(),
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
      log('[REJECTED] >> Ultimate channel unavailable for this encounter.');
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
        graftPlan,
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
        // E.4 — Envoy Catalyst cast authority (Hub orchestration only).
        const cat = catalystPrimeForEnvoyCast(abilityId);
        if (cat) {
          const targetId = selectedTargetIdRef.current;
          const target = targetId ? getUnitById(squadRef.current, targetId) : null;
          const cast = resolveEnvoyCatalystCast({
            classState: classCombatRef.current,
            prime: cat,
            target,
            originActionId: abilityId,
            applyTargetPayoff: true,
          });
          classLoopTelemetryRef.current.catalystsPrimed += 1;
          if (cat === 'ASH' || abilityId === 'RIFT_WARD' || abilityId === 'PHASE_STEP') {
            classLoopTelemetryRef.current.defensiveCatalystUses += 1;
          }
          if (cast.previous) classLoopTelemetryRef.current.catalystSequencesTriggered += 1;
          cast.payoff?.logMessages.forEach((m) => log(`[CATALYST] >> ${m}`));
          if (cast.previous && cast.payoff?.logMessages.length) {
            emitJuice('ENVOY_CATALYST_RESONANCE', {
              text: cast.payoff.logMessages[0],
            });
          }
          if (cast.patchedTarget?.unitId) {
            patchUnit(cast.patchedTarget.unitId, cast.patchedTarget);
            if (cast.payoff?.extraWardBreak) {
              classLoopTelemetryRef.current.wardsBroken += cast.payoff.extraWardBreak;
            }
            if (cast.payoff?.fractureTarget) {
              classLoopTelemetryRef.current.fracturesAppliedByClass += 1;
            }
          }
          if (cast.payoff?.healAmount) {
            applyHealRef.current(cast.payoff.healAmount);
          }
          if (cast.payoff?.shieldAmount) {
            sessionExtrasRef.current.playerShield =
              (sessionExtrasRef.current.playerShield ?? 0) + cast.payoff.shieldAmount;
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
            dropLoot: () => {},
          },
        );
      }
      activeClassGraftPlanRef.current = null;
      publishSquadUi(squadRef.current);
    };

    runExecutor();
  };

  const readAegisWeaponHitOutcome = (
    unitId: string,
    before: { kineticArmor: number; fractured: boolean },
  ): AuthoredHitOutcome => {
    const after = getUnitById(squadRef.current, unitId);
    if (!after || !isUnitAlive(after)) {
      return { hit: true, killed: true };
    }
    const afterKa = after.kineticArmor ?? 0;
    const afterFractured = isEnemyFractured(after);
    return {
      hit: true,
      killed: false,
      removedFinalArmor: before.kineticArmor > 0 && afterKa === 0,
      enteredFractured: !before.fractured && afterFractured,
    };
  };

  const executeAegisWeaponAction = (actionId: AegisWeaponActionId) => {
    if (cycleState !== 'TEXT_COMBAT' || !canPlayerCommand()) return;
    ripostePrimaryTargetIdRef.current = null;
    riposteCashedActionIdRef.current = null;
    unmakerT3FractureBreakGrantedActionRef.current = null;

    const ws = aegisWeaponCombatRef.current;
    const releaseAvailable = ws.doomfallReleaseAvailable;
    let targetId = selectedTargetIdRef.current;
    let dualTargetIds: readonly [string, string] | null = null;
    let rowTargetIds: readonly string[] | null = null;

    if (actionId === 'DIVERGENCE') {
      const dual = dualTargetIdsRef.current;
      if (!dual[0] || !dual[1]) {
        log('[TARGET] >> Divergence requires Blade One and Blade Two targets.');
        return;
      }
      dualTargetIds = [dual[0], dual[1]];
    } else if (actionId === 'DREAD_HORIZON') {
      if (!targetId) {
        log('[TARGET] >> Select a row anchor on the grid.');
        return;
      }
      rowTargetIds = resolveDreadHorizonTargets(squadRef.current, targetId)
        .map((unit) => unit.unitId!)
        .filter(Boolean);
      if (rowTargetIds.length === 0) {
        log('[TARGET] >> No valid Dread Horizon row targets.');
        return;
      }
    } else if (actionId === 'DOOMFALL' && !releaseAvailable) {
      targetId = null;
    }

    if (
      actionId !== 'DOOMFALL'
      || releaseAvailable
    ) {
      const bootstrapTarget = targetId
        ?? dualTargetIds?.[0]
        ?? rowTargetIds?.[0]
        ?? primaryAliveUnit(squadRef.current)?.unitId
        ?? null;
      if (bootstrapTarget) {
        const bootstrapUnit = getUnitById(squadRef.current, bootstrapTarget);
        if (bootstrapUnit) {
          enemyRef.current = bootstrapUnit;
          setEnemy(bootstrapUnit);
          focusedUnitIdRef.current = bootstrapTarget;
        }
      }
    }

    crimsonPactConsumedActionRef.current = null;

    const isDoomfallRelease = actionId === 'DOOMFALL' && releaseAvailable;
    const isDoomfallCharge = actionId === 'DOOMFALL' && !releaseAvailable;
    const graftId = resolveAegisAbilityGraftId(abilityGraftsRef.current, actionId);
    let graftPlan: GraftCastPlan | null = null;
    if (isDoomfallRelease) {
      graftPlan = doomfallGraftPlanRef.current;
    } else if (graftId) {
      graftPlan = buildWeaponActionGraftCastPlan(actionId, graftId, {
        doomfallReleaseAvailable: releaseAvailable,
      });
    }

    // Pre-commit graft taxes once (Doomfall Charge / normal actions). Release never recommits.
    let apAlreadyCommitted = false;
    let reservedAp = 0;
    let reservedBrand = 0;
    let reservedReserve = 0;
    let reservedHp = 0;
    if (graftPlan?.graftName && !isDoomfallRelease) {
      const graftAfford = canAffordGraftResources(
        graftPlan,
        abyssalRef.current,
        classCombatRef.current.runicBrands,
      );
      if (!graftAfford.ok) {
        log(`[REJECTED] >> Graft ${graftAfford.reason}.`);
        return;
      }
      if (graftPlan.hpCostPct > 0) {
        const hpCost = Math.ceil(maxSoulAnchor * (graftPlan.hpCostPct / 100));
        if (operativeHpRef.current <= hpCost) {
          log('[REJECTED] >> Insufficient soul anchor for graft HP cost.');
          return;
        }
        reservedHp = hpCost;
      }
      reservedAp = graftPlan.apCost;
      if (!spendActionPoints(reservedAp)) {
        log('[REJECTED] >> Insufficient action points.');
        return;
      }
      apAlreadyCommitted = true;
      if (graftPlan.brandTax > 0) {
        if (classCombatRef.current.runicBrands < graftPlan.brandTax) {
          playerApRef.current += reservedAp;
          setPlayerActionPoints(playerApRef.current);
          log(`[REJECTED] >> Graft requires ${graftPlan.brandTax} Runic Brand(s).`);
          return;
        }
        consumeRunicBrands(graftPlan.brandTax);
        reservedBrand = graftPlan.brandTax;
        log(`>> [${graftPlan.graftName.toUpperCase()}] — ${graftPlan.brandTax} Runic Brand tithed.`);
      }
      if (graftPlan.consumeAllReserve) {
        reservedReserve = abyssalRef.current;
        abyssalRef.current = 0;
        setAbyssalReserve(0);
        activeGraftReserveSpentRef.current = reservedReserve;
        log(`>> [${graftPlan.graftName.toUpperCase()}] — all Reserve detonated (${reservedReserve}%).`);
      } else if (graftPlan.reservePenalty > 0) {
        if (abyssalRef.current < graftPlan.reservePenalty) {
          playerApRef.current += reservedAp;
          setPlayerActionPoints(playerApRef.current);
          if (reservedBrand > 0) {
            setRunicBrandCount(classCombatRef.current.runicBrands + reservedBrand);
          }
          log(`[REJECTED] >> Insufficient Reserve for graft tax (${graftPlan.reservePenalty}%).`);
          return;
        }
        abyssalRef.current -= graftPlan.reservePenalty;
        setAbyssalReserve(abyssalRef.current);
        reservedReserve = graftPlan.reservePenalty;
        log(`>> [${graftPlan.graftName.toUpperCase()}] — ${graftPlan.reservePenalty}% Reserve taxed.`);
      }
      if (reservedHp > 0) {
        setOperativeHp((p) => {
          const n = Math.max(p - reservedHp, 0);
          operativeHpRef.current = n;
          if (n <= 0) resolve(false);
          return n;
        });
        log(`>> [${graftPlan.graftName.toUpperCase()}] — ${reservedHp} HP tithe on cast.`);
      }
    } else if (!graftPlan?.graftName) {
      // Ungrafted path — executor spends catalog AP.
      graftPlan = null;
    }

    activeGraftPlanRef.current = graftPlan;
    activeGraftApCostRef.current = graftPlan?.apCost
      ?? buildWeaponActionGraftCastPlan(actionId, undefined, {
        doomfallReleaseAvailable: releaseAvailable,
      }).apCost;

    const result = executeAegisWeaponActionPlan({
      actionId,
      weaponState: ws,
      targetId,
      dualTargetIds,
      rowTargetIds,
      graftPlan,
      apAlreadyCommitted,
      apCostOverride: apAlreadyCommitted ? reservedAp : undefined,
      host: {
        log,
        getEnemy: (unitId) => {
          const unit = getUnitById(squadRef.current, unitId);
          if (!unit || !isUnitAlive(unit)) return null;
          return {
            unitId,
            currentHp: unit.currentHp,
            kineticArmorStacks: unit.kineticArmor ?? 0,
            fractured: isEnemyFractured(unit),
            fracture: unit.fractureGauge ?? 0,
            fractureThreshold: unit.fractureMax ?? 100,
          };
        },
        hurtEnemy: (args) => {
          let working = getUnitById(squadRef.current, args.targetId);
          if (!working) return true;
          if (args.armorStrip > 0 && !args.echoHit) {
            const strip = stripKineticArmor(working, args.armorStrip);
            strip.logLines.forEach((line) => log(line));
            if (working.unitId) patchUnit(working.unitId, strip.enemy);
            working = strip.enemy;
          }
          // Graft-added hits must not claim Riposte primary ownership.
          if (
            ripostePrimaryTargetIdRef.current == null
            && args.damage > 0
            && !args.echoHit
          ) {
            ripostePrimaryTargetIdRef.current = args.targetId;
          }
          const eradicated = hurtEnemy(args.damage, args.tag, 'STRIKE', {
            channel: args.channel,
            fractureGain: args.fractureGain,
            abilityId: args.abilityId,
            playerActionId: args.playerActionId,
            targetId: args.targetId,
            nestedPresentation: args.nestedPresentation,
            rollCrit: !args.echoHit,
            accuracyBonusPct: args.accuracyBonusPct,
            echoHit: args.echoHit,
            // Transformed WA plan owns damageMultiplier; hub must not square it.
            graftDamagePreScaled: true,
          });
          if (args.consumeFractured && args.targetId && !args.echoHit) {
            const live = getUnitById(squadRef.current, args.targetId);
            if (live && isEnemyFractured(live)) {
              patchUnit(args.targetId, {
                ...recoverFromFracture({
                  ...live,
                  fractureGauge: 0,
                  fracturedThisRound: true,
                }),
                fractureGauge: 0,
              });
              log('[DOOMFALL] >> Fractured consumed.');
            }
          }
          return eradicated;
        },
        spendActionPoints: (cost) => spendActionPoints(cost),
        refundActionPoints: (amount) => {
          playerApRef.current += amount;
          setPlayerActionPoints(playerApRef.current);
        },
        chargeReserve: (amount) => chargeAr(amount),
        imprintBrand: (count) => imprintRunicBrand(count),
        getBrands: () => classCombatRef.current.runicBrands,
        getPlayerTurn: () => Math.max(1, balanceEncounterRef.current.playerTurns),
        readHitOutcome: readAegisWeaponHitOutcome,
      },
    });

    if (!result.ok) {
      if (result.rejectedReason) {
        log(`[REJECTED] >> ${result.rejectedReason}`);
      }
      // Pre-resolution reject — roll back graft commitment.
      if (apAlreadyCommitted) {
        playerApRef.current += reservedAp;
        setPlayerActionPoints(playerApRef.current);
        if (reservedBrand > 0) {
          setRunicBrandCount(classCombatRef.current.runicBrands + reservedBrand);
        }
        if (reservedReserve > 0) {
          abyssalRef.current += reservedReserve;
          setAbyssalReserve(abyssalRef.current);
        }
        if (reservedHp > 0) {
          setOperativeHp((p) => {
            const n = p + reservedHp;
            operativeHpRef.current = n;
            return n;
          });
        }
      }
      activeGraftPlanRef.current = null;
      activeGraftReserveSpentRef.current = 0;
      return;
    }

    if (isDoomfallCharge) {
      doomfallGraftPlanRef.current = graftPlan;
    }
    if (isDoomfallRelease || (result.weaponState && !result.weaponState.doomfallReleaseAvailable && !result.weaponState.committed)) {
      if (isDoomfallRelease) doomfallGraftPlanRef.current = null;
    }

    aegisWeaponCombatRef.current = result.weaponState;
    syncAegisTempoPresentation(result.weaponState);
    clearAegisDualTargets();
    selectedAbilityRef.current = null;
    setSelectedAbility(null);
    activeGraftPlanRef.current = null;
    activeGraftReserveSpentRef.current = 0;
    publishSquadUi(squadRef.current);
  };

  const executeHexWeaponActionClassAbility = (actionId: HexWeaponActionId) => {
    if (cycleState !== 'TEXT_COMBAT' || !canPlayerCommand()) return;
    if (!isHexWeaponActionExecutable(activeWeaponFamilyId, actionId)) {
      log('[REJECTED] >> Weapon action unavailable for equipped family.');
      return;
    }
    const def = getHexWeaponActionDefinition(actionId);
    if (!def) {
      log('[REJECTED] >> Weapon action not implemented.');
      return;
    }
    const graftId = resolveHexShotAbilityGraftId(hexShotAbilityGraftsRef.current, actionId);
    const graftPlan = buildClassGraftCastPlan('HEX_SHOT', actionId, graftId);
    activeClassGraftPlanRef.current = graftPlan;
    if (!spendActionPoints(graftPlan.apCost)) {
      log('[REJECTED] >> Insufficient action points.');
      activeClassGraftPlanRef.current = null;
      return;
    }
    activeClassGraftApCostRef.current = graftPlan.apCost;
    if (!applyClassGraftCastSetup(graftPlan, selectedTargetIdRef.current)) {
      playerApRef.current += graftPlan.apCost;
      setPlayerActionPoints(playerApRef.current);
      activeClassGraftPlanRef.current = null;
      return;
    }
    lastPlayerAbilityRef.current = actionId;
    hexAmmoCastTrackerRef.current = createHexAmmoCastTracker();
    hexAmmoHitIndexRef.current = 0;
    const squadBefore = squadRef.current.map((unit) => ({ id: unit.unitId, hp: unit.currentHp }));
    const dual = dualTargetIdsRef.current;
    const secondaryTargetId = actionId === 'CONTACT_FRONT'
      && dual[0]
      && dual[1]
      && dual[0] !== dual[1]
      ? dual[1]
      : null;
    const primaryTargetId = actionId === 'CONTACT_FRONT'
      ? (dual[0] ?? selectedTargetIdRef.current)
      : selectedTargetIdRef.current;
    const result = executeHexWeaponAction({
      actionId,
      squad: squadRef.current,
      targetId: primaryTargetId,
      secondaryTargetId,
      currentAmmo: currentAmmoRef.current,
      maxAmmo,
      classState: classCombatRef.current,
      resolvedWeapon,
      effectiveTags: graftPlan.effectiveTags,
      currentPlayerTurn: Math.max(1, balanceEncounterRef.current.playerTurns),
      thresholdArmSnapshot: actionId === 'THRESHOLD'
        ? {
          ammoType: hexShotStateRef.current.currentAmmoType,
          nextShotOvercharged: hexShotStateRef.current.nextShotOvercharged,
          overchargeMultiplier: hexShotStateRef.current.overchargeMultiplier,
          firstShotPenaltyPending: hexShotStateRef.current.firstShotPenaltyPending,
        }
        : undefined,
      onThresholdArmed: () => {
        // Consume pending global next-shot flags so other ballistics cannot use them.
        if (
          hexShotStateRef.current.nextShotOvercharged
          || hexShotStateRef.current.firstShotPenaltyPending
        ) {
          dispatchHexShot({ type: 'HEX_CONSUME_BALLISTIC_OVERCHARGE' });
        }
      },
      log,
      spendAmmo: (amount) => spendAmmo(amount),
      spendStamina: (amount) => spendStam(amount),
      hurtEnemy: buildHexHurtEnemy(),
      onMagazineEmptied: () => {
        if (resolvedWeapon) {
          weaponRuntimeRef.current = {
            ...weaponRuntimeRef.current,
            magazineEmptiedThisCombat: true,
          };
        }
      },
      onSlipshotResolved: () => {
        /* charge already written on classState */
      },
      onLastWordSynchronousKill: () => {
        if (classCombatRef.current.lastWordApRefundUsedThisPlayerTurn) return;
        classCombatRef.current.lastWordApRefundUsedThisPlayerTurn = true;
        const next = Math.min(
          PLAYER_ACTION_POINTS_PER_TURN + (combatBuffRef.current.bonusApThisTurn ?? 0),
          playerApRef.current + 1,
        );
        if (next > playerApRef.current) {
          playerApRef.current = next;
          setPlayerActionPoints(playerApRef.current);
          log('[LAST WORD] >> Lethal confirmation — +1 AP refunded.');
        }
      },
    });
    if (!result.ok) {
      playerApRef.current += result.refundAp;
      setPlayerActionPoints(playerApRef.current);
      activeClassGraftPlanRef.current = null;
      return;
    }
    if (abilityUsesBallisticTags(actionId)) {
      maybePromptReloadAfterBallistic();
    }
    activeClassGraftPlanRef.current = null;
    if (actionId === 'CONTACT_FRONT') clearAegisDualTargets();
    // Clear FS / Suppressed if tracked units died during the action.
    const fsId = classCombatRef.current.firingSolutionUnitId;
    if (fsId) {
      const live = getUnitById(squadRef.current, fsId);
      if (!live || !isUnitAlive(live)) {
        const cleared = clearHexFiringSolutionIfUnit({
          firingSolutionUnitId: classCombatRef.current.firingSolutionUnitId,
          firingSolutionExpiresAfterPlayerTurn: classCombatRef.current.firingSolutionExpiresAfterPlayerTurn,
        }, fsId);
        classCombatRef.current.firingSolutionUnitId = cleared.firingSolutionUnitId;
        classCombatRef.current.firingSolutionExpiresAfterPlayerTurn =
          cleared.firingSolutionExpiresAfterPlayerTurn;
      }
    }
    const suppressedId = classCombatRef.current.carbineSuppressedUnitId;
    if (suppressedId) {
      const live = getUnitById(squadRef.current, suppressedId);
      if (!live || !isUnitAlive(live)) {
        const cleared = clearHexCarbineSuppressedIfUnit({
          carbineSuppressedUnitId: classCombatRef.current.carbineSuppressedUnitId,
          carbineSuppressedAppliedThisAction: classCombatRef.current.carbineSuppressedAppliedThisAction,
        }, suppressedId);
        classCombatRef.current.carbineSuppressedUnitId = cleared.carbineSuppressedUnitId;
        classCombatRef.current.carbineSuppressedAppliedThisAction =
          cleared.carbineSuppressedAppliedThisAction;
      }
    }
    // Kill attribution already handled; keep squad publish.
    void squadBefore;
    publishSquadUi(squadRef.current);
  };

  const executeEnvoyWeaponActionClassAbility = (actionId: EnvoyWeaponActionId) => {
    if (cycleState !== 'TEXT_COMBAT' || !canPlayerCommand()) return;
    if (!isEnvoyWeaponActionLiveExecutable(activeWeaponFamilyId, actionId)) {
      log('[REJECTED] >> Weapon action unavailable for equipped family.');
      return;
    }
    const def = getEnvoyWeaponActionDefinition(actionId);
    if (!def) {
      log('[REJECTED] >> Weapon action not implemented.');
      return;
    }
    const graftId = envoyAbilityGraftsRef.current[actionId as EnvoyAbilityId];
    const graftPlan = buildClassGraftCastPlan('ENVOY', actionId, graftId);
    activeClassGraftPlanRef.current = graftPlan;
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
      actionId as EnvoyAbilityId,
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
    lastPlayerAbilityRef.current = actionId;
    if (!activeWeaponFamilyId || !isEnvoyWeaponFamilyId(activeWeaponFamilyId)) {
      log('[REJECTED] >> Equipped Envoy family unavailable.');
      playerApRef.current += apSpent;
      setPlayerActionPoints(playerApRef.current);
      activeClassGraftPlanRef.current = null;
      return;
    }
    const dual = dualTargetIdsRef.current;
    const secondaryTargetId = actionId === 'GRAVE_TRANSFER'
      && dual[0]
      && dual[1]
      && dual[0] !== dual[1]
      ? dual[1]
      : null;
    const primaryTargetId = actionId === 'GRAVE_TRANSFER'
      ? (dual[0] ?? selectedTargetIdRef.current)
      : selectedTargetIdRef.current;
    const envoyHurt = buildEnvoyHurtEnemy();
    let result: ReturnType<typeof executeEnvoyWeaponAction>;
    try {
      result = executeEnvoyWeaponAction({
        actionId,
        familyId: activeWeaponFamilyId,
        squad: squadRef.current,
        targetId: primaryTargetId,
        secondaryTargetId,
        veilFlux: veilFluxRef.current,
        maxHp: maxSoulAnchor,
        operativeHp: operativeHpRef.current,
        classState: classCombatRef.current,
        graftPlan,
        log,
        resolvedWeapon,
        weaponRuntime: weaponRuntimeRef.current,
        sessionExtras: sessionExtrasRef.current,
        resolveCatalyst: true,
        spendStamina: spendStam,
        applyHpSacrifice: (amount) => {
          if (amount <= 0) return;
          setOperativeHp((p) => {
            const n = Math.max(1, p - amount);
            operativeHpRef.current = n;
            return n;
          });
        },
        applyVeilFluxBonus: (delta) => applyVeilFlux(delta),
        applyWeaponRuntimePatch,
        hurtEnemy: (raw, tag, options, targetId) => envoyHurt(
          raw,
          tag,
          {
            channel: options?.channel,
            targetId: options?.targetId,
            abilityId: options?.abilityId as EnvoyAbilityId | undefined,
            rollCrit: options?.rollCrit,
          },
          targetId,
        ),
        patchUnit,
        healOperative: (amount) => {
          applyHealRef.current(amount);
        },
        applyPlayerShield: (amount) => {
          sessionExtrasRef.current.playerShield =
            (sessionExtrasRef.current.playerShield ?? 0) + amount;
        },
      });
    } catch (err) {
      playerApRef.current += apSpent;
      setPlayerActionPoints(playerApRef.current);
      activeClassGraftPlanRef.current = null;
      if (actionId === 'GRAVE_TRANSFER') clearAegisDualTargets();
      log(`[REJECTED] >> Weapon action failed — ${err instanceof Error ? err.message : 'unknown error'}.`);
      return;
    }
    if (!result.ok) {
      playerApRef.current += result.refundAp;
      setPlayerActionPoints(playerApRef.current);
      activeClassGraftPlanRef.current = null;
      if (result.message) log(`[REJECTED] >> ${result.message}`);
      if (actionId === 'GRAVE_TRANSFER') clearAegisDualTargets();
      return;
    }
    // Pose even when the packet was fully mitigated — WA casts must read as swings.
    if (actionId !== 'CRIMSON_VENT') {
      const poseTarget = primaryTargetId
        ? getUnitById(squadRef.current, primaryTargetId)
        : enemyRef.current;
      triggerPlayerAttackPose(poseTarget);
    }
    if (result.catalyst?.primed) {
      classLoopTelemetryRef.current.catalystsPrimed += 1;
      if (result.catalyst.previous) {
        classLoopTelemetryRef.current.catalystSequencesTriggered += 1;
      }
      if (result.catalyst.payoff?.extraWardBreak) {
        classLoopTelemetryRef.current.wardsBroken += result.catalyst.payoff.extraWardBreak;
      }
      if (result.catalyst.payoff?.fractureTarget) {
        classLoopTelemetryRef.current.fracturesAppliedByClass += 1;
      }
      if (result.catalyst.previous && result.catalyst.payoff?.logMessages.length) {
        emitJuice('ENVOY_CATALYST_RESONANCE', {
          text: result.catalyst.payoff.logMessages[0],
        });
      }
    }
    let fluxDelta = result.fluxDelta;
    fluxDelta = runEnvoyOnAbilityResolveBoons({
      boons: envoyBoons,
      abilityId: actionId as EnvoyAbilityId,
      ok: true,
      squad: squadRef.current,
      targetId: primaryTargetId,
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
          abilityId: actionId as AegisAbilityId,
          rollCrit: false,
          echoHit: true,
        });
      },
    });
    if (fluxDelta !== 0) applyVeilFlux(fluxDelta);
    activeClassGraftPlanRef.current = null;
    if (actionId === 'GRAVE_TRANSFER') clearAegisDualTargets();
    publishSquadUi(squadRef.current);
  };

  const executeOperativeAbility = (abilityId: string) => {
    const familyId = normalizeWeaponFamilyId(activeWeaponFamilyId) ?? 'aegis-longsword';
    nineStrainBridgeRef.current.beginRootAttempt({
      actionId: abilityId,
      classId: operativeClass,
      weaponFamilyId: familyId,
    });
    try {
      if (operativeClass === 'HEX_SHOT') {
        if (isDefinedHexWeaponActionId(abilityId)) {
          executeHexWeaponActionClassAbility(abilityId);
          return;
        }
        executeHexShotClassAbility(abilityId as HexShotAbilityId);
        return;
      }
      if (operativeClass === 'ENVOY') {
        if (isEnvoyWeaponActionId(abilityId)) {
          executeEnvoyWeaponActionClassAbility(abilityId);
          return;
        }
        executeEnvoyClassAbility(abilityId as EnvoyAbilityId);
        return;
      }
      if (isAegisWeaponActionCatalogId(abilityId)) {
        executeAegisWeaponAction(abilityId);
        return;
      }
      executeAbility(abilityId as AegisAbilityId);
    } finally {
      nineStrainBridgeRef.current.finishRootAttempt();
    }
  };
  executeOperativeAbilityRef.current = executeOperativeAbility;

  const executeAbility = (abilityId: AegisAbilityId) => {
    if (cycleState !== 'TEXT_COMBAT' || !canPlayerCommand() || !enemyRef.current) return;
    // Phase C: displayed ID === executor ID (no remaps / substitutes).
    const execAbilityId: AegisAbilityId = abilityId;
    if (
      execAbilityId === 'STRIKE'
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
      && getAbilityTags(execAbilityId).includes('ULTIMATE')
    ) {
      log('[REJECTED] >> Ultimate channel unavailable for this encounter.');
      return;
    }
    if (
      hasStructuredDebuff(sessionExtrasRef.current, 'ASHEN_ROT')
      && isBuffOrDefendAbility(execAbilityId)
    ) {
      const rotCost = 50;
      applyStamina(Math.max(0, staminaRef.current - rotCost));
      log(`>> ROT TRIGGERED! −${rotCost} Stamina`);
    }
    const def = getAbilityDefinition(execAbilityId);
    const graftId = resolveAegisAbilityGraftId(abilityGraftsRef.current, abilityId);
    const graftPlan = buildGraftCastPlan(execAbilityId, graftId);
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

    // Phase C: validate technique gates before any resource commitment.
    if (isAegisTechniqueId(execAbilityId)) {
      const loadoutTechs = aegisCombatSurface?.techniques ?? DEFAULT_AEGIS_TECHNIQUE_LOADOUT;
      const target = selectedTargetIdRef.current
        ? getUnitById(squadRef.current, selectedTargetIdRef.current)
        : null;
      const earlyValidate = validateTechniqueCommitment({
        techniqueId: execAbilityId,
        loadout: loadoutTechs,
        state: {
          ap: playerApRef.current,
          brands: classCombatRef.current.runicBrands,
          operativeHp: operativeHpRef.current,
          maxSoulAnchor,
        },
        target: target ?? null,
        demonLungCooldown: combatBuffRef.current.demonLungCooldown,
        hpCostPctOverride: execAbilityId === 'CRIMSON_PACT'
          ? readUniversalUpgradeValue(
            graftPlan,
            'HP_COST_PERCENT',
            mutationModsRef.current.crimsonPactHpCostPct ?? def.hpCostPct ?? 12,
          )
          : undefined,
      });
      if (!earlyValidate.ok) {
        log(`[REJECTED] >> ${earlyValidate.reason}`);
        activeGraftPlanRef.current = null;
        return;
      }
      // Graft brand tax stacks with technique Brand cost.
      const techBrandNeed = earlyValidate.costs.brandsToSpend;
      if (
        graftPlan.brandTax > 0
        && classCombatRef.current.runicBrands < techBrandNeed + graftPlan.brandTax
      ) {
        log(`[REJECTED] >> Graft requires ${graftPlan.brandTax} additional Runic Brand(s).`);
        activeGraftPlanRef.current = null;
        return;
      }
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

    if (graftPlan.evadeBuffPct > 0) {
      combatChanceRef.current.shadowStepEvadeActive = true;
      log(`>> [${graftPlan.graftName.toUpperCase()}] — +${graftPlan.evadeBuffPct}% evade until next turn.`);
    }
    if (graftPlan.cooldownTurns > 0) {
      graftCooldownsRef.current[abilityId] = graftPlan.cooldownTurns;
    }

    const squadBeforeAbility = squadRef.current.map((unit) => ({ ...unit, currentHp: unit.currentHp }));
    applyAbilityResolvedBoons(abilityId);

    const runtimeAbilityId = toRuntimeClassBasicId(execAbilityId, activeWeaponFamilyId);
    const equippedAnchor = activeWeaponFamilyId
      ? getWeaponAnchorAttack(activeWeaponFamilyId)
      : null;

    const rollbackTechniqueCommit = (snapshot: TechniqueCommitSnapshot) => {
      playerApRef.current += snapshot.apSpent;
      setPlayerActionPoints(playerApRef.current);
      setRunicBrandCount(snapshot.brandsBefore);
      if (snapshot.hpSpent > 0) {
        setOperativeHp(() => {
          operativeHpRef.current = snapshot.hpBefore;
          return snapshot.hpBefore;
        });
      }
    };

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
        crimsonPactConsumedActionRef.current = null;
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
        // Phase C: legacy STRIKE never imprints Brands.
        if (struck && fractureRatio(struck) > 0.5) {
          syncEnemy(addCombatTag(struck, 'CONCUSSED'));
        }
        applyLethalRetaliation(kinetic);
        if (eradicated) return;
        break;
      }
      case 'WRAITH_PARRY':
        log('[REJECTED] >> Void Ward is primed via [ PARRY ] — remove Wraith Parry from loadout.');
        playerApRef.current += def.apCost;
        setPlayerActionPoints(playerApRef.current);
        return;
      case 'RUIN':
      case 'VEIL_PIERCER':
      case 'GRAVE_BIND':
      case 'SHADOW_STEP':
      case 'NAIL_TO_GRID':
      case 'ASHEN_MANTLE':
      case 'DEMONS_LUNG':
      case 'CRIMSON_PACT':
      case 'DEVASTATE':
      case 'FINAL_MERCY':
      case 'RUNEBOUND_CARAPACE':
      case 'REAVE': {
        if (!isAegisTechniqueId(execAbilityId)) {
          log('[REJECTED] >> Ability not available.');
          playerApRef.current += apCost;
          setPlayerActionPoints(playerApRef.current);
          break;
        }
        const loadoutTechs = aegisCombatSurface?.techniques
          ?? DEFAULT_AEGIS_TECHNIQUE_LOADOUT;
        const target = selectedTargetIdRef.current
          ? getUnitById(squadRef.current, selectedTargetIdRef.current)
          : null;
        const hpCostOverride = execAbilityId === 'CRIMSON_PACT'
          ? readUniversalUpgradeValue(
            graftPlan,
            'HP_COST_PERCENT',
            mutationModsRef.current.crimsonPactHpCostPct ?? def.hpCostPct ?? 12,
          )
          : undefined;
        // AP already spent above — validate remaining Brand/HP/target gates against pre-AP brand pool.
        // Brands/HP commit happens here as one transaction with the already-spent AP.
        const brandsBeforeCommit = classCombatRef.current.runicBrands;
        const preValidate = validateTechniqueCommitment({
          techniqueId: execAbilityId,
          loadout: loadoutTechs,
          state: {
            ap: apCost, // already paid; use paid amount so AP check passes
            brands: brandsBeforeCommit,
            operativeHp: operativeHpRef.current,
            maxSoulAnchor,
          },
          target: target ?? null,
          demonLungCooldown: combatBuffRef.current.demonLungCooldown,
          hpCostPctOverride: hpCostOverride,
        });
        if (!preValidate.ok) {
          log(`[REJECTED] >> ${preValidate.reason}`);
          playerApRef.current += apCost;
          setPlayerActionPoints(playerApRef.current);
          activeGraftPlanRef.current = null;
          break;
        }
        const costs = resolveTechniqueResourceCosts(
          execAbilityId,
          brandsBeforeCommit,
          { hpCostPctOverride: hpCostOverride },
        );
        const originActionId = `pa-tech-${execAbilityId}-${Date.now()}`;
        crimsonPactConsumedActionRef.current = null;
        const committed = commitTechniqueResources(
          {
            ap: apCost,
            brands: brandsBeforeCommit,
            operativeHp: operativeHpRef.current,
            maxSoulAnchor,
          },
          { ...costs, apCost }, // AP already deducted; snapshot records paid AP for rollback
          originActionId,
          execAbilityId,
        );
        // AP already deducted — only apply Brand + HP from commit.
        setRunicBrandCount(committed.next.brands);
        if (committed.snapshot.hpSpent > 0) {
          setOperativeHp(() => {
            operativeHpRef.current = committed.next.operativeHp;
            return committed.next.operativeHp;
          });
          log(`>> [${def.label}] — ${committed.snapshot.hpSpent} HP committed.`);
        }
        if (committed.snapshot.brandsSpent > 0) {
          log(
            `>> [${def.label}] — ${committed.snapshot.brandsSpent} Runic Brand${committed.snapshot.brandsSpent === 1 ? '' : 's'} committed.`,
          );
        }

        const result = executeExtendedAbility({
          abilityId: execAbilityId,
          squad: squadRef.current,
          targetId: selectedTargetIdRef.current,
          strikeStats,
          stamina: staminaRef.current,
          abyssalReserve: abyssalRef.current,
          operativeHp: operativeHpRef.current,
          maxSoulAnchor,
          runicBrands: classCombatRef.current.runicBrands,
          committedBrandsSpent: committed.snapshot.brandsSpent,
          costsCommitted: true,
          buffState: combatBuffRef.current,
          graftPlan,
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
              playerActionId: originActionId,
              playerActionKind: execAbilityId,
              abilityId: opts?.abilityId ?? execAbilityId,
              rollEvade: opts?.skipEvade ? false : opts?.rollCrit === false && execAbilityId === 'FINAL_MERCY'
                ? false
                : undefined,
              ...(opts?.skipEvade ? { rollEvade: false } : {}),
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
          sacrificeHpPct: () => false, // technique HP already committed
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
          imprintBrand: () => {
            // Techniques must never imprint Brands (Phase C).
          },
          setRunicBrands: setRunicBrandCount,
          consumeBrands: () => 0, // Brands already committed
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
          activateRuneboundCarapace: (reflectDamage) => {
            runeboundCarapaceRef.current = armRuneboundCarapace(
              runeboundCarapaceRef.current,
              reflectDamage,
            );
            markPlayerDefendedRef.current();
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
          const { applied, next } = armHitAbsorbOnEncounter('JUGGERNAUT_PLATING', 1);
          if (applied) {
            log(formatHitAbsorbProtectionArmedLog('JUGGERNAUT_PLATING', next.hitsRemaining));
          }
        }
        if (abilityId === 'SHADOW_STEP' && result.ok) {
          setInitiativeQueued(combatBuffRef.current.initiativeQueued);
        }
        if (!result.ok) {
          if (result.rollbackCommit) {
            rollbackTechniqueCommit(committed.snapshot);
          } else if (result.refundAp > 0) {
            playerApRef.current += result.refundAp;
            setPlayerActionPoints(playerApRef.current);
          }
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
      log('[REJECTED] >> Ultimate channel unavailable for this encounter.');
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
      // E.1d.1: grade input first (slice / simplified), then FULL targeting confirm.
      // FULL confirmation must not itself award PERFECT.
      if (skipMinigame) {
        const staged = resolveAbyssalVerdictCommitFromGradeInput({
          simplifiedInputs: true,
          sliceDamagePenalty,
        });
        stageAbyssalVerdictGrade(staged);
        primeAbyssalVerdictRef.current();
      } else {
        triggerAbyssalVerdictSliceRef.current();
      }
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
    nineStrainBridgeRef.current.noteEvent('ULTIMATE_CANCELED', { familyId: activeWeaponFamilyId ?? 'none' });
    // Free cancel — never spends Protocol / Rot / Abyssal Reserve.
    if (abyssalVerdictPrimedRef.current) {
      setAbyssalVerdictPrimed(false);
      abyssalVerdictPrimedRef.current = false;
      setAbyssalCollapsingUnitId(null);
      abyssalCommitLockRef.current = false;
      clearAbyssalVerdictStagedGrade();
      publishSquadUiRef.current(squadRef.current);
      log(`>> [${ABYSSAL_VERDICT_DISPLAY_NAME}] >> Targeting cancelled — free. Abyssal Reserve retained.`);
      return;
    }
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
      clearAbyssalVerdictStagedGrade();
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
    // Phase C: Ultimate never clears Runic Brands.
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
        baseStrike: rendTheVeilBaseStrike(aegisUltimateStrikePower),
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
        baseStrike: gravefallBaseStrike(aegisUltimateStrikePower),
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
      // H.1a order: validate → spend Protocol once → ultimate-owned refill → shots → empty.
      // Must not invoke HEX_RESOLVE_RELOAD / ordinary reload reward hooks.
      if (!primary?.unitId) {
        log(`${tag} >> No target — channel collapses.`);
        return;
      }
      spendHexProtocolCharges();
      const plan = planSixthSeal({
        grade: resolvedGrade,
        magSize: Math.max(1, hexShotStateRef.current.maxAmmo),
      });
      const ammoType = hexShotStateRef.current.currentAmmoType;
      dispatchHexShot({ type: 'HEX_ULTIMATE_OWNED_MAGAZINE_REFILL' });
      nineStrainBridgeRef.current.markUltimateOwnedRefill();
      log(`>> ${tag} >> Cylinder sealed — ultimate-owned ${plan.reloadQuality.toLowerCase()} refill (${ammoType}).`);
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
          abilityId: hookAbilityId as EnvoyAbilityId | undefined,
        rollCrit: false,
        }, unit.unitId);
        const lantern = resolveLanternFluxPurgePayoff({
          familyId: 'envoy-vambrace',
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
              abilityId: hookAbilityId as EnvoyAbilityId | undefined,
        rollCrit: false,
            }, unit.unitId);
          }
          consumeVeilRotStacks(classCombatRef.current, unit.unitId, lantern.rotConsume);
          lantern.logLines.forEach((line) => log(
            line.replace('ECHO LANTERN', 'FUNERAL KNOT').replace('VAMBRACE', 'FUNERAL KNOT'),
          ));
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
          abilityId: hookAbilityId as EnvoyAbilityId | undefined,
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
      log('[REJECTED] >> Ultimate channel unavailable for this encounter.');
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
    if (aegisWeaponCombatRef.current.committed) {
      log('[REJECTED] >> Committed — Parry and Evade suppressed.');
      return;
    }
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
    const ammoBeforeReload = currentAmmoRef.current;
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
    // Phase H.1a — class-wide Chamber +15% retired. Sanitize any mirrored stale flag.
    classCombatRef.current.chamberBonusReady = false;
    dispatchHexShot({
      type: 'HEX_RESOLVE_RELOAD',
      quality,
      ammoType,
      encounter: classCombatRef.current,
      squad: squadRef.current,
      deadMansSwitchBlocksOvercharge: deadMansBlocksOvercharge,
    });
    nineStrainBridgeRef.current.noteInstinct({
      classId: 'HEX_SHOT',
      reloadQuality: quality === 'PERFECT' ? 'PERFECT' : quality === 'CLEAN' ? 'CLEAN' : 'FAILED',
    });
    nineStrainBridgeRef.current.noteCurrent({
      classId: 'HEX_SHOT',
      reloadRestoredRounds: true,
      ammoCycleCompleted: true,
      perfectReload: quality === 'PERFECT',
    });
    // W.4 — Deadbolt opportunity arms only after completed Phase-Shift Reload restores rounds.
    {
      const roundsRestored = Math.max(0, maxAmmo - ammoBeforeReload);
      const nextOpp = armHexDeadboltReloadOpportunity({
        deadboltReloadOpportunity: classCombatRef.current.deadboltReloadOpportunity,
      }, {
        familyId: resolvedWeapon?.familyId,
        roundsRestored,
      });
      if (nextOpp.deadboltReloadOpportunity && !classCombatRef.current.deadboltReloadOpportunity) {
        log('[DEADBOLT] >> Reload opportunity primed.');
      }
      classCombatRef.current.deadboltReloadOpportunity = nextOpp.deadboltReloadOpportunity;
    }
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
        resolvedWeapon.familyId === 'hex-revolver'
        || resolvedWeapon.familyId === 'hex-shotgun'
        || resolvedWeapon.familyId === 'hex-carbine'
      )
    ) {
      const reloadCue = resolvedWeapon.familyId === 'hex-revolver'
        ? 'sfx.revolver.reload_sacrifice'
        : resolvedWeapon.familyId === 'hex-shotgun'
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
        if (operativeClass === 'AEGIS') {
          let ws = aegisWeaponCombatRef.current;
          const attackerId = e.unitId;
          const bound = attackerId ? ws.dreadboundByUnitId[attackerId] : undefined;
          if (bound && attackerId && !bound.masteryAwarded) {
            ws = markDreadboundMastery(ws, attackerId);
            imprintRunicBrand(1);
            const fracturedAttacker = applyFractureDamage(
              withFracturePayoff,
              DREADBIND_MASTERY_FRACTURE,
            );
            patchUnit(attackerId, fracturedAttacker);
            ws = clearDreadbound(ws, attackerId);
            log(`[DREADBIND] >> Perfect Parry mastery — +${DREADBIND_MASTERY_FRACTURE} Fracture, 1 Brand.`);
          } else if (bound && attackerId) {
            ws = clearDreadbound(ws, attackerId);
          }
          if (ws.eclipseActive) {
            ws = armAegisTempo(
              clearEclipse(ws),
              Math.max(1, balanceEncounterRef.current.playerTurns),
            );
            imprintRunicBrand(1);
            log('[ECLIPSE] >> Perfect Parry — Tempo armed, 1 Brand.');
          } else if (
            !bound
            && resolvedWeapon?.familyId === 'aegis-paired-blades'
          ) {
            weaponRuntimeRef.current = armRiftEdgeTempo(weaponRuntimeRef.current);
            log('[RIFT EDGE] >> Tempo armed — next basic carries Occult rider.');
          }
          aegisWeaponCombatRef.current = ws;
          syncAegisTempoPresentation(ws);
        } else if (resolvedWeapon?.familyId === 'aegis-paired-blades') {
          weaponRuntimeRef.current = armRiftEdgeTempo(weaponRuntimeRef.current);
          log('[RIFT EDGE] >> Tempo armed — next basic carries Occult rider.');
        }
        classLoopTelemetryRef.current.parriesSuccessful += 1;
        classLoopTelemetryRef.current.perfectParries += 1;
        classLoopTelemetryRef.current.damagePreventedByParry += pendingWeight;
        classLoopTelemetryRef.current.fracturesAppliedByClass += 1;
        emitJuice('PERFECT_PARRY', { text: 'PERFECT PARRY — RIPOSTE READY' });
        nineStrainBridgeRef.current.noteInstinct({
          classId: 'AEGIS',
          perfectParry: true,
          parryAttempted: true,
        });
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
      log(`[VOID WARD] >> +${VOID_WARD_PERFECT_RESERVE_GAIN}% Reserve.`);
      runOnParryPerfect(buildAegisBoonHookCtx());
      hideParryOverlay();
      startParrySuccessBurst(() => {
        endEnemyTurn();
      });
      return;
    }
    hideParryOverlay();
    runOnParryFail(buildAegisBoonHookCtx());
    nineStrainBridgeRef.current.noteInstinct({
      classId: 'AEGIS',
      parryAttempted: true,
    });
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

    // E.1d.1: aftermath is action-level — reset once-per-commit guard before damage.
    abyssalAftermathFinalizedRef.current = false;
    clearAbyssalVerdictStagedGrade();

    if (!useCinematic) {
      triggerPlayerAttackPose(input.targetHint ?? enemyRef.current);
      const eradicated = hurtEnemy(input.dmg, `[${ABYSSAL_VERDICT_DISPLAY_NAME}]`, 'EVISCERATE', {
        channel: 'TRUE',
        abilityId: 'EVISCERATE',
        actionKind: 'ULTIMATE',
        targetId: resolvedTargetId ?? undefined,
        rollEvade: false,
      });
      // Mandatory finalization — lethal and nonlethal share one path.
      finalizeAbyssalVerdictAftermath();
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
    // Reserve flush / brands once at commit — not again at impact; not gated on survival.
    finalizeAbyssalVerdictAftermath();
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
      clearAbyssalVerdictStagedGrade();
      log(`>> [${ABYSSAL_VERDICT_DISPLAY_NAME}] >> Aperture closed — no traces locked. Abyssal Reserve retained.`);
      return;
    }
    // E.1d.1: stage authoritative grade, then FULL targeting confirm (do not commit yet).
    const staged = resolveAbyssalVerdictCommitFromGradeInput({
      hitCount: s.hitCount,
      sliceDamagePenalty,
    });
    stageAbyssalVerdictGrade(staged);
    cycleRef.current = 'TEXT_COMBAT';
    setCycleState('TEXT_COMBAT');
    combatPausedRef.current = false;
    log(
      staged.grade === 'PERFECT'
        ? `[${ABYSSAL_VERDICT_DISPLAY_NAME}] >> PERFECT [3/3] locked — ${staged.damage} True. Select target.`
        : `[${ABYSSAL_VERDICT_DISPLAY_NAME}] >> ${staged.grade} [${staged.hits}/3] locked — ${staged.damage} True. Select target.`,
    );
    primeAbyssalVerdictRef.current();
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
    const staged = resolveAbyssalVerdictCommitFromGradeInput({
      simplifiedInputs: true,
      sliceDamagePenalty,
    });
    stageAbyssalVerdictGrade(staged);
    log(`[${ABYSSAL_VERDICT_DISPLAY_NAME}] >> STANDARD simplified — ${staged.damage} True. Select target.`);
    primeAbyssalVerdictRef.current();
  };

  const abyssalVerdictCanInteract = isPlayerTurn
    && cycleState === 'TEXT_COMBAT'
    && !isExhausted
    && !combatPausedRef.current
    && stagedWeaponUltimateId == null
    && !zeroProtocolVisible
    && !cataclysmSigilVisible
    && !encounterUltimateDisabled;

  const primeAbyssalVerdict = useCallback(() => {
    if (!sliceReady) return;
    if (!(
      isPlayerTurn
      && cycleState === 'TEXT_COMBAT'
      && !isExhausted
      && !combatPausedRef.current
      && stagedWeaponUltimateId == null
      && !zeroProtocolVisible
      && !cataclysmSigilVisible
      && !encounterUltimateDisabled
    )) {
      return;
    }
    if (abyssalVerdictPrimedRef.current) return;
    // E.1d.1 — targeting (FULL confirm) requires a resolved grade first.
    if (!abyssalStagedCommitRef.current) {
      const inputMode = resolveWeaponUltimateInputMode({
        simplifiedUltimateInputs: simplifiedUltimateInputs === true,
      });
      if (shouldSkipUltimateMinigame(inputMode)) {
        stageAbyssalVerdictGrade(resolveAbyssalVerdictCommitFromGradeInput({
          simplifiedInputs: true,
          sliceDamagePenalty,
        }));
      } else {
        triggerAbyssalVerdictSliceRef.current();
        return;
      }
    }
    // Mutual exclusion with staged abilities — same as arming any other ability.
    if (selectedAbilityRef.current) {
      selectedAbilityRef.current = null;
      setSelectedAbility(null);
    }
    setAbyssalVerdictPrimed(true);
    abyssalVerdictPrimedRef.current = true;
    publishSquadUiRef.current(squadRef.current);
  }, [
    cataclysmSigilVisible,
    cycleState,
    encounterUltimateDisabled,
    isExhausted,
    isPlayerTurn,
    simplifiedUltimateInputs,
    sliceDamagePenalty,
    sliceReady,
    stagedWeaponUltimateId,
    zeroProtocolVisible,
  ]);

  const commitAbyssalVerdictOnTarget = useCallback((unitId: string) => {
    if (abyssalCommitLockRef.current) return;
    if (!sliceReady || !abyssalVerdictPrimedRef.current) return;
    if (!canPlayerCommand()) return;
    const staged = abyssalStagedCommitRef.current;
    // FULL targeting confirm requires a previously resolved grade (slice / simplified).
    if (!staged) {
      log(`[REJECTED] >> ${ABYSSAL_VERDICT_DISPLAY_NAME} — grade not locked.`);
      return;
    }
    const unit = getUnitById(squadRef.current, unitId);
    if (
      !unit
      || !isAbyssalVerdictEnemyEligible({
        alive: isUnitAlive(unit),
        dissolveHidden: dissolvedHiddenRef.current.has(unitId),
      })
    ) {
      return;
    }

    abyssalCommitLockRef.current = true;
    abyssalCollapsingUnitIdRef.current = unitId;
    setAbyssalCollapsingUnitId(unitId);
    publishSquadUiRef.current(squadRef.current);

    const finish = () => {
      setAbyssalVerdictPrimed(false);
      abyssalVerdictPrimedRef.current = false;
      abyssalCollapsingUnitIdRef.current = null;
      setAbyssalCollapsingUnitId(null);
      selectedTargetIdRef.current = unitId;
      setSelectedTargetId(unitId);
      focusedUnitIdRef.current = unitId;
      enemyRef.current = unit;
      setEnemy(unit);
      setEviscerateTargetUnitId(unitId);

      const committed = abyssalStagedCommitRef.current ?? staged;
      log(
        committed.grade === 'PERFECT'
          ? `[${ABYSSAL_VERDICT_DISPLAY_NAME}] >> PERFECT [3/3] — ${committed.damage} damage.`
          : `[${ABYSSAL_VERDICT_DISPLAY_NAME}] >> ${committed.grade} [${committed.hits}/3] — ${committed.damage} damage.`,
      );
      commitAbyssalVerdictDamage({
        dmg: committed.damage,
        gradeLabel: committed.grade,
        targetHint: unit,
      });
      abyssalCommitLockRef.current = false;
    };

    const collapseMs = getCombatPresentationSettings().reducedMotion
      ? 0
      : ABYSSAL_VERDICT_BRACKET_COLLAPSE_MS;
    if (collapseMs <= 0) {
      finish();
      return;
    }
    setTimeout(finish, collapseMs);
  }, [
    log,
    sliceReady,
  ]);

  commitAbyssalVerdictOnTargetRef.current = commitAbyssalVerdictOnTarget;
  primeAbyssalVerdictRef.current = primeAbyssalVerdict;

  const consoleUltimatePrimed = abyssalVerdictPrimed
    || zeroProtocolVisible
    || cataclysmSigilVisible
    || stagedWeaponUltimateId != null;
  const consoleUltimateMeter = (() => {
    if (operativeClass === 'HEX_SHOT') {
      return {
        reserve: hexShotState.protocolCharges,
        cap: Math.max(1, hexShotState.maxProtocolCharges),
      };
    }
    if (operativeClass === 'ENVOY') {
      return {
        reserve: Math.min(envoyRotStacksUi, CATACLYSM_ROT_GATE),
        cap: CATACLYSM_ROT_GATE,
      };
    }
    return {
      reserve: abyssalReserve,
      cap: COMBAT_ACTION.ABYSSAL_RESERVE_CAP,
    };
  })();

  useEffect(() => {
    if (!onAbyssalVerdictUiChange) return;
    const settings = getCombatPresentationSettings();
    const snapshot: AbyssalVerdictHudSnapshot = {
      state: resolveAbyssalVerdictPresentationState({
        ultimateReady: consoleUltimateReady,
        primed: consoleUltimatePrimed,
      }),
      reserve: consoleUltimateMeter.reserve,
      cap: consoleUltimateMeter.cap,
      notifySeq: abyssalReadyNotifySeq,
      canInteract: abyssalVerdictCanInteract,
      collapsingUnitId: abyssalCollapsingUnitId,
      reducedMotion: settings.reducedMotion === true,
      stagedGrade: abyssalStagedCommit?.grade ?? null,
      stagedDamage: abyssalStagedCommit?.damage ?? null,
      displayName: activeUltimateRecord?.displayName ?? 'ULTIMATE',
      meterHeader: resolveConsoleUltimateMeterHeader(operativeClass),
    };
    onAbyssalVerdictUiChange(snapshot);
  }, [
    abyssalCollapsingUnitId,
    abyssalReadyNotifySeq,
    abyssalStagedCommit,
    abyssalVerdictCanInteract,
    activeUltimateRecord?.displayName,
    consoleUltimateMeter.cap,
    consoleUltimateMeter.reserve,
    consoleUltimatePrimed,
    consoleUltimateReady,
    onAbyssalVerdictUiChange,
    operativeClass,
  ]);

  useEffect(() => {
    if (!registerAbyssalVerdictHandlers) return;
    registerAbyssalVerdictHandlers({
      prime: onUltimatePing,
      cancel: cancelWeaponUltimateInteraction,
    });
  });

  // Unmount-only cleanup — must NOT depend on inline CombatScreen callbacks
  // (new identity every render was wiping the console ultimate snapshot).
  useEffect(() => () => {
    abyssalVerdictPrimedRef.current = false;
    abyssalCollapsingUnitIdRef.current = null;
    abyssalCommitLockRef.current = false;
    registerAbyssalVerdictHandlers?.(null);
    onAbyssalVerdictUiChange?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount only
  }, []);

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
  triggerAbyssalVerdictSliceRef.current = triggerSlice;
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
    const aegisOpts = operativeClass === 'AEGIS' && isAegisWeaponActionCatalogId(abilityId)
      ? aegisTargetOpts()
      : undefined;
    const cost = resolveClassAbilityCost(operativeClass, abilityId, aegisOpts);
    const ultimateSealed = encounterUltimateDisabled
      || (operativeClass === 'HEX_SHOT'
        ? isClassUltimateDisabledForEncounter('HEX_SHOT', hexShotAbilityGraftsRef.current, {}, false)
        : operativeClass === 'ENVOY'
          ? isClassUltimateDisabledForEncounter('ENVOY', {}, envoyAbilityGraftsRef.current, false)
          : false);
    if (ultimateSealed && cost.isUltimate) return false;
    if (operativeClass === 'HEX_SHOT') {
      if (isDefinedHexWeaponActionId(abilityId)) {
        if (!isHexWeaponActionExecutable(activeWeaponFamilyId, abilityId)) return false;
        return isHexWeaponActionEnabled(
          abilityId,
          currentAmmo,
          maxAmmo,
          playerActionPoints,
          {
            stamina,
            thresholdArmed: classCombatRef.current.thresholdArmed,
          },
        );
      }
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
        { current: operativeHpRef.current, max: getEffectiveMaxSoulAnchor() },
        readUniversalUpgradeValue(graftPlan, 'STAMINA_COST', cost.staminaCost),
      );
    }
    if (operativeClass === 'ENVOY') {
      if (isEnvoyWeaponActionId(abilityId)) {
        if (!isEnvoyWeaponActionLiveExecutable(activeWeaponFamilyId, abilityId)) return false;
        const wa = getEnvoyWeaponActionDefinition(abilityId);
        if (!wa) return false;
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
        if (wa.staminaCost > 0 && stamina < wa.staminaCost) return false;
        if (wa.fluxCost > 0 && veilFlux < wa.fluxCost) return false;
        return true;
      }
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
    const aegisOpts = operativeClass === 'AEGIS' && isAegisWeaponActionCatalogId(abilityId)
      ? aegisTargetOpts()
      : undefined;
    const cost = resolveClassAbilityCost(operativeClass, abilityId, aegisOpts);
    const ultimateSealed = encounterUltimateDisabled
      || (operativeClass === 'HEX_SHOT'
        ? isClassUltimateDisabledForEncounter('HEX_SHOT', hexShotAbilityGraftsRef.current, {}, false)
        : operativeClass === 'ENVOY'
          ? isClassUltimateDisabledForEncounter('ENVOY', {}, envoyAbilityGraftsRef.current, false)
          : false);
    if (ultimateSealed && cost.isUltimate) {
      return 'Ultimate channel unavailable for this encounter.';
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
    if (isAegisWeaponActionCatalogId(abilityId)) {
      const ws = aegisWeaponCombatRef.current;
      const weaponOpts = { doomfallReleaseAvailable: ws.doomfallReleaseAvailable };
      const apCost = aegisWeaponActionApCost(abilityId, weaponOpts);
      if (playerActionPoints < apCost) {
        return `Requires ${apCost} AP (have ${playerActionPoints}).`;
      }
      if (abilityId === 'DOOMFALL') {
        if (ws.committed && !ws.doomfallReleaseAvailable) {
          return 'Doomfall Charge committed — Release next turn.';
        }
        if (ws.doomfallReleaseAvailable) {
          const valid = validTargetsForAbility(squadRef.current, abilityId, weaponOpts);
          if (valid.length === 0) return 'No valid Release target.';
        }
      }
      return 'Ability unavailable.';
    }
    const jammedSlots = sessionExtrasRef.current.jammedAugmentSlots?.length
      ? sessionExtrasRef.current.jammedAugmentSlots
      : sessionExtrasRef.current.jammedAugmentSlot != null
        ? [sessionExtrasRef.current.jammedAugmentSlot]
        : [];
    const graftPlan = buildGraftCastPlan(
      abilityId as AegisAbilityId,
      resolveAegisAbilityGraftId(abilityGraftsRef.current, abilityId),
    );
    return getAegisAbilityDisableReason(abilityId as AegisAbilityId, {
      isPlayerTurn,
      cycleState,
      shadowstepProc: shadowstepProcRef.current,
      encounterUltimateDisabled,
      playerAp: playerActionPoints,
      graftPlan,
      graftCooldown: graftCooldownsRef.current[abilityId as AegisAbilityId] ?? 0,
      jammedSlots,
      loadout: aegisCombatSurface?.hudCards ?? activeLoadout,
      rooted: hasStructuredDebuff(sessionExtrasRef.current, 'ROOTED'),
      voidWardPrimed: voidWardPrimedRef.current,
      abyssalReserve,
      operativeHp,
      maxSoulAnchor,
      runicBrands,
      buffState: combatBuffRef.current,
      ashenMantleCooldown: mutationEncounterRef.current.ashenMantleCooldown,
      ashenMantleFree: mutationModsRef.current.ashenMantleFree,
      target: selectedTargetIdRef.current
        ? getUnitById(squadRef.current, selectedTargetIdRef.current)
        : (enemyRef.current ?? null),
      hpCostPct: abilityId === 'CRIMSON_PACT'
        ? readUniversalUpgradeValue(
          graftPlan,
          'HP_COST_PERCENT',
          mutationModsRef.current.crimsonPactHpCostPct ?? 12,
        )
        : undefined,
    });
  };

  const isAbilityEnabled = (abilityId: AegisAbilityId): boolean => {
    if (!isPlayerTurn || cycleState !== 'TEXT_COMBAT' || shadowstepProcRef.current) return false;
    if (isAegisWeaponActionCatalogId(abilityId)) {
      const ws = aegisWeaponCombatRef.current;
      const opts = { doomfallReleaseAvailable: ws.doomfallReleaseAvailable };
      const waGraft = ws.doomfallReleaseAvailable && abilityId === 'DOOMFALL'
        ? doomfallGraftPlanRef.current
        : buildWeaponActionGraftCastPlan(
          abilityId,
          resolveAegisAbilityGraftId(abilityGraftsRef.current, abilityId),
          opts,
        );
      const waAp = waGraft?.graftName
        ? (abilityId === 'DOOMFALL' && ws.doomfallReleaseAvailable
          ? aegisWeaponActionApCost(abilityId, opts)
          : waGraft.apCost)
        : aegisWeaponActionApCost(abilityId, opts);
      if (playerActionPoints < waAp) return false;
      if (waGraft?.graftName && !(abilityId === 'DOOMFALL' && ws.doomfallReleaseAvailable)) {
        if (!canAffordGraftResources(waGraft, abyssalReserve, runicBrands).ok) return false;
      }
      if (abilityId === 'DOOMFALL') {
        if (ws.committed && !ws.doomfallReleaseAvailable) return false;
        if (ws.doomfallReleaseAvailable) {
          return validTargetsForAbility(squadRef.current, abilityId, opts).length > 0;
        }
        return !ws.committed && !ws.doomfallReleaseAvailable;
      }
      return true;
    }
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
    const hudCards = aegisCombatSurface?.hudCards ?? activeLoadout;
    if (jammedSlots.some((slot) => hudCards[slot] === abilityId)) return false;
    const execCheckId: AegisAbilityId = abilityId;
    const graftPlan = buildGraftCastPlan(
      execCheckId,
      resolveAegisAbilityGraftId(abilityGraftsRef.current, abilityId),
    );
    if ((graftCooldownsRef.current[abilityId] ?? 0) > 0) return false;
    if (playerActionPoints < graftPlan.apCost) return false;
    const graftAfford = canAffordGraftResources(graftPlan, abyssalReserve, runicBrands);
    if (!graftAfford.ok) return false;
    const focusedTarget = selectedTargetIdRef.current
      ? getUnitById(squadRef.current, selectedTargetIdRef.current)
      : (enemyRef.current ?? null);
    switch (abilityId) {
      case 'STRIKE':
        return true;
      case 'WRAITH_PARRY':
        return !voidWardPrimedRef.current;
      case 'VEIL_PIERCER':
      case 'ASHEN_MANTLE':
      case 'RUIN':
      case 'GRAVE_BIND':
      case 'SHADOW_STEP':
      case 'NAIL_TO_GRID':
      case 'DEMONS_LUNG':
      case 'CRIMSON_PACT':
      case 'DEVASTATE':
      case 'FINAL_MERCY':
      case 'RUNEBOUND_CARAPACE':
      case 'REAVE':
        return isExtendedAbilityEnabled(
          execCheckId,
          stamina,
          abyssalReserve,
          operativeHp,
          maxSoulAnchor,
          combatBuffRef.current,
          runicBrands,
          {
            ashenMantleCooldown: mutationEncounterRef.current.ashenMantleCooldown,
            ashenMantleFree: mutationModsRef.current.ashenMantleFree,
            target: focusedTarget,
            hpCostPct: abilityId === 'CRIMSON_PACT'
              ? readUniversalUpgradeValue(
                graftPlan,
                'HP_COST_PERCENT',
                mutationModsRef.current.crimsonPactHpCostPct ?? 12,
              )
              : undefined,
          },
        );
      default:
        return false;
    }
  };

  const getAbilityAccent = (abilityId: string): string | undefined => {
    if (operativeClass !== 'AEGIS') return undefined;
    const aegisId = abilityId as AegisAbilityId;
    const graftId = resolveAegisAbilityGraftId(abilityGraftsRef.current, abilityId);
    if (graftId) return getUniversalGraftDefinition(graftId)?.accentColor;
    if (aegisId === 'WRAITH_PARRY' && voidWardPrimed) return P.parry;
    if (aegisId === 'ASHEN_MANTLE' && combatBuffRef.current.ashenMantleTurnsRemaining > 0) return WARD_STRIKE_ACCENT;
    return undefined;
  };

  const getStagedCostImpact = (abilityId: string): string => {
    const canonical = resolveClassAbilityCost(operativeClass, abilityId);
    const canonicalHpCostPct = operativeClass === 'AEGIS'
      ? getAbilityDefinition(abilityId as AegisAbilityId).hpCostPct ?? 0
      : 0;
    const plan = operativeClass === 'AEGIS' && isAegisTechniqueId(abilityId)
      ? buildGraftCastPlan(
        abilityId,
        resolveAegisAbilityGraftId(abilityGraftsRef.current, abilityId),
      )
      : operativeClass === 'HEX_SHOT' || operativeClass === 'ENVOY'
        ? buildClassGraftCastPlan(
          operativeClass,
          abilityId,
          operativeClass === 'HEX_SHOT'
            ? resolveHexShotAbilityGraftId(
              hexShotAbilityGraftsRef.current,
              abilityId as HexShotAbilityId,
            )
            : envoyAbilityGraftsRef.current[abilityId as EnvoyAbilityId],
        )
        : null;
    return `COST: ${formatClassAbilityCostLine(operativeClass, abilityId, {
      staminaCost: readUniversalUpgradeValue(plan, 'STAMINA_COST', canonical.staminaCost),
      fluxCost: readUniversalUpgradeValue(plan, 'FLUX_COST', canonical.fluxCost),
      hpCostPct: readUniversalUpgradeValue(plan, 'HP_COST_PERCENT', canonicalHpCostPct),
    })}`;
  };

  const getStagedAbilityDescription = (abilityId: string): string => {
    const cost = resolveClassAbilityCost(operativeClass, abilityId);
    const isHexWa = operativeClass === 'HEX_SHOT' && isDefinedHexWeaponActionId(abilityId);
    const hexPreviewPlan = operativeClass === 'HEX_SHOT' && !isHexWa
      ? buildClassGraftCastPlan(
        'HEX_SHOT',
        abilityId as HexShotAbilityId,
        resolveHexShotAbilityGraftId(hexShotAbilityGraftsRef.current, abilityId as HexShotAbilityId),
      )
      : null;
    const graftTags = hexPreviewPlan
      ? hexPreviewPlan.effectiveTags
      : isHexWa
        ? getHexWeaponActionDefinition(abilityId)?.tags
        : undefined;
    const phantomFeed = operativeClass === 'HEX_SHOT'
      && !isHexWa
      && shouldApplyPhantomFeed(abilityId as HexShotAbilityId, graftTags)
      ? 'INTRINSIC: Phantom Feed — +1 round cycled before resolve.'
      : '';
    const ammoHint = operativeClass === 'HEX_SHOT' && !isHexWa
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
    // Zero Protocol readiness (Ash Shotgun weapon ultimate — Protocol Charges gate).
    const zeroProtocolLine = operativeClass === 'HEX_SHOT'
      && abilityId === 'ZERO_PROTOCOL'
      && canFireLegacyClassUltimate('ZERO_PROTOCOL', activeWeaponFamilyId)
      ? (hexShotStateRef.current.protocolCharges >= hexShotStateRef.current.maxProtocolCharges
        ? 'ZERO PROTOCOL READY — true-damage execution using calibrated ammo.'
        : `PROTOCOL: ${hexShotStateRef.current.protocolCharges}/${hexShotStateRef.current.maxProtocolCharges} — Perfect Phase-Shift Reloads generate Protocol.`)
      : '';
    let h3bContractLine = '';
    if (operativeClass === 'HEX_SHOT') {
      if (abilityId === 'ASH_JACKET_SALVO') {
        h3bContractLine = formatAshJacketSalvoPreview();
      } else if (abilityId === 'CINDERLINE_SATURATION') {
        const tid = selectedTargetIdRef.current;
        const focal = tid ? getUnitById(squadRef.current, tid) : null;
        h3bContractLine = formatCinderlinePreview(
          focal ? resolveCinderlineSlotForUnit(focal) : null,
          readUniversalUpgradeValue(hexPreviewPlan, 'HAZARD_TICK_DAMAGE', 5),
        );
      } else if (abilityId === 'BLACKSITE_TRIAGE') {
        h3bContractLine = formatBlacksiteTriagePreview(
          operativeHpRef.current,
          getEffectiveMaxSoulAnchor(),
          readUniversalUpgradeValue(hexPreviewPlan, 'HEAL_PERCENT', 20),
        );
      } else if (abilityId === 'SIX_BELLS') {
        const rounds = previewSixBellsRounds(currentAmmoRef.current, maxAmmo);
        h3bContractLine = rounds >= 2
          ? `SIX BELLS — ${rounds} rounds × ${SIX_BELLS_PACKET_DAMAGE} authored (independent checks).`
          : 'SIX BELLS — requires ≥2 loaded rounds.';
      } else if (abilityId === 'SLIPSHOT') {
        const dmg = scaleSidearmAuthoredDamage(SLIPSHOT_BASE_DAMAGE, resolvedWeapon);
        h3bContractLine = `SLIPSHOT — ${dmg} Kinetic + Elusive (even on miss). Active charges: ${classCombatRef.current.hexElusiveCharges}.`;
      } else if (abilityId === 'LAST_WORD') {
        const dmg = scaleSidearmAuthoredDamage(LAST_WORD_BASE_DAMAGE, resolvedWeapon);
        const refundReady = !classCombatRef.current.lastWordApRefundUsedThisPlayerTurn;
        h3bContractLine = `LAST WORD — ${dmg} Kinetic vs ≤30% HP. AP refund ${refundReady ? 'available' : 'spent this turn'}.`;
      } else if (abilityId === 'QUICKDRAW') {
        h3bContractLine = 'QUICKDRAW — Sidearm fixed basic (ladder 10/11/12).';
      } else if (abilityId === 'CENTER_MASS') {
        const dmg = scaleHexWeaponAuthoredDamage(CENTER_MASS_BASE_DAMAGE, resolvedWeapon);
        const tid = selectedTargetIdRef.current;
        const fsOnTarget = hasFiringSolutionOn({
          firingSolutionUnitId: classCombatRef.current.firingSolutionUnitId,
          firingSolutionExpiresAfterPlayerTurn: classCombatRef.current.firingSolutionExpiresAfterPlayerTurn,
        }, tid);
        h3bContractLine = [
          `CENTER MASS — ${dmg} Kinetic. Establishes Firing Solution on hit.`,
          fsOnTarget ? `Tracked target: +${FIRING_SOLUTION_ACCURACY_BONUS_PCT} accuracy.` : null,
          formatFiringSolutionLifetimePreview({
            firingSolutionUnitId: classCombatRef.current.firingSolutionUnitId,
            firingSolutionExpiresAfterPlayerTurn: classCombatRef.current.firingSolutionExpiresAfterPlayerTurn,
          }, Math.max(1, balanceEncounterRef.current.playerTurns)),
        ].filter(Boolean).join(' ');
      } else if (abilityId === 'CONTROLLED_BURST') {
        const dmg = scaleHexWeaponAuthoredDamage(CONTROLLED_BURST_PACKET_DAMAGE, resolvedWeapon);
        const tid = selectedTargetIdRef.current;
        const fsOnTarget = hasFiringSolutionOn({
          firingSolutionUnitId: classCombatRef.current.firingSolutionUnitId,
          firingSolutionExpiresAfterPlayerTurn: classCombatRef.current.firingSolutionExpiresAfterPlayerTurn,
        }, tid);
        h3bContractLine = currentAmmoRef.current < CONTROLLED_BURST_ROUNDS
          ? 'CONTROLLED BURST — requires 3 loaded rounds.'
          : `CONTROLLED BURST — ${dmg} × ${CONTROLLED_BURST_ROUNDS} authored (independent checks). Commits 3 rounds.${
            fsOnTarget ? ` +${FIRING_SOLUTION_ACCURACY_BONUS_PCT} accuracy vs marked.` : ''
          }`;
      } else if (abilityId === 'SUPPRESSIVE_BARRAGE') {
        const dmg = scaleHexWeaponAuthoredDamage(SUPPRESSIVE_BARRAGE_PACKET_DAMAGE, resolvedWeapon);
        const tid = selectedTargetIdRef.current;
        const fsOnTarget = hasFiringSolutionOn({
          firingSolutionUnitId: classCombatRef.current.firingSolutionUnitId,
          firingSolutionExpiresAfterPlayerTurn: classCombatRef.current.firingSolutionExpiresAfterPlayerTurn,
        }, tid);
        h3bContractLine = currentAmmoRef.current < SUPPRESSIVE_BARRAGE_ROUNDS
          ? 'SUPPRESSIVE FIRE — requires 2 loaded rounds.'
          : `SUPPRESSIVE FIRE — ${dmg} × ${SUPPRESSIVE_BARRAGE_ROUNDS} authored. ${
            fsOnTarget
              ? `One hit applies Suppressed (×${CARBINE_SUPPRESSED_DAMAGE_MULT.toFixed(2)}). +${FIRING_SOLUTION_ACCURACY_BONUS_PCT} accuracy.`
              : 'Both hits required to apply Suppressed (×0.70 next direct).'
          }`;
      } else if (abilityId === 'CONTACT_FRONT') {
        const dmg = scaleHexWeaponAuthoredDamage(CONTACT_FRONT_PACKET_DAMAGE, resolvedWeapon);
        const [a, b] = dualTargetIdsRef.current;
        const alloc = resolveContactFrontAllocation(a ?? selectedTargetIdRef.current, b);
        const fsState = {
          firingSolutionUnitId: classCombatRef.current.firingSolutionUnitId,
          firingSolutionExpiresAfterPlayerTurn: classCombatRef.current.firingSolutionExpiresAfterPlayerTurn,
        };
        if (currentAmmoRef.current < 4) {
          h3bContractLine = 'CONTACT FRONT — requires 4 loaded rounds.';
        } else if (!alloc) {
          h3bContractLine = `CONTACT FRONT — ${dmg} × 4 (4+0) or ${dmg} × 2 / ${dmg} × 2 (2+2). Commits 4 rounds.`;
        } else if (alloc.kind === '4+0') {
          const fs = hasFiringSolutionOn(fsState, alloc.primaryId);
          h3bContractLine = `CONTACT FRONT — concentrated ${dmg} × 4. Commits 4 rounds.${
            fs ? ` +${FIRING_SOLUTION_ACCURACY_BONUS_PCT} accuracy vs marked.` : ''
          }`;
        } else {
          const fs1 = hasFiringSolutionOn(fsState, alloc.primaryId);
          const fs2 = hasFiringSolutionOn(fsState, alloc.secondaryId);
          h3bContractLine = `CONTACT FRONT — divided ${dmg} × 2 / ${dmg} × 2. Commits 4 rounds.${
            fs1 || fs2 ? ` FS +${FIRING_SOLUTION_ACCURACY_BONUS_PCT} on marked target packets.` : ''
          }`;
        }
      } else if (abilityId === 'DOOR_KNOCKER') {
        h3bContractLine = 'DOOR KNOCKER — Shotgun basic (baseline 19 via family scaling). Armored ×1.10 + KA pressure. Backline ×0.75. Live stamina.';
      } else if (abilityId === 'FATAL_FUNNEL') {
        const primary = scaleHexWeaponAuthoredDamage(FATAL_FUNNEL_PRIMARY_AUTHORED, resolvedWeapon);
        const rear = scaleHexWeaponAuthoredDamage(FATAL_FUNNEL_REAR_AUTHORED, resolvedWeapon);
        const lane = resolveFatalFunnelLane(squadRef.current, selectedTargetIdRef.current);
        if (!lane) {
          h3bContractLine = `FATAL FUNNEL — select a column. Primary ${primary} / rear ${rear}. Backline falloff ×0.75 separate. Commits 1 shell.`;
        } else {
          const parts = lane.hits.map((h) => {
            const scaled = scaleHexWeaponAuthoredDamage(h.authoredDamage, resolvedWeapon);
            const final = applyBlackDoorBacklineFalloff(scaled, h.isBackline);
            return h.isPrimary
              ? `primary ${final}`
              : `rear ${final}${h.isBackline ? ' (incl. falloff)' : ''}`;
          });
          h3bContractLine = `FATAL FUNNEL — ${parts.join(' + ')}. Commits 1 shell. No lateral spill.`;
        }
      } else if (abilityId === 'THRESHOLD') {
        const dmg = scaleHexWeaponAuthoredDamage(THRESHOLD_AUTHORED, resolvedWeapon);
        if (classCombatRef.current.thresholdArmed) {
          h3bContractLine = 'THRESHOLD — already armed. Expires at next player-turn start. Does not negate the attack.';
        } else {
          const oc = hexShotStateRef.current.nextShotOvercharged;
          const fail = hexShotStateRef.current.firstShotPenaltyPending;
          h3bContractLine = [
            `THRESHOLD — arm reaction (${dmg} Kinetic vs attacker). Reserves 1 shell now.`,
            'Triggers before next direct attack on you. Expires next player-turn start (no refund).',
            oc ? 'Snapshots Overcharge.' : null,
            fail ? 'Snapshots FAILED first-shot penalty.' : null,
            'Does not inherently negate the attack.',
          ].filter(Boolean).join(' ');
        }
      } else if (abilityId === 'DEADBOLT') {
        const primed = classCombatRef.current.deadboltReloadOpportunity;
        const base = scaleHexWeaponAuthoredDamage(
          primed ? DEADBOLT_PRIMED_AUTHORED : DEADBOLT_BASE_AUTHORED,
          resolvedWeapon,
        );
        h3bContractLine = primed
          ? `DEADBOLT — primed ${base} Kinetic (reload opportunity). Consumed on valid shot including miss.`
          : `DEADBOLT — ${base} Kinetic. Reload opportunity raises authored base 22→28.`;
      }
    }
    return [
      cost.description,
      ammoTypeLine,
      zeroProtocolLine,
      ammoLine,
      h3bContractLine,
      riposteLine,
      catLine,
      phantomFeed,
    ].filter(Boolean).join(' // ');
  };

  const confirmSelectedAbility = () => {
    if (!selectedAbility) return;
    const aegisOpts = operativeClass === 'AEGIS' ? aegisTargetOpts() : undefined;
    const mode = classAbilityTargetMode(operativeClass, selectedAbility, aegisOpts);
    if (mode === 'SINGLE') {
      const targetId = selectedTargetIdRef.current;
      if (!targetId || !canTargetWithClassAbility(operativeClass, squadRef.current, selectedAbility, targetId, aegisOpts)) {
        log('[TARGET] >> Select a valid hostile on the grid.');
        publishSquadUi(squadRef.current);
        return;
      }
    }
    if (mode === 'DUAL') {
      const [bladeOne, bladeTwo] = dualTargetIdsRef.current;
      if (!bladeOne || !bladeTwo) {
        log(selectedAbility === 'DIVERGENCE'
          ? '[TARGET] >> Select two blade targets for Divergence.'
          : '[TARGET] >> Select two distinct targets.');
        publishSquadUi(squadRef.current);
        return;
      }
      // Divergence may double-commit one hostile; other dual casts stay distinct.
      if (bladeOne === bladeTwo && selectedAbility !== 'DIVERGENCE') {
        log('[TARGET] >> Select two distinct targets.');
        publishSquadUi(squadRef.current);
        return;
      }
      if (
        !canTargetWithClassAbility(operativeClass, squadRef.current, selectedAbility, bladeOne, aegisOpts)
        || !canTargetWithClassAbility(operativeClass, squadRef.current, selectedAbility, bladeTwo, aegisOpts)
      ) {
        log('[TARGET] >> Select valid hostile targets on the grid.');
        publishSquadUi(squadRef.current);
        return;
      }
    }
    if (mode === 'ONE_OR_TWO') {
      const [primary, secondary] = dualTargetIdsRef.current;
      const primaryId = primary ?? selectedTargetIdRef.current;
      if (!primaryId || !canTargetWithClassAbility(operativeClass, squadRef.current, selectedAbility, primaryId, aegisOpts)) {
        log('[TARGET] >> Select a valid primary for Contact Front.');
        publishSquadUi(squadRef.current);
        return;
      }
      if (secondary && secondary === primaryId) {
        log('[TARGET] >> Contact Front 2+2 requires two distinct targets.');
        publishSquadUi(squadRef.current);
        return;
      }
      if (
        secondary
        && !canTargetWithClassAbility(operativeClass, squadRef.current, selectedAbility, secondary, aegisOpts)
      ) {
        log('[TARGET] >> Select a valid secondary for Contact Front.');
        publishSquadUi(squadRef.current);
        return;
      }
      // Ensure dual slot 0 carries the primary for executor allocation.
      if (!dualTargetIdsRef.current[0]) {
        dualTargetIdsRef.current = [primaryId, secondary];
        setDualTargetIds([primaryId, secondary]);
      }
    }
    if (mode === 'ROW') {
      const targetId = selectedTargetIdRef.current;
      if (!targetId || !canTargetWithClassAbility(operativeClass, squadRef.current, selectedAbility, targetId, aegisOpts)) {
        log('[TARGET] >> Select a valid row anchor on the grid.');
        publishSquadUi(squadRef.current);
        return;
      }
      const rowTargets = resolveDreadHorizonTargets(squadRef.current, targetId);
      if (rowTargets.length === 0) {
        log('[TARGET] >> No valid Dread Horizon row targets.');
        publishSquadUi(squadRef.current);
        return;
      }
    }
    if (mode === 'COLUMN') {
      const targetId = selectedTargetIdRef.current;
      if (!targetId || !canTargetWithClassAbility(operativeClass, squadRef.current, selectedAbility, targetId, aegisOpts)) {
        log('[TARGET] >> Select a valid column lane on the grid.');
        publishSquadUi(squadRef.current);
        return;
      }
      if (!resolveFatalFunnelLane(squadRef.current, targetId)) {
        log('[TARGET] >> Empty or invalid Fatal Funnel lane.');
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
    clearAegisDualTargets();
    publishSquadUi(squadRef.current);
  };

  const stageAbility = (abilityId: string) => {
    // Mutual exclusion with Abyssal Verdict targeting.
    if (abyssalVerdictPrimedRef.current) {
      abyssalVerdictPrimedRef.current = false;
      setAbyssalVerdictPrimed(false);
      setAbyssalCollapsingUnitId(null);
      abyssalCommitLockRef.current = false;
    }
    clearAegisDualTargets();
    // Clear battlefield selection so the player chooses targets after arming.
    selectedTargetIdRef.current = null;
    setSelectedTargetId(null);
    focusedUnitIdRef.current = null;
    const aegisOpts = operativeClass === 'AEGIS' ? aegisTargetOpts() : undefined;
    const mode = classAbilityTargetMode(operativeClass, abilityId, aegisOpts);
    if (mode === 'ALL') {
      selectedTargetIdRef.current = null;
      setSelectedTargetId(null);
      // Bootstrap executor context without marking a single cast target.
      if (!enemyRef.current || !isUnitAlive(enemyRef.current)) {
        const fallback = primaryAliveUnit(squadRef.current);
        if (fallback) {
          enemyRef.current = fallback;
          setEnemy(fallback);
        }
      }
    }
    selectedAbilityRef.current = abilityId;
    setSelectedAbility(abilityId);
    publishSquadUiRef.current(squadRef.current);
  };

  const abortStagedAbility = () => {
    selectedAbilityRef.current = null;
    setSelectedAbility(null);
    clearAegisDualTargets();
    publishSquadUiRef.current(squadRef.current);
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
    // Selecting an ability must never paint the magenta/purple primed aura on the player.
    onAbilityPrimedChange?.(false);
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
        && activeWeaponFamilyId === 'envoy-scythe'
        && (classCombatRef.current.previousCatalyst === 'NULL'
          || classCombatRef.current.previousCatalyst === 'BLOOD'),
      lanternDetonationReady: operativeClass === 'ENVOY'
        && activeWeaponFamilyId === 'envoy-vambrace'
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
      hitAbsorbProtectionLabel: hitAbsorbProtectionUi?.label ?? null,
      hitAbsorbProtectionHits: hitAbsorbProtectionUi?.hits ?? 0,
    });
  }, [
    onOperativeTelemetryChange,
    operativeClass,
    operativeHp,
    hitAbsorbProtectionUi,
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
      weaponActionCount={
        operativeClass === 'AEGIS'
          ? 4
          : operativeClass === 'HEX_SHOT'
            ? (hexCombatSurface?.weaponActionCount ?? 0)
            : operativeClass === 'ENVOY'
              ? (envoyCombatSurface?.weaponActionCount ?? 4)
              : 0
      }
      techniqueCount={
        operativeClass === 'AEGIS'
          ? 3
          : operativeClass === 'HEX_SHOT'
            ? (hexCombatSurface?.techniqueCount ?? 0)
            : operativeClass === 'ENVOY'
              ? (envoyCombatSurface?.flexCount ?? 3)
              : 0
      }
      techniqueGroupLabel={
        operativeClass === 'HEX_SHOT'
          ? 'FLEX ABILITIES'
          : 'TECHNIQUES'
      }
      dualTargetsReady={
        (operativeClass === 'AEGIS'
          && dualTargetIds[0] != null
          && dualTargetIds[1] != null)
        || (operativeClass === 'HEX_SHOT'
          && selectedAbility === 'CONTACT_FRONT'
          && dualTargetIds[0] != null)
        || (operativeClass === 'HEX_SHOT'
          && selectedAbility === 'FATAL_FUNNEL'
          && selectedTargetId != null)
        || (operativeClass === 'AEGIS'
          && selectedAbility === 'DREAD_HORIZON'
          && selectedTargetId != null)
        || (operativeClass === 'ENVOY'
          && selectedAbility === 'GRAVE_TRANSFER'
          && dualTargetIds[0] != null
          && dualTargetIds[1] != null)
      }
      dualTargetLabel={
        operativeClass === 'AEGIS' && selectedAbility === 'DIVERGENCE'
          ? dualTargetPickStep === 0
            ? 'BLADE 1 — SELECT TARGET'
            : dualTargetIds[0] != null && dualTargetIds[1] == null
              ? 'BLADE 2 — SAME OR OTHER'
              : 'TARGET ×2'
          : operativeClass === 'HEX_SHOT' && selectedAbility === 'CONTACT_FRONT'
            ? dualTargetIds[0] == null
              ? 'SELECT PRIMARY — 4+0 OR ADD SECOND FOR 2+2'
              : dualTargetIds[1] == null
                ? 'CONFIRM 4+0 — OR SELECT SECOND TARGET (2+2)'
                : 'CONTACT FRONT ×2'
            : operativeClass === 'HEX_SHOT' && selectedAbility === 'FATAL_FUNNEL'
              ? selectedTargetId == null
                ? 'SELECT COLUMN LANE'
                : 'CONFIRM FATAL FUNNEL LANE'
              : operativeClass === 'ENVOY' && selectedAbility === 'GRAVE_TRANSFER'
                ? dualTargetPickStep === 0
                  ? 'SOURCE — SELECT ROTTED TARGET'
                  : dualTargetIds[0] != null && dualTargetIds[1] == null
                    ? 'DESTINATION — SELECT LIVING TARGET'
                    : 'GRAVE TRANSFER ×2'
                : null
      }
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
        operativeClass === 'AEGIS' ? aegisTargetOpts() : undefined,
      )}
      getAbilityCategory={(abilityId) => resolveAbilityUiCategory(operativeClass, abilityId)}
      getAbilityEffectTags={(abilityId) => {
        if (operativeClass === 'ENVOY' && isEnvoyWeaponActionId(abilityId) && activeWeaponFamilyId) {
          const dual = dualTargetIdsRef.current;
          const preview = previewEnvoyWeaponAction({
            actionId: abilityId,
            familyId: activeWeaponFamilyId,
            classState: classCombatRef.current,
            squad,
            targetId: abilityId === 'GRAVE_TRANSFER'
              ? (dual[0] ?? selectedTargetId)
              : selectedTargetId,
            secondaryTargetId: abilityId === 'GRAVE_TRANSFER' ? dual[1] : null,
            veilFlux,
            operativeHp,
            maxHp: combatMaxSoulAnchor,
            resolvedWeapon,
          });
          return formatEnvoyWeaponActionEffectLine(preview);
        }
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
            // H.2a — preview reads live Perfect Overcharge arming (same snapshot as execution).
            hexPerfectReload: operativeClass === 'HEX_SHOT'
              ? hexShotStateRef.current.nextShotOvercharged
              : false,
            catalogBaseDamage: operativeClass === 'HEX_SHOT'
              ? HEX_SHOT_ABILITY_CATALOG.SILVER_CORE_SIDEARM.baseDamage
              : undefined,
            riposteReady: classCombatRef.current.riposteReady,
            targetFractured: !!(enemyRef.current && isEnemyFractured(enemyRef.current)),
            lanternDetonationReady: operativeClass === 'ENVOY'
              && activeWeaponFamilyId === 'envoy-vambrace'
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
      getAbilityTargetMode={(abilityId) => classAbilityTargetMode(
        operativeClass,
        abilityId,
        operativeClass === 'AEGIS' ? aegisTargetOpts() : undefined,
      )}
      canEndTurn={isPlayerTurn && cycleState === 'TEXT_COMBAT' && !shadowstepProcActive}
      getStagedCostImpact={getStagedCostImpact}
      getStagedAbilityDescription={(abilityId) => {
        if (operativeClass === 'ENVOY' && isEnvoyWeaponActionId(abilityId) && activeWeaponFamilyId) {
          const dual = dualTargetIdsRef.current;
          const def = getEnvoyWeaponActionDefinition(abilityId);
          const preview = previewEnvoyWeaponAction({
            actionId: abilityId,
            familyId: activeWeaponFamilyId,
            classState: classCombatRef.current,
            squad,
            targetId: abilityId === 'GRAVE_TRANSFER'
              ? (dual[0] ?? selectedTargetId)
              : selectedTargetId,
            secondaryTargetId: abilityId === 'GRAVE_TRANSFER' ? dual[1] : null,
            veilFlux,
            operativeHp,
            maxHp: combatMaxSoulAnchor,
            resolvedWeapon,
          });
          return formatEnvoyWeaponActionExpandedDescription(
            preview,
            def?.description ?? formatEnvoyWeaponActionLabel(abilityId),
          );
        }
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
              && activeWeaponFamilyId === 'envoy-vambrace'
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
      riftWardAvailable={operativeClass === 'ENVOY'}
      riftWardReady={riftWardReadyUi}
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
      {showCommandDeck ? (
        <CounterfateHudStrip
          key={counterfateHudNonce}
          presentation={nineStrainBridgeRef.current.presentation()}
          onPreviewChosenFate={(id) => nineStrainBridgeRef.current.previewChosenFate(id)}
          onConfirmChosenFate={(id) => {
            const result = nineStrainBridgeRef.current.confirmChosenFate(id);
            setCounterfateHudNonce((value) => value + 1);
            return result.preview;
          }}
        />
      ) : null}
      {showCommandDeck ? (
        <RitualCadenceHudStrip
          presentation={nineStrainBridgeRef.current.ritualPresentation()}
        />
      ) : null}
      {showCommandDeck ? commandDeck : null}
      {showEnemyTurnPanel ? renderEnemyTurnPanel() : null}
    </View>
  );

  const useEnemyArenaChrome = enemyChrome != null;

  const chromeSnapshot = useMemo(
    () => ({
      // Console ultimate module owns activation for every class/weapon — no orbital ping.
      ultimatePingVisible: false,
      ultimatePingReady: false,
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
    // E.5V — single-row rail; keep callouts/tooltips from clipping at the deck edge.
    overflow: 'visible',
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
