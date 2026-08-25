import { getLiveUniversalBoonDefinitions, definitionAcquisitionWave, getProductionOfferDefinitions } from '../src/data/nineStrain/definitionCatalog.ts';

const live = getLiveUniversalBoonDefinitions();
console.log('total live', live.length);
const byRole = {};
for (const d of live) {
  byRole[d.role] = (byRole[d.role] ?? 0) + 1;
}
console.log('by role', byRole);
const byWave = {};
for (const d of live) {
  const w = definitionAcquisitionWave(d);
  byWave[w] = (byWave[w] ?? 0) + 1;
}
console.log('by wave (def count)', byWave);
for (const w of [1,2,3,4]) {
  console.log('production pool wave', w, getProductionOfferDefinitions(w).length);
}
const strains = new Set(live.map((d) => d.strainId));
console.log('strains', [...strains].sort());
const perStrainCore = {};
for (const d of live) {
  if (d.role === 'CORE') perStrainCore[d.strainId] = (perStrainCore[d.strainId] ?? 0) + 1;
}
console.log('cores per strain', perStrainCore);
const perStrainSupport = {};
for (const d of live) {
  if (d.role === 'SUPPORT') perStrainSupport[d.strainId] = (perStrainSupport[d.strainId] ?? 0) + 1;
}
console.log('supports per strain', perStrainSupport);
const convergences = live.filter((d) => d.role === 'CONVERGENCE');
console.log('convergence count', convergences.length);
const ids = new Set(live.map((d) => d.id));
console.log('unique ids === total', ids.size === live.length);
