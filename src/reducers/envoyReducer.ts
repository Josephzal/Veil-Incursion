import {
  clampVeilFlux,
  computeVoidSiphoned,
  resolveEnvoyVoidSiphonedDamage,
} from '../types/envoyState';
import type { EnvoyCombatState } from '../types/classCombatResources';

export type EnvoyReducerAction =
  | { type: 'ENVOY_SYNC'; patch: Partial<EnvoyCombatState> }
  | { type: 'ENVOY_ENCOUNTER_START'; fluxMaxCap: number; startingFlux: number; masochisticChannel: boolean }
  | { type: 'ENVOY_APPLY_FLUX_DELTA'; delta: number; masochisticChannel: boolean }
  | { type: 'ENVOY_SET_MASOCHISTIC'; masochisticChannel: boolean };

function withVoidSiphonedState(
  state: EnvoyCombatState,
  masochisticChannel: boolean,
): EnvoyCombatState {
  const isVoidSiphoned = computeVoidSiphoned(state.veilFlux);
  return {
    ...state,
    isVoidSiphoned,
    voidSiphonedTurnDamage: resolveEnvoyVoidSiphonedDamage(masochisticChannel),
  };
}

export function envoyReducer(
  state: EnvoyCombatState,
  action: EnvoyReducerAction,
): EnvoyCombatState {
  switch (action.type) {
    case 'ENVOY_SYNC':
      return { ...state, ...action.patch };

    case 'ENVOY_ENCOUNTER_START': {
      const veilFlux = clampVeilFlux(action.startingFlux, action.fluxMaxCap);
      return withVoidSiphonedState(
        {
          ...state,
          fluxMaxCap: action.fluxMaxCap,
          veilFlux,
        },
        action.masochisticChannel,
      );
    }

    case 'ENVOY_APPLY_FLUX_DELTA': {
      const veilFlux = clampVeilFlux(state.veilFlux + action.delta, state.fluxMaxCap);
      return withVoidSiphonedState(
        {
          ...state,
          veilFlux,
        },
        action.masochisticChannel,
      );
    }

    case 'ENVOY_SET_MASOCHISTIC':
      return withVoidSiphonedState(state, action.masochisticChannel);

    default:
      return state;
  }
}
