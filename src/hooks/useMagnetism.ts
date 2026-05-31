import { useEffect, useMemo, useState } from 'react';
import { MACRO_SECTORS, getMacroSector } from '../data/macroSectors';
import { MacroSectorId, MagnetismState } from '../types/regional';

const WEAK_SIGNAL_THRESHOLD = 45;

function simulateTrafficDensity(base: number, sectorId: MacroSectorId, tick: number): number {
  const jitter = ((sectorId.charCodeAt(0) + tick) % 17) - 8;
  return Math.max(8, Math.min(100, base + jitter));
}

export function useMagnetism(
  homeSectorId: MacroSectorId,
  isInfluenceFrozen: boolean,
  frozenInfluence: MagnetismState['influence'] | null,
): MagnetismState & {
  allSectors: typeof MACRO_SECTORS;
  selectSector: (id: MacroSectorId) => void;
  activeSectorId: MacroSectorId;
} {
  const [activeSectorId, setActiveSectorId] = useState<MacroSectorId>(homeSectorId);
  const [trafficTick, setTrafficTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTrafficTick((t) => t + 1), 8000);
    return () => clearInterval(timer);
  }, []);

  const sector = getMacroSector(activeSectorId);

  return useMemo(() => {
    const localTrafficDensity = simulateTrafficDensity(sector.baseTrafficDensity, activeSectorId, trafficTick);
    const isWeakLocalSignal = localTrafficDensity < WEAK_SIGNAL_THRESHOLD;
    const proxyMetropolitanNode = isWeakLocalSignal ? sector.metropolitanNode : null;
    const influence = isInfluenceFrozen && frozenInfluence
      ? frozenInfluence
      : { ...sector.influence };

    return {
      sectorId: activeSectorId,
      localTrafficDensity,
      isWeakLocalSignal,
      proxyMetropolitanNode,
      influence,
      isInfluenceFrozen,
      allSectors: MACRO_SECTORS,
      selectSector: setActiveSectorId,
      activeSectorId,
    };
  }, [activeSectorId, sector, trafficTick, homeSectorId, isInfluenceFrozen, frozenInfluence]);
}
