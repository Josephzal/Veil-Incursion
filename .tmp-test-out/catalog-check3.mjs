import { getLiveUniversalBoonDefinitions, getProductionOfferDefinitions, definitionAcquisitionWave } from '../src/data/nineStrain/definitionCatalog.ts';
for (const w of [1,2,3,4]) {
  console.log('wave<=',w, getProductionOfferDefinitions(w).length);
}
const defs = getLiveUniversalBoonDefinitions();
console.log('wave4 exact defs count:', defs.filter(d=>definitionAcquisitionWave(d)===4).length);
