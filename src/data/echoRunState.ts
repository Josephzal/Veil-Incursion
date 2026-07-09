export interface EchoRunState {
  echoSignalsDiscovered: number;
  echoSignalsResolved: number;
  fallenEchoesLooted: number;
  echoesStabilized: number;
  hostileEchoesDefeated: number;
  cargoEchoesRecovered: number;
  assistEchoesTriggered: number;
  extractionEchoesUsed: number;
  echoOperationProgress: number;
  echoGlassRecovered: number;
  echoCreditsRecovered: number;
  echoRewardsExtracted: number;
  /** Extraction echo shaves emergency recall cargo bleed once. */
  extractionRecallBonusPending: boolean;
}

export function createDefaultEchoRunState(): EchoRunState {
  return {
    echoSignalsDiscovered: 0,
    echoSignalsResolved: 0,
    fallenEchoesLooted: 0,
    echoesStabilized: 0,
    hostileEchoesDefeated: 0,
    cargoEchoesRecovered: 0,
    assistEchoesTriggered: 0,
    extractionEchoesUsed: 0,
    echoOperationProgress: 0,
    echoGlassRecovered: 0,
    echoCreditsRecovered: 0,
    echoRewardsExtracted: 0,
    extractionRecallBonusPending: false,
  };
}

export function recordEchoRewardsExtracted(
  state: EchoRunState,
  quantity: number,
): EchoRunState {
  if (quantity <= 0) return state;
  return {
    ...state,
    echoRewardsExtracted: state.echoRewardsExtracted + quantity,
  };
}

export const ECHO_OPERATION_PROGRESS = {
  resolveFallenRunner: 1,
  stabilizeEcho: 2,
  defeatHostileEcho: 3,
  recoverEchoCargo: 1,
  extractionEchoUsed: 1,
  assistEchoTriggered: 0,
} as const;
