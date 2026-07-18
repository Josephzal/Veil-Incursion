import { createDefaultProgressionProfile } from './progressionProfileEngine';
import { ECONOMY_V1_RESOURCE_IDS } from './economyRosterV1';
import { RESOURCE_REGISTRY } from './resourceRegistry';
import { validateResourceRegistry } from './resourceValidation';
import {
  assertAllEconomyResourcesHaveHints,
  formatSectorFarmingPreviewLines,
  resolveResourceSourceHint,
} from './resourceSourceHintEngine';
import { ALL_SECTOR_IDS } from './sectorBiomeBridge';

/** Phase 2G — source hint tier report. */
export function formatResourceSourceHintsReport(): string {
  const profile = createDefaultProgressionProfile();
  // Unlock Null Zone + Slag for EXACT samples; leave others locked.
  profile.sectors.THE_NULL_ZONE = {
    ...profile.sectors.THE_NULL_ZONE!,
    unlocked: true,
    highestGradeCleared: 'I',
    accessMandateState: 'COMPLETED',
  };
  profile.sectors.THE_SLAG_WORKS = {
    ...profile.sectors.THE_SLAG_WORKS!,
    unlocked: true,
    highestGradeCleared: 'I',
    accessMandateState: 'COMPLETED',
  };
  profile.sectors.THE_ASHEN_WASTES = {
    ...profile.sectors.THE_ASHEN_WASTES!,
    unlocked: false,
    highestGradeCleared: null,
    accessMandateState: 'AVAILABLE',
  };

  const lines: string[] = [
    '=== ECONOMY SPINE // PHASE 2G — RESOURCE SOURCE HINTS ===',
    '',
    '-- SAMPLE HINTS (Null+Slag unlocked, Ashen known/locked) --',
  ];

  const samples = [
    'rail-capacitor',
    'nullcrete-shard',
    'veil-ash-canister',
    'anomalous-core',
    'cinder-wire',
  ] as const;

  samples.forEach((resourceId) => {
    const hint = resolveResourceSourceHint(resourceId, {
      profile,
      preferContractDirected: false,
    });
    lines.push(`[${hint.tier}] ${hint.resourceName}`);
    hint.lines.forEach((line) => lines.push(`  ${line}`));
    lines.push(`  compact: ${hint.compact}`);
    lines.push('');
  });

  lines.push('-- SECTOR FARMING PREVIEW --');
  ALL_SECTOR_IDS.forEach((sectorId) => {
    lines.push(`${sectorId}:`);
    formatSectorFarmingPreviewLines(sectorId, profile).forEach((line) => {
      lines.push(`  ${line}`);
    });
  });

  lines.push('');
  lines.push('-- COVERAGE --');
  const empty = assertAllEconomyResourcesHaveHints(profile);
  let exact = 0;
  let partial = 0;
  let unknown = 0;
  ECONOMY_V1_RESOURCE_IDS.forEach((id) => {
    const tier = resolveResourceSourceHint(id, { profile, preferContractDirected: false }).tier;
    if (tier === 'EXACT') exact += 1;
    else if (tier === 'PARTIAL') partial += 1;
    else if (tier === 'UNKNOWN') unknown += 1;
  });
  lines.push(`Economy resources: ${ECONOMY_V1_RESOURCE_IDS.length}`);
  lines.push(`Tiers @ sample profile: EXACT ${exact} · PARTIAL ${partial} · UNKNOWN ${unknown}`);
  lines.push(`Empty hint lines: ${empty.length ? empty.join(', ') : '(none)'}`);
  lines.push(
    `Registry sourceHint blanks: ${
      ECONOMY_V1_RESOURCE_IDS.filter((id) => !RESOURCE_REGISTRY[id].sourceHint.trim()).length
    }`,
  );

  const issues = validateResourceRegistry().filter((issue) => (
    issue.message.includes('Phase 2G')
    || issue.message.includes('source hint')
  ));
  lines.push(`Phase 2G validation issues: ${issues.length}`);
  issues.slice(0, 12).forEach((issue) => {
    lines.push(`  [${issue.severity}] ${issue.resourceId ?? 'hint'}: ${issue.message}`);
  });

  const pass = empty.length === 0 && issues.length === 0 && exact > 0;
  lines.push('');
  lines.push(
    pass
      ? 'PASS — Source hints resolve Exact/Partial/Unknown; farming previews wired.'
      : 'FAIL — source hint system incomplete.',
  );
  lines.push('Rule: if the player needs Rail Capacitor, tell them to breach Slag Works.');

  return lines.join('\n');
}
