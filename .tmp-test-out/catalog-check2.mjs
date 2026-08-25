import { getLiveUniversalBoonDefinitions } from '../src/data/nineStrain/definitionCatalog.ts';
const defs = getLiveUniversalBoonDefinitions();
console.log('total live:', defs.length);
const byStrain = {};
for (const d of defs) { byStrain[d.strainId] = (byStrain[d.strainId]||0)+1; }
console.log(byStrain);
console.log('convergences:', defs.filter(d=>d.role==='CONVERGENCE').length);
