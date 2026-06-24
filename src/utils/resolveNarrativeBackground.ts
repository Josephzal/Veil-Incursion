import type { ImageSourcePropType } from 'react-native';
import CityStreetNarrativeBg from '../../assets/narrative images/city-street.png';
import { isCityStreetsNarrative } from '../components/NarrativeStepperModule';
import { isOpenSectorNarrative } from '../data/sectorNarrativeEngine';
import type { NarrativeEventNode } from '../types/game';

export function resolveNarrativeBackgroundImage(node: NarrativeEventNode): ImageSourcePropType {
  if (isCityStreetsNarrative(node)) {
    return CityStreetNarrativeBg;
  }
  if (node.interactionMode === 'procedural' || !isOpenSectorNarrative(node)) {
    return CityStreetNarrativeBg;
  }
  return CityStreetNarrativeBg;
}
