import type { ResourceItemId } from '../types/resourceItem';
import type { SectorId } from '../types/worldState';
import { RESOURCE_REGISTRY, getResourceDisplayName } from './resourceRegistry';
import {
  ECONOMY_V1_RESOURCE_IDS,
  ECONOMY_V1_STABLE_IDS,
  ECONOMY_V1_UNSTABLE_IDS,
  isEconomyV1ResourceId,
} from './economyRosterV1';
import { CRAFTING_REGISTRY } from './craftingRegistry';
import { buildRunItemCraftingRecipes } from './runItemCraftingBridge';
import { WEAPON_REGISTRY } from './weaponRegistry';
import { ALL_SECTOR_IDS } from './sectorBiomeBridge';
import {
  getSectorResourceTable,
  sectorPrimaryResourcePool,
} from './sectorResourceTableEngine';
import {
  EXTRACTED_YIELD_TARGETS,
} from './resourceRewardPacketEngine';
import {
  estimateSectorExtractionRate,
  primarySectorsForResource,
  simulateEconomyRuns,
} from './economySpineSimulationEngine';
import { resolveResourceSourceHint } from './resourceSourceHintEngine';
import { createDefaultProgressionProfile } from './progressionProfileEngine';
import {
  ECONOMY_TUNING_THRESHOLDS,
  formatEconomyTuningConfigBrief,
} from './balance/economyBalanceConfig';
import { APPRAISABLE_SEALED_RESOURCE_IDS } from '../types/sealedCargo';

/**
 * Economy Spine Phase 2M — tuning pass.
 * Answers the design questions + hard balance rules with PASS / WARN / FAIL.
 */

export type TuningVerdict = 'PASS' | 'WARN' | 'FAIL';

export interface EconomyTuningCheck {
  id: string;
  group: 'QUESTION' | 'RULE';
  title: string;
  verdict: TuningVerdict;
  detail: string;
}

export interface EconomyTuningReport {
  checks: EconomyTuningCheck[];
  passCount: number;
  warnCount: number;
  failCount: number;
  appliedNotes: string[];
}

interface RecipeSink {
  label: string;
  resourceIds: ResourceItemId[];
}

function collectRecipeSinks(): RecipeSink[] {
  const sinks: RecipeSink[] = [];
  CRAFTING_REGISTRY.forEach((recipe) => {
    sinks.push({
      label: recipe.label,
      resourceIds: recipe.requirements.map((r) => r.resourceId),
    });
  });
  buildRunItemCraftingRecipes().forEach((recipe) => {
    sinks.push({
      label: recipe.label,
      resourceIds: recipe.requirements.map((r) => r.resourceId),
    });
  });
  Object.values(WEAPON_REGISTRY).forEach((family) => {
    if (family.unlockRequirement.length > 0) {
      sinks.push({
        label: `${family.shortName} unlock`,
        resourceIds: family.unlockRequirement.map((r) => r.resourceId),
      });
    }
    family.tiers.forEach((tier) => {
      if (tier.upgradeCost.length === 0) return;
      sinks.push({
        label: `${family.shortName} T${tier.tierNumber}`,
        resourceIds: tier.upgradeCost.map((r) => r.resourceId),
      });
    });
  });
  return sinks;
}

function recipeShare(resourceId: ResourceItemId, sinks: RecipeSink[]): number {
  if (sinks.length === 0) return 0;
  const hits = sinks.filter((s) => s.resourceIds.includes(resourceId)).length;
  return hits / sinks.length;
}

function basicHealingLeySlagCost(): number | null {
  const coagulant = buildRunItemCraftingRecipes().find((r) => r.outputId === 'standard-coagulant')
    ?? CRAFTING_REGISTRY.find((r) => r.outputId === 'standard-coagulant');
  if (!coagulant) return null;
  const slag = coagulant.requirements.find((r) => r.resourceId === 'ley-slag');
  return slag?.quantity ?? null;
}

function check(
  id: string,
  group: 'QUESTION' | 'RULE',
  title: string,
  verdict: TuningVerdict,
  detail: string,
): EconomyTuningCheck {
  return { id, group, title, verdict, detail };
}

export function buildEconomyTuningReport(): EconomyTuningReport {
  const sinks = collectRecipeSinks();
  const t = ECONOMY_TUNING_THRESHOLDS;
  const checks: EconomyTuningCheck[] = [];
  const appliedNotes = [
    'D1 combat SECTOR packet + higher STABLE fire (sector farming reads at Threshold).',
    'Weapon/run-item sinks diversified off Ley-Slag toward sector mats (nullcrete / cinder / combustion / mycelial).',
    'Ashen Breach Thread + Null Zone Containment Seal promoted to PRIMARY farming identity.',
    'Depth 2/3 extracted yield bands nudged up for intel/unstable reward.',
  ];

  // --- Q1: craft basic survival after one run ---
  const slagCost = basicHealingLeySlagCost();
  const slagRunSim = simulateEconomyRuns({
    sectorId: 'THE_SLAG_WORKS',
    runs: 50,
    breachGrade: 'I',
  });
  const slagPerRun = slagRunSim.perResourceExtracted.find((b) => b.resourceId === 'ley-slag')?.perRun ?? 0;
  const survivalOk = slagCost != null && slagCost <= t.maxBasicHealLeySlag && slagPerRun >= slagCost * 0.75;
  checks.push(check(
    'Q1_SURVIVAL_CRAFT',
    'QUESTION',
    'Can a player craft basic survival items after one run?',
    survivalOk ? 'PASS' : slagCost != null && slagCost <= t.maxBasicHealLeySlag ? 'WARN' : 'FAIL',
    `Standard Coagulant costs ${slagCost ?? '?'} Ley-Slag; Slag Works Grade I sim ~${slagPerRun.toFixed(2)} Ley-Slag extracted/run.`,
  ));

  // --- Q2: target missing resource without guessing ---
  const profile = createDefaultProgressionProfile();
  ALL_SECTOR_IDS.forEach((id) => {
    profile.sectors[id] = {
      ...profile.sectors[id]!,
      unlocked: true,
      accessMandateState: 'COMPLETED',
    };
  });
  const craftTargets = [...new Set(sinks.flatMap((s) => s.resourceIds))]
    .filter((id): id is ResourceItemId => isEconomyV1ResourceId(id));
  let exactOrPartial = 0;
  craftTargets.forEach((id) => {
    const hint = resolveResourceSourceHint(id, { profile });
    if (hint.tier === 'EXACT' || hint.tier === 'PARTIAL') exactOrPartial += 1;
  });
  const hintRatio = craftTargets.length > 0 ? exactOrPartial / craftTargets.length : 1;
  checks.push(check(
    'Q2_SOURCE_HINTS',
    'QUESTION',
    'Can a player target a missing resource without guessing?',
    hintRatio >= 0.85 ? 'PASS' : hintRatio >= 0.7 ? 'WARN' : 'FAIL',
    `${exactOrPartial}/${craftTargets.length} craft-sink resources resolve Exact/Partial with all sectors unlocked.`,
  ));

  // --- Q3: cargo stacking helpful without removing tension ---
  const stableStackable = ECONOMY_V1_STABLE_IDS.filter((id) => RESOURCE_REGISTRY[id].cargoStackCap > 1);
  const unstableStacked = ECONOMY_V1_UNSTABLE_IDS.filter((id) => RESOURCE_REGISTRY[id].cargoStackCap > 1);
  const rareOverstacked = ECONOMY_V1_RESOURCE_IDS.filter((id) => {
    const def = RESOURCE_REGISTRY[id];
    return def.rarity === 'RARE' && def.cargoStackCap > 3;
  });
  const stackOk = stableStackable.length >= 8 && unstableStacked.length === 0 && rareOverstacked.length === 0;
  checks.push(check(
    'Q3_CARGO_STACKS',
    'QUESTION',
    'Does cargo stacking feel helpful without removing tension?',
    stackOk ? 'PASS' : 'WARN',
    `${stableStackable.length} stable stack>1; ${unstableStacked.length} unstable stack>1; rares keep stack≤3 (over=${rareOverstacked.length}).`,
  ));

  // --- Q4: unstable forces decisions ---
  const unstableCarry = ECONOMY_V1_UNSTABLE_IDS.filter((id) => RESOURCE_REGISTRY[id].hasCarriedEffect);
  const unstableStack1 = ECONOMY_V1_UNSTABLE_IDS.every((id) => RESOURCE_REGISTRY[id].cargoStackCap === 1);
  checks.push(check(
    'Q4_UNSTABLE_DECISIONS',
    'QUESTION',
    'Does unstable cargo force real decisions?',
    unstableCarry.length >= 3 && unstableStack1 ? 'PASS' : 'WARN',
    `${unstableCarry.length} unstable with carried effects; all stack-cap-1=${unstableStack1}.`,
  ));

  // --- Q5 / Q6: depth economy worth risk ---
  const d1 = EXTRACTED_YIELD_TARGETS.find((b) => b.id === 'FULL_D1_BOSS')!;
  const d2 = EXTRACTED_YIELD_TARGETS.find((b) => b.id === 'D2_PARTIAL')!;
  const d3 = EXTRACTED_YIELD_TARGETS.find((b) => b.id === 'D3_EXTRACT')!;
  const d2Worth = d2.stable[0] > d1.stable[0] && d2.intelRare[0] >= d1.intelRare[1];
  const d3Worth = d3.stable[0] > d2.stable[0]
    && d3.unstable[0] >= 1
    && d3.intelRare[1] > d2.intelRare[1];
  checks.push(check(
    'Q5_DEPTH2_WORTH',
    'QUESTION',
    'Does Depth 2 feel economically worth the risk?',
    d2Worth ? 'PASS' : 'WARN',
    `Yield bands: D1 boss stable ${d1.stable.join('–')} → D2 partial ${d2.stable.join('–')} / intel ${d2.intelRare.join('–')}.`,
  ));
  checks.push(check(
    'Q6_DEPTH3_REWARD',
    'QUESTION',
    'Does Depth 3 feel dangerous but rewarding?',
    d3Worth ? 'PASS' : 'WARN',
    `D3 extract stable ${d3.stable.join('–')} · unstable ${d3.unstable.join('–')} · intel ${d3.intelRare.join('–')}.`,
  ));

  // --- Q7: every sector has a reason ---
  const sectorIssues: string[] = [];
  ALL_SECTOR_IDS.forEach((sectorId) => {
    const table = getSectorResourceTable(sectorId);
    const primaries = sectorPrimaryResourcePool(sectorId);
    if (primaries.length < 2) {
      sectorIssues.push(`${sectorId}: <2 PRIMARY mats`);
    }
    if (table.whyRun.length < 2) {
      sectorIssues.push(`${sectorId}: thin whyRun`);
    }
  });
  checks.push(check(
    'Q7_SECTOR_IDENTITY',
    'QUESTION',
    'Does every sector have a reason to be run?',
    sectorIssues.length === 0 ? 'PASS' : 'WARN',
    sectorIssues.length === 0
      ? `All ${ALL_SECTOR_IDS.length} sectors have ≥2 PRIMARY mats + whyRun copy.`
      : sectorIssues.slice(0, 4).join(' · '),
  ));

  // --- Q8: Null Zone relevant at higher grades ---
  const nullPrimaries = sectorPrimaryResourcePool('THE_NULL_ZONE');
  const nullcreteUses = sinks.filter((s) => s.resourceIds.includes('nullcrete-shard')).length;
  const nullOk = nullPrimaries.includes('nullcrete-shard')
    && nullPrimaries.includes('echo-glass-shard')
    && nullcreteUses >= 2;
  checks.push(check(
    'Q8_NULL_ZONE_LATE',
    'QUESTION',
    'Does Null Zone remain relevant at higher Breach Grades?',
    nullOk ? 'PASS' : 'WARN',
    `Null PRIMARY=${nullPrimaries.join(', ')}; nullcrete used in ${nullcreteUses} sinks; Grade III packet quality still applies globally.`,
  ));

  // --- Balance rules ---
  const slagShare = recipeShare('ley-slag', sinks);
  checks.push(check(
    'R1_LEY_SLAG_SHARE',
    'RULE',
    'Do not make every recipe need Ley-Slag',
    slagShare <= t.maxLeySlagRecipeShare ? 'PASS' : slagShare <= t.maxLeySlagRecipeShare + 0.1 ? 'WARN' : 'FAIL',
    `Ley-Slag appears in ${Math.round(slagShare * 100)}% of craft/unlock/upgrade sinks (cap ${Math.round(t.maxLeySlagRecipeShare * 100)}%).`,
  ));

  const techSinks = sinks.filter((s) => (
    /grid|pulse|rifle|sidearm|cannon|tech|scanner|flashcard|market/i.test(s.label)
    || s.resourceIds.includes('encrypted-grid-drive')
    || s.resourceIds.includes('rail-capacitor')
  ));
  const gridShare = techSinks.length === 0
    ? 0
    : techSinks.filter((s) => s.resourceIds.includes('encrypted-grid-drive')).length / techSinks.length;
  checks.push(check(
    'R2_GRID_DRIVE',
    'RULE',
    'Do not make every tech recipe need Grid-Drive',
    gridShare <= t.maxGridDriveTechShare ? 'PASS' : 'WARN',
    `Encrypted Grid-Drive in ${Math.round(gridShare * 100)}% of tech-tagged sinks.`,
  ));

  const powerSinks = sinks.filter((s) => (
    /master|rift|prism|knot|powerful|apex|tier.?3|T3/i.test(s.label)
    || s.resourceIds.includes('ossified-ley-knot')
    || s.resourceIds.includes('anomalous-core')
  ));
  const knotShare = powerSinks.length === 0
    ? 0
    : powerSinks.filter((s) => s.resourceIds.includes('ossified-ley-knot')).length / powerSinks.length;
  checks.push(check(
    'R3_LEY_KNOT',
    'RULE',
    'Do not make every powerful recipe need Ossified Ley-Knot',
    knotShare <= t.maxLeyKnotPowerShare ? 'PASS' : 'WARN',
    `Ossified Ley-Knot in ${Math.round(knotShare * 100)}% of power-tagged sinks.`,
  ));

  const earlySurvival = sinks.filter((s) => /coagulant|trauma|adrenaline|primer/i.test(s.label));
  const earlyBreach = earlySurvival.filter((s) => s.resourceIds.includes('breach-thread'));
  checks.push(check(
    'R4_BREACH_THREAD_GATE',
    'RULE',
    'Do not require Breach Thread before players can reliably reach Depth 2',
    earlyBreach.length === 0 ? 'PASS' : 'FAIL',
    earlyBreach.length === 0
      ? 'No early survival/prep recipes require Breach Thread.'
      : `Early sinks require Breach Thread: ${earlyBreach.map((s) => s.label).join(', ')}`,
  ));

  const advanced = sinks.filter((s) => (
    s.resourceIds.includes('containment-seal')
    || s.resourceIds.includes('anomalous-core')
    || s.resourceIds.includes('sealed-containment-casket')
  ));
  const blacklineOnly = advanced.filter((s) => {
    // Fail if ALL inputs are Blackline-only primaries
    return s.resourceIds.every((id) => {
      const primaries = primarySectorsForResource(id);
      return primaries.length === 1 && primaries[0] === 'THE_BLACKLINE_TERMINUS';
    });
  });
  checks.push(check(
    'R5_BLACKLINE_MANDATORY',
    'RULE',
    'Do not make Blackline Terminus mandatory for all advanced crafting',
    blacklineOnly.length <= 2 ? 'PASS' : 'WARN',
    `${blacklineOnly.length} advanced sinks are Blackline-only-primary; Breach Thread / seals also farmable outside Blackline.`,
  ));

  const cargoTools = sinks.filter((s) => /pocket|splitter|foam|smuggler/i.test(s.label));
  const cargoToolErasesRisk = cargoTools.some((s) => {
    // Heuristic: absurdly cheap cargo expansion
    return s.resourceIds.length === 1 && s.resourceIds[0] === 'ley-slag';
  });
  checks.push(check(
    'R6_CARGO_TOOLS',
    'RULE',
    'Do not let cargo tools erase extraction risk',
    !cargoToolErasesRisk && unstableStack1 ? 'PASS' : 'WARN',
    `Cargo-tool sinks=${cargoTools.length}; unstable remain stack-1; no single-slag cargo expander.`,
  ));

  checks.push(check(
    'R7_BASIC_HEALING',
    'RULE',
    'Do not make basic healing expensive',
    slagCost != null && slagCost <= t.maxBasicHealLeySlag ? 'PASS' : 'FAIL',
    `Standard Coagulant = ${slagCost ?? '?'} Ley-Slag (cap ${t.maxBasicHealLeySlag}).`,
  ));

  const unusedCommons = ECONOMY_V1_STABLE_IDS.filter((id) => {
    const def = RESOURCE_REGISTRY[id];
    if (!def.canBeCraftingIngredient) return false;
    return recipeShare(id, sinks) === 0;
  });
  checks.push(check(
    'R8_COMMON_USES',
    'RULE',
    'Do not let common resources become useless',
    unusedCommons.length === 0 ? 'PASS' : unusedCommons.length <= 2 ? 'WARN' : 'FAIL',
    unusedCommons.length === 0
      ? 'All craftable commons appear in ≥1 sink.'
      : `Unused commons: ${unusedCommons.map((id) => getResourceDisplayName(id)).join(', ')}`,
  ));

  const sealedAsCraft = sinks.filter((s) => s.resourceIds.some((id) => {
    const def = RESOURCE_REGISTRY[id];
    return def.category === 'CONTRABAND'
      || (APPRAISABLE_SEALED_RESOURCE_IDS as readonly string[]).includes(id);
  }));
  checks.push(check(
    'R9_SEALED_CRAFT',
    'RULE',
    'Do not use sealed contraband as normal crafting input',
    sealedAsCraft.length === 0 ? 'PASS' : 'FAIL',
    sealedAsCraft.length === 0
      ? 'No contraband/sealed craft inputs.'
      : sealedAsCraft.map((s) => s.label).join(', '),
  ));

  const coreShare = recipeShare('anomalous-core', sinks);
  const coreHits = sinks.filter((s) => s.resourceIds.includes('anomalous-core')).length;
  checks.push(check(
    'R10_ANOMALOUS_CORE',
    'RULE',
    'Do not overuse Anomalous Core',
    coreHits <= t.maxAnomalousCoreSinks ? 'PASS' : 'WARN',
    `Anomalous Core in ${coreHits} sinks (${Math.round(coreShare * 100)}% share). Masterwork-gated is intended.`,
  ));

  // Optional sim snapshot line for depth feel
  const sim = simulateEconomyRuns({
    sectorId: 'THE_SLAG_WORKS',
    runs: 40,
    breachGrade: 'II',
  });
  checks.push(check(
    'SIM_SLAG_RUN',
    'QUESTION',
    'Slag Works sim — extracted value still readable',
    sim.avgExtractedStable >= 4 ? 'PASS' : 'WARN',
    `40-run Slag II avg: stable ${sim.avgExtractedStable.toFixed(1)} · intel/rare ${sim.avgExtractedIntelRare.toFixed(1)} · unstable ${sim.avgExtractedUnstable.toFixed(1)}.`,
  ));

  const passCount = checks.filter((c) => c.verdict === 'PASS').length;
  const warnCount = checks.filter((c) => c.verdict === 'WARN').length;
  const failCount = checks.filter((c) => c.verdict === 'FAIL').length;

  return { checks, passCount, warnCount, failCount, appliedNotes };
}

export function formatEconomyTuningReport(): string {
  const report = buildEconomyTuningReport();
  const lines = [
    '=== ECONOMY SPINE // PHASE 2M — TUNING PASS ===',
    '',
    formatEconomyTuningConfigBrief(),
    '',
    `Checks: ${report.checks.length} (${report.passCount} PASS / ${report.warnCount} WARN / ${report.failCount} FAIL)`,
    '',
    '-- TUNING QUESTIONS --',
    ...report.checks
      .filter((c) => c.group === 'QUESTION')
      .map((c) => `[${c.verdict}] ${c.title}\n  ${c.detail}`),
    '',
    '-- BALANCE RULES --',
    ...report.checks
      .filter((c) => c.group === 'RULE')
      .map((c) => `[${c.verdict}] ${c.title}\n  ${c.detail}`),
    '',
    '-- APPLIED 2M KNOBS --',
    ...report.appliedNotes.map((n) => `• ${n}`),
    '',
    report.failCount === 0
      ? 'PASS — Economy Spine tuning questions + hard rules clear (warnings OK for soft targets).'
      : 'FAIL — resolve FAIL checks before closing Phase 2.',
  ];
  return lines.join('\n');
}

/** Compact sector farmability snapshot for DevTest. */
export function formatEconomySectorTuningBrief(): string {
  const lines = ['=== ECONOMY SPINE // PHASE 2M — SECTOR TUNING ===', ''];
  ALL_SECTOR_IDS.forEach((sectorId: SectorId) => {
    const table = getSectorResourceTable(sectorId);
    const primaries = sectorPrimaryResourcePool(sectorId);
    lines.push(sectorId.replace(/THE_/g, '').replace(/_/g, ' '));
    lines.push(`  role: ${table.role}`);
    lines.push(`  why: ${table.whyRun.join(' · ')}`);
    lines.push(`  PRIMARY: ${primaries.map((id) => getResourceDisplayName(id)).join(', ')}`);
    const rates = primaries.slice(0, 3).map((id) => {
      const rate = estimateSectorExtractionRate(id, sectorId, { districtDepth: 2, iterations: 40 });
      return `${getResourceDisplayName(id)} ~${rate.toFixed(2)}/run`;
    });
    lines.push(`  D2 rates: ${rates.join(' · ')}`);
    lines.push('');
  });
  return lines.join('\n');
}

export function formatEconomyTuningFixtureReport(): string {
  const report = buildEconomyTuningReport();
  const fails = report.checks.filter((c) => c.verdict === 'FAIL');
  const slag = report.checks.find((c) => c.id === 'R1_LEY_SLAG_SHARE');
  const heal = report.checks.find((c) => c.id === 'R7_BASIC_HEALING');
  const sealed = report.checks.find((c) => c.id === 'R9_SEALED_CRAFT');
  const lines = [
    formatEconomyTuningReport(),
    '',
    '-- FIXTURE ASSERTIONS --',
    fails.length === 0 ? 'PASS — zero FAIL checks.' : `FAIL — ${fails.map((f) => f.id).join(', ')}`,
    slag && slag.verdict !== 'FAIL' ? 'PASS — Ley-Slag share within hard fail band.' : 'FAIL — Ley-Slag share.',
    heal?.verdict === 'PASS' ? 'PASS — basic healing cheap.' : 'FAIL — basic healing.',
    sealed?.verdict === 'PASS' ? 'PASS — no sealed craft inputs.' : 'FAIL — sealed craft.',
  ];
  return lines.join('\n');
}
