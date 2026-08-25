import { getLiveUniversalBoonDefinitions, getProductionOfferDefinitions } from '../src/data/nineStrain/definitionCatalog.ts';
const live = getLiveUniversalBoonDefinitions();
console.log('total', live.length);
console.log('wave1', getProductionOfferDefinitions(1).length);
console.log('wave2', getProductionOfferDefinitions(2).length);
console.log('wave3', getProductionOfferDefinitions(3).length);
console.log('wave4', getProductionOfferDefinitions(4).length);
const byRole = {};
for (const d of live) byRole[d.role] = (byRole[d.role]||0)+1;
console.log('byRole', byRole);
const strains = new Set(live.map(d=>d.strainId));
console.log('strains', [...strains].sort());
for (const s of strains) {
  const rows = live.filter(d=>d.strainId===s && d.role !== 'CONVERGENCE');
  const byRole2 = {};
  for (const d of rows) byRole2[d.role] = (byRole2[d.role]||0)+1;
  console.log(s, byRole2, 'total', rows.length);
}
console.log('convergences total', live.filter(d=>d.role==='CONVERGENCE').length);
