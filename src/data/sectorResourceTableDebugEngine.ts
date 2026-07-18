import { ALL_SECTOR_IDS, veilBiomeToSectorId } from './sectorBiomeBridge';
import { ECONOMY_V1_RESOURCE_IDS } from './economyRosterV1';
import { RESOURCE_REGISTRY } from './resourceRegistry';
import { validateResourceRegistry } from './resourceValidation';
import {
  SECTOR_RESOURCE_TABLES,
  formatSectorResourceTableBrief,
  listEconomyResourcesMissingFromSectorTables,
  sectorPrimaryResourcePool,
  sectorRareResourcePool,
  sectorsListingResource,
} from './sectorResourceTableEngine';
import { rollExpansionIdentityExtras } from './resourceDropIdentityEngine';
import type { VeilBiome } from '../types/encounterSpawn';

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Phase 2D — sector farming identity tables + drop-identity smoke. */
export function formatSectorResourceTablesReport(): string {
  const lines: string[] = [
    '=== ECONOMY SPINE // PHASE 2D — SECTOR RESOURCE TABLES ===',
    '',
  ];

  ALL_SECTOR_IDS.forEach((sectorId) => {
    lines.push(formatSectorResourceTableBrief(sectorId));
    const table = SECTOR_RESOURCE_TABLES[sectorId];
    const bands = table.resources
      .map((entry) => `${entry.band}:${RESOURCE_REGISTRY[entry.resourceId].shortName}`)
      .join(' · ');
    lines.push(`Bands: ${bands}`);
    lines.push('');
  });

  const missing = listEconomyResourcesMissingFromSectorTables();
  lines.push(
    `Economy resources missing from tables: ${missing.length ? missing.join(', ') : '(none)'}`,
  );

  const issues = validateResourceRegistry().filter((issue) => (
    issue.message.includes('Phase 2D')
    || issue.message.includes('SECTOR_RESOURCE')
    || issue.message.includes('sector resource table')
    || issue.message.includes('PRIMARY on')
    || issue.message.includes('Missing SECTOR_RESOURCE')
    || issue.message.includes('needs at least 3 PRIMARY')
    || issue.message.includes('outside validSectorIds')
  ));
  lines.push(`Phase 2D validation issues: ${issues.length}`);
  issues.slice(0, 20).forEach((issue) => {
    lines.push(`  [${issue.severity}] ${issue.resourceId ?? 'table'}: ${issue.message}`);
  });

  lines.push('');
  lines.push('-- IDENTITY MAP (resource → PRIMARY sectors) --');
  ECONOMY_V1_RESOURCE_IDS.forEach((resourceId) => {
    const primarySectors = sectorsListingResource(resourceId, 'PRIMARY');
    if (primarySectors.length === 0) return;
    lines.push(
      `${RESOURCE_REGISTRY[resourceId].shortName.padEnd(24)} → ${primarySectors.join(', ')}`,
    );
  });

  lines.push('');
  lines.push('-- DROP IDENTITY SMOKE (seeded) --');
  const biomes: VeilBiome[] = [
    'NULL_ZONE',
    'ABYSSAL_SINK',
    'ASHEN_WASTE',
    'SLAG_WORKS',
    'BLACKLINE_TERMINUS',
  ];
  biomes.forEach((biome, index) => {
    const sectorId = veilBiomeToSectorId(biome);
    const rng = mulberry32(0x2d00 + index * 17);
    const d1 = rollExpansionIdentityExtras({
      districtDepth: 1,
      veilBiome: biome,
      rng,
    });
    const d2Elite = rollExpansionIdentityExtras({
      districtDepth: 2,
      veilBiome: biome,
      isElite: true,
      highRisk: true,
      rng: mulberry32(0x2d80 + index * 17),
    });
    const primary = sectorPrimaryResourcePool(sectorId)
      .map((id) => RESOURCE_REGISTRY[id].shortName)
      .join('/');
    const rare = sectorRareResourcePool(sectorId)
      .map((id) => RESOURCE_REGISTRY[id].shortName)
      .join('/');
    lines.push(
      `${biome}: primary[${primary}] rare[${rare || '-'}] `
      + `D1→[${d1.map((id) => RESOURCE_REGISTRY[id].shortName).join(', ') || '—'}] `
      + `D2elite→[${d2Elite.map((id) => RESOURCE_REGISTRY[id].shortName).join(', ') || '—'}]`,
    );
  });

  const pass = missing.length === 0 && issues.length === 0;
  lines.push('');
  lines.push(
    pass
      ? 'PASS — every sector has a farming identity; PRIMARY rows match registry primarySectors.'
      : 'FAIL — sector resource tables incomplete or misaligned.',
  );
  lines.push('Rule: map decision first (“I need X → sector Y”). Depth rules are Phase 2E; packets are 2F.');

  return lines.join('\n');
}
