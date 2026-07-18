import { createDefaultCargoRunState } from '../types/cargoGrid';
import type { ResourceItemId } from '../types/resourceItem';
import { createEmptyRunPhysicalBankSnapshot } from '../types/runResourceLedger';
import {
  bankEligiblePhysicalRunCargo,
  formatCargoOwnershipBrief,
  listApexNonBankableResourceIds,
  ownershipLabel,
  CARGO_OWNERSHIP_RULES_COPY,
} from './cargoOwnershipEngine';
import { addLootToContainmentDetailed } from './cargoGridEngine';
import {
  ALL_RESOURCE_ITEM_IDS,
  RESOURCE_REGISTRY,
  RESOURCES_BY_CATEGORY,
} from './resourceRegistry';
import { validateResourceRegistry } from './resourceValidation';

/** Phase 2B — registry completeness + source identity dump. */
export function formatResourceRegistryNormalizationReport(): string {
  const lines: string[] = [
    '=== PHASE 2B // RESOURCE REGISTRY NORMALIZATION ===',
    `Roster: ${ALL_RESOURCE_ITEM_IDS.length} resources`,
    '',
  ];

  (['STABLE', 'INTEL', 'UNSTABLE', 'CONTRABAND'] as const).forEach((category) => {
    lines.push(`-- ${category} (${RESOURCES_BY_CATEGORY[category].length}) --`);
    RESOURCES_BY_CATEGORY[category].forEach((id) => {
      const def = RESOURCE_REGISTRY[id];
      const depths = `${def.depthRules.minDepth}-${def.depthRules.maxDepth}`
        + (def.depthRules.preferredDepths.length
          ? ` pref[${def.depthRules.preferredDepths.join(',')}]`
          : '');
      lines.push(
        `${def.shortName.padEnd(22)} ${def.rarity.padEnd(8)} `
        + `primary=${def.primarySectors.length} secondary=${def.secondarySources.length} `
        + `depth=${depths} bank=${def.canBeBankedAtSafehouse ? 'Y' : 'N'} `
        + `carried=${def.hasCarriedEffect ? def.carriedEffectId : '-'}`,
      );
    });
    lines.push('');
  });

  const issues = validateResourceRegistry();
  const phase2b = issues.filter((issue) => (
    issue.message.includes('primarySectors')
    || issue.message.includes('secondarySources')
    || issue.message.includes('depthRules')
    || issue.message.includes('SOURCE_IDENTITY')
    || issue.message.includes('carried')
    || issue.message.includes('Apex cargo')
    || issue.message.includes('orphan')
    || issue.message.includes('description')
  ));
  lines.push(`Phase 2B validation issues: ${phase2b.length} / total ${issues.length}`);
  phase2b.slice(0, 20).forEach((issue) => {
    lines.push(`  [${issue.severity}] ${issue.resourceId ?? '?'}: ${issue.message}`);
  });

  const apexBlocked = listApexNonBankableResourceIds();
  lines.push('');
  lines.push(`Apex non-bankable: ${apexBlocked.map((id) => RESOURCE_REGISTRY[id].shortName).join(', ') || '(none)'}`);

  return lines.join('\n');
}

/** Phase 2B.1 — ownership rules + banking smoke. */
export function formatCargoOwnershipRulesReport(): string {
  const lines = [
    '=== PHASE 2B.1 // CARGO OWNERSHIP RULES ===',
    ...(['CARRIED', 'BANKED', 'EXTRACTED', 'LOST'] as const).map(
      (state) => `${ownershipLabel(state)} — ${CARGO_OWNERSHIP_RULES_COPY[state]}`,
    ),
    '',
    'Safe extract: carried + banked → hub stash.',
    'Dirty extract (success): same conversion; penalties handled elsewhere.',
    'Death: banked → hub stash; carried → lost.',
    'Apex (Anomalous Core, Sealed Casket): cannot mid-run bank.',
    '',
  ];

  let cargo = createDefaultCargoRunState();
  cargo = addLootToContainmentDetailed(cargo, 'ley-slag', 3).cargo;
  cargo = addLootToContainmentDetailed(cargo, 'anomalous-core', 1).cargo;
  cargo = addLootToContainmentDetailed(cargo, 'sealed-containment-casket', 1).cargo;

  const bank = createEmptyRunPhysicalBankSnapshot();
  const result = bankEligiblePhysicalRunCargo(cargo, bank);
  const bankedLey = result.bankedResources['ley-slag'] ?? 0;
  const stillCarriedCore = result.cargo.containment.some((i) => i.itemId === 'anomalous-core')
    || result.cargo.grid.placed.some((i) => i.itemId === 'anomalous-core');
  const stillCarriedCasket = result.cargo.containment.some((i) => i.itemId === 'sealed-containment-casket')
    || result.cargo.grid.placed.some((i) => i.itemId === 'sealed-containment-casket');

  lines.push(`Smoke: bank 3× Ley-Slag + Core + Casket`);
  lines.push(`  banked Ley-Slag=${bankedLey} blockedUnits=${result.blockedUnitCount}`);
  lines.push(`  core still carried=${stillCarriedCore} casket still carried=${stillCarriedCasket}`);
  lines.push(
    bankedLey === 3 && stillCarriedCore && stillCarriedCasket
      ? 'PASS — bankable stacks secured; apex remains carried.'
      : 'FAIL — banking partition incorrect.',
  );
  lines.push('');
  lines.push(formatCargoOwnershipBrief({
    carried: { 'anomalous-core': 1, 'sealed-containment-casket': 1 },
    banked: { 'ley-slag': bankedLey },
  }));

  return lines.join('\n');
}

export function formatResourceSourceIdentityLine(resourceId: ResourceItemId): string {
  const def = RESOURCE_REGISTRY[resourceId];
  return [
    def.name,
    `primary: ${def.primarySectors.join(', ')}`,
    `secondary: ${def.secondarySources.join(' | ')}`,
    `depth: ${def.depthRules.minDepth}-${def.depthRules.maxDepth}`,
    `hint: ${def.sourceHint}`,
  ].join('\n');
}
