import type { ResourceDepthIndex } from '../types/resourceItem';
import type { RewardNodeKind } from '../types/resourceRewardPacket';
import { RESOURCE_REGISTRY } from './resourceRegistry';
import { validateResourceRegistry } from './resourceValidation';
import {
  BREACH_GRADE_PACKET_QUALITY,
  EXTRACTED_YIELD_TARGETS,
  assembleNodeRewardPackets,
  classifyExtractedYieldCounts,
  formatExtractedYieldTargetsBrief,
  formatPacketBrief,
  rollNodeRewardPackets,
} from './resourceRewardPacketEngine';
import { isResourceEligibleAtDepth } from './depthResourceRulesEngine';
import { rollCombatResourceDrops } from './combatRewardEngine';
import { rollProceduralResourcePool } from './proceduralResourceEngine';
import type { BreachGradeId } from '../types/progression';

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function names(ids: readonly string[]): string {
  return ids.map((id) => RESOURCE_REGISTRY[id as keyof typeof RESOURCE_REGISTRY]?.shortName ?? id).join(', ');
}

/** Phase 2F — reward packets + yield targets report. */
export function formatRewardPacketsReport(): string {
  const lines: string[] = [
    '=== ECONOMY SPINE // PHASE 2F — REWARD PACKETS ===',
    '',
    '-- NODE RECIPES (Grade I, Null Zone) --',
  ];

  const kinds: RewardNodeKind[] = [
    'NORMAL_COMBAT',
    'ELITE_COMBAT',
    'RESOURCE_ANOMALY',
    'ANCHOR_SIGNAL',
    'ECHO_SIGNAL',
    'BOSS',
  ];

  let leakCount = 0;
  kinds.forEach((kind) => {
    ([1, 2, 3] as ResourceDepthIndex[]).forEach((depth) => {
      const packets = assembleNodeRewardPackets({
        nodeKind: kind,
        depth: depth === 1 ? 5 : depth === 2 ? 20 : 35,
        districtDepth: depth,
        veilBiome: 'NULL_ZONE',
        breachGrade: 'I',
        rng: mulberry32(1),
      });
      const rolled = rollNodeRewardPackets({
        nodeKind: kind,
        depth: depth === 1 ? 5 : depth === 2 ? 20 : 35,
        districtDepth: depth,
        veilBiome: 'NULL_ZONE',
        breachGrade: 'I',
        highRisk: kind === 'BOSS',
        isElite: kind === 'ELITE_COMBAT' || kind === 'BOSS',
        rng: mulberry32(0x2f00 + depth * 17 + kinds.indexOf(kind)),
      });
      const leaks = rolled.resourceIds.filter((id) => !isResourceEligibleAtDepth(id, depth, {
        highRisk: true,
        isElite: true,
      }));
      leakCount += leaks.length;
      lines.push(
        `${kind} D${depth}: [${packets.map(formatPacketBrief).join(' · ')}] `
        + `→ [${names(rolled.resourceIds) || '—'}] leaks=${leaks.length}`,
      );
    });
    lines.push('');
  });

  lines.push('-- BREACH GRADE QUALITY (not pile ×N) --');
  (['I', 'II', 'III', 'IV', 'V'] as BreachGradeId[]).forEach((grade) => {
    const q = BREACH_GRADE_PACKET_QUALITY[grade];
    const base = assembleNodeRewardPackets({
      nodeKind: 'NORMAL_COMBAT',
      depth: 20,
      districtDepth: 2,
      breachGrade: 'I',
      rng: () => 0.5,
    }).length;
    const withGrade = assembleNodeRewardPackets({
      nodeKind: 'NORMAL_COMBAT',
      depth: 20,
      districtDepth: 2,
      breachGrade: grade,
      rng: () => 0.5,
    }).length;
    lines.push(
      `Grade ${grade}: value×${q.valueMultiplier} packets ${withGrade} (base ${base}) `
      + `sector+${q.sectorPacketBonusChance} rare+${q.rarePacketBonusChance} — ${q.summary}`,
    );
  });

  lines.push('');
  lines.push('-- EXTRACTED YIELD TARGETS (successful extract, not raw drops) --');
  lines.push(formatExtractedYieldTargetsBrief());

  lines.push('');
  lines.push('-- COMBAT / HARVEST SMOKE --');
  const combat = rollCombatResourceDrops({
    depth: 5,
    isElite: false,
    isGatekeeper: false,
    veilBiome: 'SLAG_WORKS',
    breachGrade: 'II',
    seed: 'phase2f-combat',
  });
  const harvest = rollProceduralResourcePool(8, 'phase2f-harvest', {
    veilBiome: 'SLAG_WORKS',
    breachGrade: 'II',
  });
  const boss = rollCombatResourceDrops({
    depth: 35,
    isElite: false,
    isGatekeeper: true,
    veilBiome: 'BLACKLINE_TERMINUS',
    breachGrade: 'III',
    seed: 'phase2f-boss',
    rewardNodeKind: 'BOSS',
    highRisk: true,
  });
  const classified = classifyExtractedYieldCounts([...combat, ...harvest]);
  lines.push(`Normal D1 combat: [${names(combat) || '—'}]`);
  lines.push(`Resource anomaly: [${names(harvest) || '—'}]`);
  lines.push(`Boss D3 packets: [${names(boss) || '—'}]`);
  lines.push(
    `Sample classify: stable=${classified.stable} intel/rare=${classified.intelRare} `
    + `unstable=${classified.unstable} contraband/apex=${classified.contrabandApex}`,
  );

  const issues = validateResourceRegistry().filter((issue) => (
    issue.message.includes('Phase 2F')
    || issue.message.includes('reward packet')
    || issue.message.includes('yield target')
  ));
  lines.push('');
  lines.push(`Phase 2F validation issues: ${issues.length}`);
  issues.slice(0, 16).forEach((issue) => {
    lines.push(`  [${issue.severity}] ${issue.message}`);
  });

  const gradeI = assembleNodeRewardPackets({
    nodeKind: 'NORMAL_COMBAT', depth: 20, districtDepth: 2, breachGrade: 'I', rng: () => 0.5,
  });
  const gradeIII = assembleNodeRewardPackets({
    nodeKind: 'NORMAL_COMBAT', depth: 20, districtDepth: 2, breachGrade: 'III', rng: () => 0.5,
  });
  const gradeAddsPackets = gradeIII.length > gradeI.length;
  const yieldOk = EXTRACTED_YIELD_TARGETS.length === 5;
  const pass = issues.length === 0 && leakCount === 0 && gradeAddsPackets && yieldOk;

  lines.push('');
  lines.push(
    pass
      ? 'PASS — Nodes emit packets; grades add quality packets; yield targets documented.'
      : 'FAIL — reward packet system incomplete or leaking.',
  );
  lines.push('Rule: more loot than you can safely carry; grades improve packets, not pile size.');

  return lines.join('\n');
}
