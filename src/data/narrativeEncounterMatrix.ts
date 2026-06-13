import {
  CheckStatus,
  EnvironmentalModifiers,
  IncursionProgressState,
  NarrativeEventNode,
  NarrativeRunModifiers,
} from '../types/game';
import { RunState } from '../types/run';
import {
  CITY_STREETS_ALLEY_MATRIX_EVENTS,
  CITY_STREETS_DEPTH_ZERO_POOL,
  resolveCityStreetsAlleyEvent,
} from './cityStreetsAlleyEvents';
import { applyCityStreetsChoicePreviews } from './cityStreetsChoicePreviews';
import {
  appendOutcomeModifier,
  coreLayerCalibrationBonus,
  hasCollectedFlag,
  resolveConditionalBranchPreview,
} from './macroStoryPipeline';
import type { CargoRunState } from '../types/cargoGrid';
import { consumeCargoItem, hasCargoItem } from './cargoGridEngine';

export interface OperativeResourceSnapshot {
  maxSoulAnchor: number;
  soulAnchorIntegrity: number;
  maxStamina: number;
  currentStamina: number;
  startingAbyssalReservePercent: number;
}

export interface NarrativeResolutionResult {
  logLines: string[];
  flagsAdded: string[];
  progress: IncursionProgressState;
  runPatch: Partial<RunState>;
  cargoPatch?: CargoRunState;
  status: CheckStatus;
  outcomeText: string;
  environmentalModifiers: EnvironmentalModifiers;
  cryptoGlimmerGrantPct: number;
  triggerCombatAmbush: boolean;
  /** Procedural retreat — return to scanner without clearing the node. */
  abortToScanner?: boolean;
  /** Awarded on successful node clear (procedural credit rewards). */
  pendingRunCredits?: number;
  /** Applied to active incursion resonance after resolve. */
  resonanceDelta?: number;
  /** Randomized bonus loot from procedural narrative success (A/B/C only). */
  bonusReward?: import('../types/narrativeBonusReward').NarrativeBonusReward;
  /** Activates Grid-Hound hunter on overworld (faction vault brute-force). */
  spawnGridHound?: boolean;
  /** Grant a pre-defined resource bundle into cargo containment. */
  resourceCacheId?: import('../types/resourceItem').ResourceCacheId;
}

type ChoiceKey = 'A' | 'B';

interface MatrixEventTemplate {
  id: string;
  title: string;
  scenarioText: string;
  choiceA: { label: string; requirement: string };
  choiceB: { label: string; requirement: string };
  interactionMode: 'standard' | 'conditional';
}

const MATRIX_EVENTS: Record<string, MatrixEventTemplate> = {
  'city-01': {
    id: 'city-01',
    title: 'THE OVERLOADED TRANSFORMER',
    scenarioText:
      'A transformer vault spits violet arcs across the street grid. Ley-line feedback threatens to cascade into the block unless you ground the overload.',
    choiceA: { label: '[ A ] AEGIS GROUND', requirement: 'D20 CALIBRATION' },
    choiceB: { label: '[ B ] TERMINAL SIPHON', requirement: 'D20 CALIBRATION' },
    interactionMode: 'standard',
  },
  'city-02': {
    id: 'city-02',
    title: 'THE STRANDED OPERATIVE',
    scenarioText:
      'A wounded operative is pinned beside a stalled transit cart. Extraction will cost shield integrity; stripping the drive yields quick crypto yield.',
    choiceA: { label: '[ A ] STABILIZE SOUL ANCHOR', requirement: 'CHAIN ANCHOR A' },
    choiceB: { label: '[ B ] SECURE DRIVE', requirement: 'CHAIN ANCHOR A' },
    interactionMode: 'standard',
  },
  'city-03': {
    id: 'city-03',
    title: 'THE REDACTED TERMINAL',
    scenarioText:
      'A municipal terminal displays redacted transit logs. The encryption layer may conceal a sanctuary route — or an ambush trigger.',
    choiceA: { label: '[ A ] BYPASS ENCRYPTION', requirement: 'D20 CALIBRATION' },
    choiceB: { label: '[ B ] FORCE CASING', requirement: 'D20 CALIBRATION' },
    interactionMode: 'standard',
  },
  'city-04': {
    id: 'city-04',
    title: 'THE ECHOING PHONE BOOTH',
    scenarioText:
      'A derelict phone booth repeats a void-frequency tone. Interface the line or sever the trunk to silence the echo.',
    choiceA: { label: '[ A ] INTERFACE LINK', requirement: 'D20 CALIBRATION' },
    choiceB: { label: '[ B ] SEVER TRUNK LINE', requirement: 'D20 CALIBRATION' },
    interactionMode: 'standard',
  },
  'city-05': {
    id: 'city-05',
    title: 'BLACK MARKET DROP',
    scenarioText:
      'A dead-drop locker pulses with black-market firmware. Thermal friction may overclock your next strike — or scorch your anchor.',
    choiceA: { label: '[ A ] THERMAL FRICTION', requirement: 'D20 CALIBRATION' },
    choiceB: { label: '[ B ] ADMIN BYPASS', requirement: 'D20 CALIBRATION' },
    interactionMode: 'standard',
  },
  'city-06': {
    id: 'city-06',
    title: 'THE TOLL GRID',
    scenarioText:
      'Automated toll pylons recognize your transit signature. Prior field actions determine whether the grid grants passage or trips your shields.',
    choiceA: { label: '[ CONTINUE ]', requirement: 'CONDITIONAL' },
    choiceB: { label: '[ CONTINUE ]', requirement: 'CONDITIONAL' },
    interactionMode: 'conditional',
  },
  'hospital-01': {
    id: 'hospital-01',
    title: 'THE AUTOMATED DISPENSARY',
    scenarioText:
      'An automated dispensary arm dispenses corrupted stimulant packs. Slice the lock or shatter the glass housing.',
    choiceA: { label: '[ A ] SLICE LOCK', requirement: 'D20 CALIBRATION' },
    choiceB: { label: '[ B ] SMASH GLASS', requirement: 'D20 CALIBRATION' },
    interactionMode: 'standard',
  },
  'hospital-02': {
    id: 'hospital-02',
    title: 'SANITIZED QUARANTINE',
    scenarioText:
      'A quarantine wing vents star-fire particulate. Calibrate your anchor or seal the vents at stamina cost.',
    choiceA: { label: '[ A ] STAR-FIRE CALIBRATION', requirement: 'D20 CALIBRATION' },
    choiceB: { label: '[ B ] SEAL VENTS', requirement: 'D20 CALIBRATION' },
    interactionMode: 'standard',
  },
  'hospital-03': {
    id: 'hospital-03',
    title: 'THE SCREAMING MONITOR',
    scenarioText:
      'Vital-sign monitors scream in harmonic lockstep. Trace the pattern for kinetic gain or strike the display offline.',
    choiceA: { label: '[ A ] PATTERN TRACE', requirement: 'D20 CALIBRATION' },
    choiceB: { label: '[ B ] STRIKE', requirement: 'D20 CALIBRATION' },
    interactionMode: 'standard',
  },
  'hospital-04': {
    id: 'hospital-04',
    title: 'BIO-STORAGE CRYO TANK',
    scenarioText:
      'A cryo tank holds an unstable relic matrix. Thawing extracts power at energy cost; shattering yields immediate glimmer.',
    choiceA: { label: '[ A ] THAW UNIT', requirement: 'CHAIN ANCHOR B' },
    choiceB: { label: '[ B ] SMASH TANK', requirement: 'CHAIN ANCHOR B' },
    interactionMode: 'standard',
  },
  'hospital-05': {
    id: 'hospital-05',
    title: 'THE GHOST TRIAGE',
    scenarioText:
      'Phantom triage forms queue at an empty desk. Administrative override may restore stamina — or expose your position.',
    choiceA: { label: '[ A ] ADMIN OVERRIDE', requirement: 'D20 CALIBRATION' },
    choiceB: { label: '[ B ] SHADOW TRACKING', requirement: 'D20 CALIBRATION' },
    interactionMode: 'standard',
  },
  'hospital-06': {
    id: 'hospital-06',
    title: 'RELIC RESONANCE',
    scenarioText:
      'Residual relic energy hums through the ward. Prior cryo-tank actions determine whether the anomaly stabilizes your shields or fractures your anchor.',
    choiceA: { label: '[ CONTINUE ]', requirement: 'CONDITIONAL' },
    choiceB: { label: '[ CONTINUE ]', requirement: 'CONDITIONAL' },
    interactionMode: 'conditional',
  },
  'lab-01': {
    id: 'lab-01',
    title: 'THE PARTICLE BLEED',
    scenarioText:
      'Particle coolant bleeds into the sublevel. Channel it through your weapon or depressurize the coolant line.',
    choiceA: { label: '[ A ] WEAPON CHANNEL', requirement: 'D20 CALIBRATION' },
    choiceB: { label: '[ B ] DEPRESSURIZE COOLANT', requirement: 'D20 CALIBRATION' },
    interactionMode: 'standard',
  },
  'lab-02': {
    id: 'lab-02',
    title: 'CORRUPTED SERVER ARRAY',
    scenarioText:
      'A server array pulses with corrupted telemetry. Extract the data stream or wipe the drives for shield integrity.',
    choiceA: { label: '[ A ] DATA EXTRACT', requirement: 'CHAIN ANCHOR C' },
    choiceB: { label: '[ B ] DRIVE WIPE', requirement: 'CHAIN ANCHOR C' },
    interactionMode: 'standard',
  },
  'lab-03': {
    id: 'lab-03',
    title: 'THE CHEMICAL WASH STATION',
    scenarioText:
      'A chemical wash station vents caustic mist. Coat your armor plating or clear the hazard for stamina reserves.',
    choiceA: { label: '[ A ] COAT ARMOR', requirement: 'D20 CALIBRATION' },
    choiceB: { label: '[ B ] CLEAR HAZARD', requirement: 'D20 CALIBRATION' },
    interactionMode: 'standard',
  },
  'lab-04': {
    id: 'lab-04',
    title: 'NON-EUCLIDEAN DISPLAY MATRIX',
    scenarioText:
      'A display matrix folds space across the lab wall. Decrypt the matrix or pull the main breaker.',
    choiceA: { label: '[ A ] DECRYPT MATRIX', requirement: 'D20 CALIBRATION' },
    choiceB: { label: '[ B ] PULL MAIN BREAKER', requirement: 'D20 CALIBRATION' },
    interactionMode: 'standard',
  },
  'lab-05': {
    id: 'lab-05',
    title: 'EXPERIMENTAL FUEL CELL VAULT',
    scenarioText:
      'An experimental fuel cell vault hums with volatile charge. Manual breach may restore stamina — or collapse your shields.',
    choiceA: { label: '[ A ] MANUAL BREACH', requirement: 'D20 CALIBRATION' },
    choiceB: { label: '[ B ] WIRE WEAPON CELL', requirement: 'D20 CALIBRATION' },
    interactionMode: 'standard',
  },
  'lab-06': {
    id: 'lab-06',
    title: 'TERMINAL MAPPING UPLINK',
    scenarioText:
      'A core-mapping uplink awaits handshake. Prior telemetry handling determines whether the sector core is mapped or your reserves are drained.',
    choiceA: { label: '[ CONTINUE ]', requirement: 'CONDITIONAL' },
    choiceB: { label: '[ CONTINUE ]', requirement: 'CONDITIONAL' },
    interactionMode: 'conditional',
  },
  'sector-01': {
    id: 'sector-01',
    title: 'THE BLEEDING GATEWAY',
    scenarioText:
      'The sector gateway bleeds raw ley-fire into the conduit hall. Anchor your shield or trace the leyline for kinetic charge.',
    choiceA: { label: '[ A ] SHIELD ANCHOR', requirement: 'D20 CALIBRATION' },
    choiceB: { label: '[ B ] LEYLINE TRACE', requirement: 'D20 CALIBRATION' },
    interactionMode: 'standard',
  },
  'sector-02': {
    id: 'sector-02',
    title: 'ECHOES OF THE PAST',
    scenarioText:
      'Echoes of prior operatives distort the chamber. Isolate the distraction or execute an administrative wipe.',
    choiceA: { label: '[ A ] ISOLATE DISTRACTION', requirement: 'D20 CALIBRATION' },
    choiceB: { label: '[ B ] ADMINISTRATIVE WIPE', requirement: 'D20 CALIBRATION' },
    interactionMode: 'standard',
  },
  'sector-03': {
    id: 'sector-03',
    title: 'THE TERMINAL OVERRIDE COMMAND',
    scenarioText:
      'A terminal override command demands immediate response. Star-fire strike channels energy — shield lock conserves integrity at stamina cost.',
    choiceA: { label: '[ A ] STAR-FIRE STRIKE', requirement: 'AUTO' },
    choiceB: { label: '[ B ] SHIELD LOCK', requirement: 'AUTO' },
    interactionMode: 'standard',
  },
  'sector-04': {
    id: 'sector-04',
    title: 'SIPHONED FONT LEDGER',
    scenarioText:
      'A siphoned font ledger offers weapon baptism or reserve siphon. Dip your weapon for armor-piercing — or siphon stamina at HP cost.',
    choiceA: { label: '[ A ] DIP WEAPON', requirement: 'D20 CALIBRATION' },
    choiceB: { label: '[ B ] SIPHON RESERVES', requirement: 'D20 CALIBRATION' },
    interactionMode: 'standard',
  },
  'sector-05': {
    id: 'sector-05',
    title: 'THE SHATTERED MONOLITH',
    scenarioText:
      'A shattered monolith broadcasts proxy handshake codes. Accept the handshake or cleave the stone for glimmer.',
    choiceA: { label: '[ A ] PROXY HANDSHAKE', requirement: 'D20 CALIBRATION' },
    choiceB: { label: '[ B ] KINETIC CLEAVE', requirement: 'D20 CALIBRATION' },
    interactionMode: 'standard',
  },
  'sector-06': {
    id: 'sector-06',
    title: 'THE FINAL INVENTORY ASSESSMENT',
    scenarioText:
      'The descent engine runs a final inventory assessment. Sufficient field flags may unlock a boss shield bypass — otherwise vent fuel for recovery.',
    choiceA: { label: '[ A ] BYPASS BOSS SHIELD (FLAGGED)', requirement: 'CONDITIONAL' },
    choiceB: { label: '[ B ] VENT FUEL RESERVES', requirement: 'CONDITIONAL' },
    interactionMode: 'conditional',
  },
  'sector-07': {
    id: 'sector-07',
    title: 'THE SEVERED CONDUIT',
    scenarioText:
      'A severed ley-conduit spills void-pressure into the maintenance shaft. Ground your Aegis shield to bleed the overload, or deploy a gravity grapple to anchor the conduit and siphon kinetic charge.',
    choiceA: { label: '[ A ] AEGIS GROUND', requirement: 'D20 CALIBRATION' },
    choiceB: { label: '[ B ] GRAVITY ANCHOR', requirement: 'CARGO: GRAVITY GRAPPLE' },
    interactionMode: 'standard',
  },
  ...CITY_STREETS_ALLEY_MATRIX_EVENTS,
};

export type LegacyMatrixEventTemplate = MatrixEventTemplate;

/** Hard-coded matrix narrative templates (city, sector, hospital, lab, alley pools). */
export const LEGACY_MATRIX_EVENT_TEMPLATES: Readonly<Record<string, LegacyMatrixEventTemplate>> =
  MATRIX_EVENTS;

function mergeFlags(progress: IncursionProgressState, flags: string[]): IncursionProgressState {
  const set = new Set([...progress.collectedFlags, ...flags]);
  return { ...progress, collectedFlags: [...set] };
}

function pctDelta(value: number, pct: number): number {
  return Math.round(value * (1 + pct / 100));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

type ProgressPatch = Omit<Partial<IncursionProgressState>, 'narrativeModifiers'> & {
  narrativeModifiers?: Partial<NarrativeRunModifiers>;
  cryptoGlimmerGrantPct?: number;
};

function mergeModifiers(
  base: NarrativeRunModifiers,
  patch: Partial<NarrativeRunModifiers>,
): NarrativeRunModifiers {
  return {
    nextCombatEnemyHpBonusPct: base.nextCombatEnemyHpBonusPct + (patch.nextCombatEnemyHpBonusPct ?? 0),
    nextCombatDamageBonusPct: base.nextCombatDamageBonusPct + (patch.nextCombatDamageBonusPct ?? 0),
    bossArmorPiercePct: base.bossArmorPiercePct + (patch.bossArmorPiercePct ?? 0),
    nodeNineCalibrationBonusPct: base.nodeNineCalibrationBonusPct + (patch.nodeNineCalibrationBonusPct ?? 0),
    bossShieldBypassPct: base.bossShieldBypassPct + (patch.bossShieldBypassPct ?? 0),
  };
}

export function d20SuccessThreshold(progress: IncursionProgressState): number {
  return 11;
}

export function d20CalibrationBonus(
  progress: IncursionProgressState,
  encounterIndex: number,
): number {
  const pct = coreLayerCalibrationBonus(encounterIndex, progress);
  return Math.floor(pct * 20 / 100);
}

export function rollVirtualD20(): number {
  return 1 + Math.floor(Math.random() * 20);
}

export function evaluateD20Success(
  roll: number,
  progress: IncursionProgressState,
  encounterIndex: number,
): boolean {
  return roll + d20CalibrationBonus(progress, encounterIndex) >= d20SuccessThreshold(progress);
}

export function pickMatrixEventForEncounter(
  _encounterIndex: number,
  progress: IncursionProgressState,
): NarrativeEventNode {
  const pool = CITY_STREETS_DEPTH_ZERO_POOL.filter(
    (id) => !progress.usedNarrativeEventIds.includes(id),
  );
  const matrixId = pool.length > 0
    ? pool[Math.floor(Math.random() * pool.length)]
    : CITY_STREETS_DEPTH_ZERO_POOL[0];
  return enrichNodeWithFlagContext(
    templateToNode(MATRIX_EVENTS[matrixId]),
    matrixId,
    progress.collectedFlags,
  );
}

export function buildMatrixNarrativeNode(
  matrixId: string,
  progress: IncursionProgressState,
): NarrativeEventNode {
  const template = MATRIX_EVENTS[matrixId];
  if (!template) {
    return enrichNodeWithFlagContext(
      templateToNode(MATRIX_EVENTS['sector-01']),
      'sector-01',
      progress.collectedFlags,
    );
  }
  return enrichNodeWithFlagContext(
    templateToNode(template),
    matrixId,
    progress.collectedFlags,
  );
}

function enrichNodeWithFlagContext(
  node: NarrativeEventNode,
  matrixId: string,
  collectedFlags: readonly string[],
): NarrativeEventNode {
  let enriched = applyCityStreetsChoicePreviews(node, collectedFlags);
  const preview = resolveConditionalBranchPreview(matrixId, collectedFlags);
  if (preview?.scenarioOverride) {
    enriched = { ...enriched, scenarioText: preview.scenarioOverride };
  }
  return enriched;
}

function templateToNode(template: MatrixEventTemplate): NarrativeEventNode {
  return {
    id: template.id,
    matrixEventId: template.id,
    interactionMode: template.interactionMode,
    title: template.title,
    scenarioText: template.scenarioText,
    choiceA: {
      label: template.choiceA.label,
      requirement: template.choiceA.requirement,
      successText: '>> CALIBRATION LOCKED — FIELD OUTCOME RESOLVING...',
      failureText: '>> CALIBRATION MISSED — FIELD OUTCOME RESOLVING...',
    },
    choiceB: {
      label: template.choiceB.label,
      requirement: template.choiceB.requirement,
      successText: '>> CALIBRATION LOCKED — FIELD OUTCOME RESOLVING...',
      failureText: '>> CALIBRATION MISSED — FIELD OUTCOME RESOLVING...',
    },
  };
}

function baseResult(
  progress: IncursionProgressState,
  env: EnvironmentalModifiers,
  logLines: string[],
  flags: string[],
  outcomeText: string,
  status: CheckStatus,
  runPatch: Partial<RunState> = {},
  progressPatch: ProgressPatch = {},
): NarrativeResolutionResult {
  const { cryptoGlimmerGrantPct = 0, ...progressFields } = progressPatch;
  let nextProgress = mergeFlags(progress, flags);
  nextProgress = {
    ...nextProgress,
    ...progressFields,
    narrativeModifiers: mergeModifiers(
      nextProgress.narrativeModifiers,
      progressFields.narrativeModifiers ?? {},
    ),
  };
  if (progressFields.usedNarrativeEventIds) {
    nextProgress.usedNarrativeEventIds = progressFields.usedNarrativeEventIds;
  }

  return {
    logLines,
    flagsAdded: flags,
    progress: nextProgress,
    runPatch,
    status,
    outcomeText,
    environmentalModifiers: env,
    cryptoGlimmerGrantPct,
    triggerCombatAmbush: nextProgress.pendingCombatAmbush,
  };
}

function resolveConditional(
  matrixId: string,
  choice: ChoiceKey,
  progress: IncursionProgressState,
  env: EnvironmentalModifiers,
  snapshot: OperativeResourceSnapshot,
): NarrativeResolutionResult {
  const flags = progress.collectedFlags;
  let runPatch: Partial<RunState> = {};
  let progressPatch: ProgressPatch = {};
  const logLines: string[] = ['>> CONDITIONAL CHAIN RESOLUTION — AUTO-EXECUTE'];

  switch (matrixId) {
    case 'city-06': {
      const used = [...progress.usedNarrativeEventIds, matrixId];
      if (hasCollectedFlag(flags, 'saved_operative')) {
        runPatch = { maxStamina: pctDelta(snapshot.maxStamina, 5) };
        const nextProgress = appendOutcomeModifier(progress, 'max_stamina', 5);
        return baseResult(
          nextProgress,
          env,
          [...logLines, '>> saved_operative FLAG — toll grid bypassed.', '>> +5% MAX STAMINA.'],
          [],
          '>> TOLL GRID BYPASSED — operative transit codes honored. +5% Max Stamina.',
          'SUCCESS',
          runPatch,
          { usedNarrativeEventIds: used },
        );
      }
      runPatch = { soulAnchorIntegrity: pctDelta(snapshot.soulAnchorIntegrity, -10) };
      return baseResult(
        progress,
        env,
        [...logLines, '>> looted_operative FLAG — grid tripped.', '>> -10% CURRENT SHIELD.'],
        [],
        '>> TOLL GRID TRIPPED — shield capacitors drained. -10% Current Shield.',
        'FAILURE',
        runPatch,
        { usedNarrativeEventIds: used },
      );
    }

    case 'hospital-06': {
      const used = [...progress.usedNarrativeEventIds, matrixId];
      if (hasCollectedFlag(flags, 'relic_extracted')) {
        runPatch = { maxSoulAnchor: pctDelta(snapshot.maxSoulAnchor, 10) };
        const nextProgress = appendOutcomeModifier(progress, 'max_shield', 10);
        return baseResult(
          nextProgress,
          env,
          [
            ...logLines,
            '>> relic_extracted FLAG — harmonic resonance lock.',
            '>> +10% MAX SHIELD — structural shielding reinforced (no decompression).',
          ],
          [],
          '>> RELIC RESONANCE — harmonic lock achieved. +10% Max Shield structural increment.',
          'SUCCESS',
          runPatch,
          { usedNarrativeEventIds: used },
        );
      }
      runPatch = { maxSoulAnchor: pctDelta(snapshot.maxSoulAnchor, -10) };
      return baseResult(
        progress,
        env,
        [...logLines, '>> shattered_tank FLAG — violent decompression.', '>> -10% MAX HP.'],
        [],
        '>> RELIC SHATTER CASCADE — anchor integrity fractured. -10% Max HP.',
        'FAILURE',
        runPatch,
        { usedNarrativeEventIds: used },
      );
    }

    case 'lab-06': {
      const used = [...progress.usedNarrativeEventIds, matrixId];
      if (hasCollectedFlag(flags, 'telemetry_downloaded')) {
        const nextProgress = appendOutcomeModifier(progress, 'core_calibration', 15);
        return baseResult(
          nextProgress,
          env,
          [
            ...logLines,
            '>> telemetry_downloaded FLAG — core mapped.',
            '>> +15% VICTORY METRIC OFFSET — Core layer (depth 8–9) choices.',
          ],
          [],
          '>> CORE MAPPED — sector uplink grants +15% success on Sector Core narrative options.',
          'SUCCESS',
          {},
          { narrativeModifiers: { nodeNineCalibrationBonusPct: 15 }, usedNarrativeEventIds: used },
        );
      }
      runPatch = { maxStamina: pctDelta(snapshot.maxStamina, -10) };
      return baseResult(
        progress,
        env,
        [...logLines, '>> telemetry_wiped FLAG — blind transit.', '>> -10% MAX STAMINA.'],
        [],
        '>> BLIND TRANSIT — navigation buffers purged. -10% Max Stamina.',
        'FAILURE',
        runPatch,
        { usedNarrativeEventIds: used },
      );
    }

    case 'sector-06': {
      const flagCount = flags.length;
      if (choice === 'A' && flagCount >= 2) {
        return baseResult(
          progress,
          env,
          [...logLines, `>> FLAG COUNT ${flagCount} — boss shield bypass unlocked.`, '>> +10% BOSS SHIELD BYPASS.'],
          [],
          '>> FINAL ASSESSMENT — Option A: Boss defensive shield bypassed by 10%.',
          'SUCCESS',
          {},
          { narrativeModifiers: { bossShieldBypassPct: 10 }, usedNarrativeEventIds: [...progress.usedNarrativeEventIds, matrixId] },
        );
      }
      runPatch = {
        soulAnchorIntegrity: pctDelta(snapshot.soulAnchorIntegrity, 10),
      };
      return baseResult(
        progress,
        env,
        [...logLines, '>> STANDARD VENT — fuel reserves discharged.', '>> +10% CURRENT HP.'],
        [],
        '>> FINAL ASSESSMENT — Option B: Vent fuel reserves. +10% Current HP.',
        'SUCCESS',
        runPatch,
        { usedNarrativeEventIds: [...progress.usedNarrativeEventIds, matrixId] },
      );
    }

    default:
      return baseResult(progress, env, logLines, [], '>> CONDITIONAL EVENT UNRESOLVED.', 'FAILURE');
  }
}

function resolveStandard(
  matrixId: string,
  choice: ChoiceKey,
  roll: number,
  success: boolean,
  progress: IncursionProgressState,
  env: EnvironmentalModifiers,
  snapshot: OperativeResourceSnapshot,
  encounterIndex: number,
  cargo?: CargoRunState,
): NarrativeResolutionResult {
  const calBonus = d20CalibrationBonus(progress, encounterIndex);
  const logLines = [
    `>> D20 ROLL: ${roll}${calBonus > 0 ? ` (+${calBonus} CORE CALIBRATION)` : ''} (TARGET ≥ ${d20SuccessThreshold(progress)})`,
    success ? '>> CALIBRATION SUCCESS' : '>> CALIBRATION FAILURE',
  ];
  let runPatch: Partial<RunState> = {};
  let progressPatch: ProgressPatch = {};
  let cargoPatch: CargoRunState | undefined;
  const flags: string[] = [];
  let outcome = '';
  let status: CheckStatus = success ? 'SUCCESS' : 'FAILURE';

  const applyMaxShield = (pct: number) => {
    runPatch.maxSoulAnchor = pctDelta(snapshot.maxSoulAnchor, pct);
    runPatch.soulAnchorIntegrity = clamp(
      runPatch.soulAnchorIntegrity ?? snapshot.soulAnchorIntegrity,
      1,
      runPatch.maxSoulAnchor ?? snapshot.maxSoulAnchor,
    );
  };
  const applyCurrentShield = (pct: number) => {
    runPatch.soulAnchorIntegrity = clamp(pctDelta(snapshot.soulAnchorIntegrity, pct), 1, snapshot.maxSoulAnchor);
  };
  const applyMaxHp = (pct: number) => {
    runPatch.maxSoulAnchor = pctDelta(snapshot.maxSoulAnchor, pct);
    runPatch.soulAnchorIntegrity = clamp(
      runPatch.soulAnchorIntegrity ?? snapshot.soulAnchorIntegrity,
      1,
      runPatch.maxSoulAnchor ?? snapshot.maxSoulAnchor,
    );
  };
  const applyCurrentHp = (pct: number) => {
    runPatch.soulAnchorIntegrity = clamp(pctDelta(snapshot.soulAnchorIntegrity, pct), 1, snapshot.maxSoulAnchor);
  };
  const applyCurrentEnergy = (pct: number) => {
    runPatch.startingAbyssalReservePercent = clamp(pctDelta(snapshot.startingAbyssalReservePercent, pct), 0, 100);
  };
  const applyMaxEnergy = (pct: number) => {
    runPatch.startingAbyssalReservePercent = clamp(pctDelta(snapshot.startingAbyssalReservePercent, pct), 0, 100);
  };
  const applyMaxStamina = (pct: number) => {
    runPatch.maxStamina = pctDelta(snapshot.maxStamina, pct);
    runPatch.currentStamina = clamp(runPatch.currentStamina ?? snapshot.currentStamina, 0, runPatch.maxStamina ?? snapshot.maxStamina);
  };
  const applyCurrentStamina = (pct: number) => {
    runPatch.currentStamina = clamp(pctDelta(snapshot.currentStamina, pct), 0, snapshot.maxStamina);
  };
  switch (matrixId) {
    case 'city-01':
      if (choice === 'A') {
        if (success) { applyMaxShield(5); outcome = '>> AEGIS GROUND SUCCESS — +5% Max Shield.'; }
        else { applyCurrentShield(-10); outcome = '>> AEGIS GROUND FAILURE — -10% Current Shield.'; }
      } else if (success) {
        applyCurrentEnergy(10);
        outcome = '>> TERMINAL SIPHON SUCCESS — +10% Current Energy.';
      } else {
        applyMaxHp(-5);
        outcome = '>> TERMINAL SIPHON FAILURE — -5% Max HP.';
      }
      break;

    case 'city-02':
      if (choice === 'A') {
        applyCurrentShield(-10);
        flags.push('saved_operative');
        outcome = '>> OPERATIVE STABILIZED — -10% Current Shield. FLAG: saved_operative.';
        status = 'SUCCESS';
      } else {
        flags.push('looted_operative');
        outcome = '>> DRIVE SECURED — +10% Crypto-Glimmer. FLAG: looted_operative.';
        status = 'SUCCESS';
        progressPatch = { ...progressPatch, cryptoGlimmerGrantPct: 10 };
      }
      break;

    case 'city-03':
      if (choice === 'A') {
        if (success) {
          progressPatch = { ...progressPatch, forceNextSanctuary: true };
          outcome = '>> ENCRYPTION BYPASSED — next depth offers Sanctuary route.';
        } else {
          progressPatch = { ...progressPatch, pendingCombatAmbush: true };
          outcome = '>> ENCRYPTION FAILED — immediate combat ambush flagged.';
        }
      } else if (success) {
        applyMaxShield(5);
        applyMaxStamina(-5);
        outcome = '>> CASING FORCED — +5% Max Shield / -5% Max Stamina.';
      } else {
        applyMaxShield(5);
        applyMaxStamina(-5);
        outcome = '>> CASING FORCED — +5% Max Shield / -5% Max Stamina.';
        status = 'SUCCESS';
      }
      break;

    case 'city-04':
      if (choice === 'A') {
        if (success) {
          applyCurrentEnergy(10);
          flags.push('void_attuned');
          outcome = '>> INTERFACE LINK SUCCESS — +10% Current Energy. FLAG: void_attuned.';
        } else {
          applyCurrentHp(-10);
          outcome = '>> INTERFACE LINK FAILURE — -10% Current HP.';
        }
      } else {
        applyMaxStamina(5);
        applyMaxShield(-5);
        outcome = '>> TRUNK SEVERED — +5% Max Stamina / -5% Max Shield.';
        status = 'SUCCESS';
      }
      break;

    case 'city-05':
      if (choice === 'A') {
        if (success) {
          progressPatch = {
            narrativeModifiers: { nextCombatDamageBonusPct: 10 },
          };
          outcome = '>> THERMAL FRICTION SUCCESS — +10% combat damage next fight.';
        } else {
          applyCurrentHp(-10);
          outcome = '>> THERMAL FRICTION FAILURE — -10% Current HP.';
        }
      } else if (success) {
        progressPatch = { ...progressPatch, cryptoGlimmerGrantPct: 5 };
        outcome = '>> ADMIN BYPASS SUCCESS — +5% Crypto-Glimmer.';
      } else {
        outcome = '>> ADMIN BYPASS FAILURE — access gated. No reward issued.';
        status = 'FAILURE';
      }
      break;

    case 'hospital-01':
      if (choice === 'A') {
        if (success) {
          applyCurrentHp(10);
          outcome = '>> SLICE LOCK SUCCESS — +10% Current HP.';
        } else {
          progressPatch = { narrativeModifiers: { nextCombatEnemyHpBonusPct: 10 } };
          outcome = '>> SLICE LOCK FAILURE — next combat enemies +10% HP.';
        }
      } else {
        applyMaxHp(5);
        applyCurrentShield(-5);
        outcome = '>> GLASS SHATTERED — +5% Max HP / -5% Current Shield.';
        status = 'SUCCESS';
      }
      break;

    case 'hospital-02':
      if (choice === 'A') {
        if (success) { applyMaxHp(5); outcome = '>> STAR-FIRE SUCCESS — +5% Max HP.'; }
        else { applyCurrentHp(-10); outcome = '>> STAR-FIRE FAILURE — -10% Current HP.'; }
      } else {
        applyMaxShield(5);
        applyMaxStamina(-5);
        outcome = '>> VENTS SEALED — +5% Max Shield / -5% Max Stamina.';
        status = 'SUCCESS';
      }
      break;

    case 'hospital-03':
      if (choice === 'A') {
        if (success) { applyCurrentEnergy(10); outcome = '>> PATTERN TRACE SUCCESS — +10% Current Energy.'; }
        else { applyMaxEnergy(-10); outcome = '>> PATTERN TRACE FAILURE — -10% Max Energy.'; }
      } else {
        applyMaxShield(5);
        applyCurrentHp(-5);
        outcome = '>> STRIKE — +5% Max Shield / -5% Current HP.';
        status = 'SUCCESS';
      }
      break;

    case 'hospital-04':
      if (choice === 'A') {
        applyCurrentEnergy(-10);
        flags.push('relic_extracted');
        outcome = '>> UNIT THAWED — -10% Current Energy. FLAG: relic_extracted.';
        status = 'SUCCESS';
      } else {
        flags.push('shattered_tank');
        progressPatch = { ...progressPatch, cryptoGlimmerGrantPct: 10 };
        outcome = '>> TANK SHATTERED — +10% Crypto-Glimmer. FLAG: shattered_tank.';
        status = 'SUCCESS';
      }
      break;

    case 'hospital-05':
      if (choice === 'A') {
        if (success) { applyMaxStamina(10); outcome = '>> ADMIN OVERRIDE SUCCESS — +10% Max Stamina.'; }
        else { applyMaxShield(-5); outcome = '>> ADMIN OVERRIDE FAILURE — -5% Max Shield.'; }
      } else if (success) {
        applyMaxStamina(5);
        outcome = '>> SHADOW TRACKING SUCCESS — +5% Max Stamina.';
      } else {
        progressPatch = { ...progressPatch, pendingCombatAmbush: true };
        outcome = '>> SHADOW TRACKING FAILURE — immediate combat ambush flagged.';
      }
      break;

    case 'lab-01':
      if (choice === 'A') {
        if (success) {
          progressPatch = { narrativeModifiers: { nextCombatDamageBonusPct: 10 } };
          outcome = '>> WEAPON CHANNEL SUCCESS — next attack +10% damage.';
        } else {
          applyCurrentHp(-10);
          outcome = '>> WEAPON CHANNEL FAILURE — -10% Current HP.';
        }
      } else {
        applyMaxShield(5);
        applyMaxStamina(-5);
        outcome = '>> COOLANT DEPRESSURIZED — +5% Max Shield / -5% Max Stamina.';
        status = 'SUCCESS';
      }
      break;

    case 'lab-02':
      if (choice === 'A') {
        applyMaxStamina(-5);
        flags.push('telemetry_downloaded');
        outcome = '>> DATA EXTRACTED — -5% Max Stamina. FLAG: telemetry_downloaded.';
        status = 'SUCCESS';
      } else {
        applyCurrentShield(10);
        flags.push('telemetry_wiped');
        outcome = '>> DRIVE WIPED — +10% Current Shield. FLAG: telemetry_wiped.';
        status = 'SUCCESS';
      }
      break;

    case 'lab-03':
      if (choice === 'A') {
        applyMaxShield(5);
        applyCurrentHp(-5);
        outcome = '>> ARMOR COATED — +5% Max Shield / -5% Current HP.';
        status = 'SUCCESS';
      } else {
        applyMaxStamina(10);
        applyCurrentEnergy(-5);
        outcome = '>> HAZARD CLEARED — +10% Max Stamina / -5% Current Energy.';
        status = 'SUCCESS';
      }
      break;

    case 'lab-04':
      if (choice === 'A') {
        if (success) { applyCurrentEnergy(10); outcome = '>> DECRYPT SUCCESS — +10% Current Energy.'; }
        else { applyMaxHp(-5); outcome = '>> DECRYPT FAILURE — -5% Max HP.'; }
      } else {
        applyMaxHp(5);
        applyCurrentEnergy(-10);
        outcome = '>> BREAKER PULLED — +5% Max HP / -10% Current Energy.';
        status = 'SUCCESS';
      }
      break;

    case 'lab-05':
      if (choice === 'A') {
        if (success) { applyMaxStamina(10); outcome = '>> MANUAL BREACH SUCCESS — +10% Max Stamina.'; }
        else { applyCurrentShield(-10); outcome = '>> MANUAL BREACH FAILURE — -10% Current Shield.'; }
      } else if (success) {
        applyCurrentEnergy(-10);
        progressPatch = { ...progressPatch, cryptoGlimmerGrantPct: 10 };
        outcome = '>> WEAPON CELL WIRED — -10% Current Energy / +10% Crypto-Glimmer.';
        status = 'SUCCESS';
      } else {
        applyCurrentEnergy(-10);
        outcome = '>> WIRE FAILURE — -10% Current Energy.';
        status = 'FAILURE';
      }
      break;

    case 'sector-01':
      if (choice === 'A') {
        if (success) { applyMaxShield(5); outcome = '>> SHIELD ANCHOR SUCCESS — +5% Max Shield.'; }
        else { applyCurrentShield(-10); outcome = '>> SHIELD ANCHOR FAILURE — -10% Current Shield.'; }
      } else if (success) {
        applyCurrentEnergy(10);
        outcome = '>> LEYLINE TRACE SUCCESS — +10% Current Energy.';
      } else {
        applyMaxHp(-5);
        outcome = '>> LEYLINE TRACE FAILURE — -5% Max HP.';
      }
      break;

    case 'sector-02':
      if (choice === 'A') {
        if (success) { applyMaxHp(5); outcome = '>> ISOLATE SUCCESS — +5% Max HP.'; }
        else { applyMaxStamina(-5); outcome = '>> ISOLATE FAILURE — -5% Max Stamina.'; }
      } else {
        applyMaxShield(5);
        applyCurrentEnergy(-10);
        outcome = '>> ADMINISTRATIVE WIPE — +5% Max Shield / -10% Current Energy.';
        status = 'SUCCESS';
      }
      break;

    case 'sector-03':
      if (choice === 'A') {
        applyCurrentEnergy(10);
        applyMaxShield(-10);
        outcome = '>> STAR-FIRE STRIKE — +10% Current Energy / -10% Max Shield.';
        status = 'SUCCESS';
      } else {
        applyCurrentShield(10);
        applyMaxStamina(-10);
        outcome = '>> SHIELD LOCK — +10% Current Shield / -10% Max Stamina.';
        status = 'SUCCESS';
      }
      break;

    case 'sector-04':
      if (choice === 'A') {
        if (success) {
          progressPatch = { narrativeModifiers: { bossArmorPiercePct: 15 } };
          outcome = '>> WEAPON BAPTIZED — +15% Boss armor-piercing for rest of run.';
        } else {
          applyCurrentHp(-10);
          outcome = '>> DIP FAILURE — -10% Current HP.';
        }
      } else {
        applyMaxStamina(10);
        applyMaxHp(-5);
        outcome = '>> SIPHON RESERVES — +10% Max Stamina / -5% Max HP.';
        status = 'SUCCESS';
      }
      break;

    case 'sector-05':
      if (choice === 'A') {
        if (success) {
          runPatch.soulAnchorIntegrity = snapshot.maxSoulAnchor;
          outcome = '>> PROXY HANDSHAKE SUCCESS — Current HP restored to 100%.';
        } else {
          applyMaxHp(-10);
          outcome = '>> PROXY HANDSHAKE FAILURE — -10% Max HP.';
        }
      } else {
        progressPatch = { ...progressPatch, cryptoGlimmerGrantPct: 10 };
        applyMaxShield(-5);
        outcome = '>> KINETIC CLEAVE — +10% Crypto-Glimmer / -5% Max Shield.';
        status = 'SUCCESS';
      }
      break;

    case 'sector-07':
      if (choice === 'A') {
        if (success) {
          applyMaxShield(5);
          outcome = '>> AEGIS GROUND SUCCESS — +5% Max Shield.';
        } else {
          applyCurrentShield(-10);
          outcome = '>> AEGIS GROUND FAILURE — -10% Current Shield.';
        }
      } else if (cargo && hasCargoItem(cargo, 'gravity-grapple')) {
        const consumed = consumeCargoItem(cargo, 'gravity-grapple');
        if (consumed) {
          cargoPatch = consumed;
          applyCurrentEnergy(15);
          applyCurrentShield(10);
          outcome = '>> GRAVITY ANCHOR SUCCESS — grapple spent. +15% Energy / +10% Current Shield.';
          status = 'SUCCESS';
        } else {
          outcome = '>> GRAVITY ANCHOR FAILED — grapple not found in cargo.';
          status = 'FAILURE';
        }
      } else {
        outcome = '>> GRAVITY ANCHOR REJECTED — gravity grapple required in cargo grid.';
        status = 'FAILURE';
      }
      break;

    default: {
      const alley = resolveCityStreetsAlleyEvent(matrixId, choice, success, {
        applyMaxShield,
        applyCurrentShield,
        applyMaxHp,
        applyCurrentHp,
        applyCurrentEnergy,
        applyMaxStamina,
        applyCurrentStamina,
      });
      if (alley) {
        progressPatch = { ...progressPatch, ...alley.progressPatch };
        flags.push(...alley.flags);
        outcome = alley.outcome;
        status = alley.status;
      } else {
        outcome = '>> UNKNOWN MATRIX EVENT — NO EFFECT.';
      }
      break;
    }
  }

  const usedId = matrixId;
  progressPatch = {
    ...progressPatch,
    usedNarrativeEventIds: [...progress.usedNarrativeEventIds, usedId],
  };

  const result = baseResult(progress, env, logLines, flags, outcome, status, runPatch, progressPatch);
  return cargoPatch ? { ...result, cargoPatch } : result;
}

export function resolveMatrixNarrativeChoice(
  matrixEventId: string,
  choice: ChoiceKey,
  roll: number,
  progress: IncursionProgressState,
  environmentalModifiers: EnvironmentalModifiers,
  snapshot: OperativeResourceSnapshot,
  encounterIndex: number,
  options?: { forceSuccess?: boolean; forceFailure?: boolean },
  cargo?: CargoRunState,
): NarrativeResolutionResult {
  const template = MATRIX_EVENTS[matrixEventId];
  if (!template) {
    return baseResult(
      progress,
      environmentalModifiers,
      ['>> MATRIX EVENT NOT FOUND'],
      [],
      '>> UNKNOWN EVENT.',
      'FAILURE',
      {},
      {},
    );
  }

  if (template.interactionMode === 'conditional') {
    return resolveConditional(matrixEventId, choice, progress, environmentalModifiers, snapshot);
  }

  const autoSuccess = options?.forceSuccess === true;
  const autoFail = options?.forceFailure === true;
  const chainAuto = ['city-02', 'hospital-04', 'lab-02'].includes(matrixEventId);
  const autoEvents = ['sector-03'].includes(matrixEventId);
  const choiceDef = choice === 'A' ? template.choiceA : template.choiceB;
  const chainAnchored = choiceDef.requirement.startsWith('CHAIN ANCHOR');

  let success = evaluateD20Success(roll, progress, encounterIndex);
  if (chainAnchored || chainAuto || autoEvents) success = true;
  if (autoSuccess) success = true;
  if (autoFail && !chainAnchored && !chainAuto) success = false;

  if (matrixEventId === 'sector-07' && choice === 'B') {
    return resolveStandard(matrixEventId, choice, roll, true, progress, environmentalModifiers, snapshot, encounterIndex, cargo);
  }

  if (matrixEventId === 'city-05' && choice === 'B' && !success) {
    return resolveStandard(matrixEventId, choice, roll, false, progress, environmentalModifiers, snapshot, encounterIndex, cargo);
  }

  return resolveStandard(matrixEventId, choice, roll, success, progress, environmentalModifiers, snapshot, encounterIndex, cargo);
}

export function primeNarrativeEnvironment(
  _node: NarrativeEventNode,
): EnvironmentalModifiers {
  return {
    isEnemyPhaseShrouded: false,
    isPlayerBlinded: false,
    hasTetanusGlitch: false,
    startingStaminaPenalty: 0,
  };
}
