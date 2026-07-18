import {
  ECONOMY_V1_CONTRABAND_IDS,
  ECONOMY_V1_COUNTS,
  ECONOMY_V1_INTEL_IDS,
  ECONOMY_V1_RESOURCE_IDS,
  ECONOMY_V1_ROSTER_FROZEN,
  ECONOMY_V1_STABLE_IDS,
  ECONOMY_V1_UNSTABLE_IDS,
  PHASE_2C_FULL_ROSTER_IDS,
  ROUTE_INTEL_V1_IDS,
  formatEconomyRosterV1Summary,
} from './economyRosterV1';
import { ALL_RESOURCE_ITEM_IDS, RESOURCE_REGISTRY, RESOURCES_BY_CATEGORY } from './resourceRegistry';
import { validateResourceRegistry } from './resourceValidation';

function listNames(ids: readonly string[]): string {
  return ids.map((id) => RESOURCE_REGISTRY[id as keyof typeof RESOURCE_REGISTRY]?.shortName ?? id).join(', ');
}

/** Phase 2C — frozen roster confirmation report. */
export function formatEconomyRosterV1FreezeReport(): string {
  const lines: string[] = [
    '=== PHASE 2C // FINAL RESOURCE ROSTER V1 ===',
    formatEconomyRosterV1Summary(),
    `Registry size: ${ALL_RESOURCE_ITEM_IDS.length}`,
    `Frozen flag: ${ECONOMY_V1_ROSTER_FROZEN ? 'YES' : 'NO'}`,
    '',
    `-- STABLE (${ECONOMY_V1_COUNTS.STABLE}) --`,
    listNames(ECONOMY_V1_STABLE_IDS),
    '',
    `-- UNSTABLE (${ECONOMY_V1_COUNTS.UNSTABLE}) --`,
    listNames(ECONOMY_V1_UNSTABLE_IDS),
    '',
    `-- INTEL economy (${ECONOMY_V1_COUNTS.INTEL}) --`,
    listNames(ECONOMY_V1_INTEL_IDS),
    '',
    `-- CONTRABAND (${ECONOMY_V1_COUNTS.CONTRABAND}) --`,
    listNames(ECONOMY_V1_CONTRABAND_IDS),
    '',
    `-- ROUTE INTEL (${ECONOMY_V1_COUNTS.ROUTE_INTEL}) — progression, not economy --`,
    listNames(ROUTE_INTEL_V1_IDS),
    '',
  ];

  const registrySet = new Set(ALL_RESOURCE_ITEM_IDS);
  const freezeSet = new Set<string>(PHASE_2C_FULL_ROSTER_IDS);
  const missing = PHASE_2C_FULL_ROSTER_IDS.filter((id) => !registrySet.has(id));
  const extras = ALL_RESOURCE_ITEM_IDS.filter((id) => !freezeSet.has(id));

  lines.push(`Missing from registry: ${missing.length ? missing.join(', ') : '(none)'}`);
  lines.push(`Outside freeze set: ${extras.length ? extras.join(', ') : '(none)'}`);
  lines.push(
    `Category live counts: S${RESOURCES_BY_CATEGORY.STABLE.length}`
    + `/U${RESOURCES_BY_CATEGORY.UNSTABLE.length}`
    + `/I${RESOURCES_BY_CATEGORY.INTEL.length}`
    + `/C${RESOURCES_BY_CATEGORY.CONTRABAND.length}`,
  );

  const issues = validateResourceRegistry().filter((issue) => (
    issue.message.includes('Phase 2C')
    || issue.message.includes('frozen')
    || issue.message.includes('Economy v1')
    || issue.message.includes('Route intel')
  ));
  lines.push(`Phase 2C validation issues: ${issues.length}`);
  issues.slice(0, 16).forEach((issue) => {
    lines.push(`  [${issue.severity}] ${issue.resourceId ?? 'roster'}: ${issue.message}`);
  });

  const exactMatch = missing.length === 0
    && extras.length === 0
    && ALL_RESOURCE_ITEM_IDS.length === PHASE_2C_FULL_ROSTER_IDS.length
    && ECONOMY_V1_RESOURCE_IDS.length === 21
    && issues.length === 0;

  lines.push('');
  lines.push(
    exactMatch
      ? 'PASS — registry exactly matches frozen Phase 2C roster (21 economy + 4 route intel).'
      : 'FAIL — roster freeze mismatch; do not expand without an explicit Phase 2 decision.',
  );
  lines.push('Rule: make this roster work. Do not add materials yet.');

  return lines.join('\n');
}
