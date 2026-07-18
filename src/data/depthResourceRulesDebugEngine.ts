import type { ResourceDepthIndex, ResourceItemId } from '../types/resourceItem';
import { RESOURCE_REGISTRY } from './resourceRegistry';
import { validateResourceRegistry } from './resourceValidation';
import {
  DEPTH_ECONOMY_POLICIES,
  DEPTH_ROLL_PRESSURE,
  economyPoolAtDepth,
  filterResourcesForDepth,
  formatDepthEconomyPolicyBrief,
  isResourceEligibleAtDepth,
  NULL_ZONE_THRESHOLD_EXAMPLE_IDS,
} from './depthResourceRulesEngine';
import { sectorPrimaryResourcePool } from './sectorResourceTableEngine';
import { rollExpansionIdentityExtras } from './resourceDropIdentityEngine';
import { depthAwareTierResourcePool, rollCombatResourceDrops } from './combatRewardEngine';

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function names(ids: readonly ResourceItemId[]): string {
  return ids.map((id) => RESOURCE_REGISTRY[id].shortName).join(', ');
}

/** Phase 2E — depth economy policy + gate smoke. */
export function formatDepthResourceRulesReport(): string {
  const lines: string[] = [
    '=== ECONOMY SPINE // PHASE 2E — DEPTH RESOURCE RULES ===',
    '',
  ];

  ([1, 2, 3] as ResourceDepthIndex[]).forEach((depth) => {
    lines.push(formatDepthEconomyPolicyBrief(depth));
    const pressure = DEPTH_ROLL_PRESSURE[depth];
    lines.push(
      `  Pressure: intel=${pressure.intelChance} rare=${pressure.rareChance} `
      + `unstable=${pressure.unstableChance} contraband=${pressure.contrabandChance} `
      + `apex=${pressure.apexChance} thread=${pressure.breachThreadChance}`,
    );
    lines.push('');
  });

  lines.push('-- REGISTRY DEPTH BANDS --');
  economyPoolAtDepth(3, { highRisk: true }).forEach((resourceId) => {
    const def = RESOURCE_REGISTRY[resourceId];
    const { minDepth, maxDepth, preferredDepths } = def.depthRules;
    const pref = preferredDepths.length ? ` pref[${preferredDepths.join(',')}]` : '';
    lines.push(
      `${def.shortName.padEnd(22)} ${def.category.padEnd(10)} D${minDepth}-${maxDepth}${pref}`,
    );
  });

  lines.push('');
  lines.push('-- NULL ZONE THRESHOLD EXAMPLE --');
  const nullPrimaryD1 = filterResourcesForDepth(
    sectorPrimaryResourcePool('THE_NULL_ZONE'),
    1,
  );
  lines.push(`Primary @ D1: ${names(nullPrimaryD1)}`);
  lines.push(`Brief example: ${names(NULL_ZONE_THRESHOLD_EXAMPLE_IDS)}`);
  const exampleOk = NULL_ZONE_THRESHOLD_EXAMPLE_IDS.every((id) => (
    isResourceEligibleAtDepth(id, 1) || isResourceEligibleAtDepth(id, 1, { isElite: true })
  ));
  lines.push(`Example eligibility: ${exampleOk ? 'OK' : 'FAIL'}`);

  lines.push('');
  lines.push('-- GATE SMOKE --');
  const d1Banned = ['veil-ash-canister', 'anomalous-core', 'sealed-containment-casket', 'breach-thread'] as const;
  d1Banned.forEach((id) => {
    const open = isResourceEligibleAtDepth(id, 1);
    lines.push(`D1 ${RESOURCE_REGISTRY[id].shortName}: ${open ? 'LEAK' : 'blocked'}`);
  });
  lines.push(
    `D3 Core (default): ${isResourceEligibleAtDepth('anomalous-core', 3) ? 'LEAK' : 'blocked'}`,
  );
  lines.push(
    `D3 Core (high-risk): ${isResourceEligibleAtDepth('anomalous-core', 3, { highRisk: true }) ? 'open' : 'blocked'}`,
  );

  lines.push('');
  lines.push('-- COMBAT / IDENTITY SMOKE --');
  ([1, 2, 3] as ResourceDepthIndex[]).forEach((depth) => {
    const pool = depthAwareTierResourcePool(depth, depth);
    const identity = rollExpansionIdentityExtras({
      districtDepth: depth,
      veilBiome: 'NULL_ZONE',
      isElite: depth === 1,
      rng: mulberry32(0x2e00 + depth),
    });
    const combat = rollCombatResourceDrops({
      depth: depth === 1 ? 5 : depth === 2 ? 20 : 35,
      districtDepth: depth,
      isElite: false,
      isGatekeeper: false,
      veilBiome: 'NULL_ZONE',
      seed: `phase2e-d${depth}`,
    });
    const combatLeak = combat.filter((id) => !isResourceEligibleAtDepth(id, depth, {
      highRisk: true,
      isElite: true,
    }));
    lines.push(
      `D${depth} ${DEPTH_ECONOMY_POLICIES[depth].label}: pool=${pool.length} `
      + `identity=[${names(identity) || '—'}] combat=[${names(combat) || '—'}] `
      + `leaks=${combatLeak.length}`,
    );
  });

  const issues = validateResourceRegistry().filter((issue) => (
    issue.message.includes('Phase 2E')
    || issue.message.includes('Threshold')
    || issue.message.includes('depth policy')
    || issue.message.includes('minDepth >= 2')
  ));
  lines.push('');
  lines.push(`Phase 2E validation issues: ${issues.length}`);
  issues.slice(0, 16).forEach((issue) => {
    lines.push(`  [${issue.severity}] ${issue.resourceId ?? 'depth'}: ${issue.message}`);
  });

  const d1 = economyPoolAtDepth(1);
  const d1Clean = d1.every((id) => {
    const cat = RESOURCE_REGISTRY[id].category;
    return cat !== 'UNSTABLE' && cat !== 'CONTRABAND';
  });
  const pass = issues.length === 0 && exampleOk && d1Clean;

  lines.push('');
  lines.push(
    pass
      ? 'PASS — Depth modifies the economy: Threshold teaches, Breach risks, Deep Veil pressures.'
      : 'FAIL — depth resource rules incomplete or leaking.',
  );
  lines.push('Rule: D3 is different kinds of pressure, not “more Ley-Slag.” Packets are Phase 2F.');

  return lines.join('\n');
}
