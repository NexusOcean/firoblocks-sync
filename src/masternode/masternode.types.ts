export interface FiroMasternodeState {
  service: string;
  registeredHeight: number;
  lastPaidHeight: number;
  consecutivePayments: number;
  PoSePenalty: number;
  PoSeRevivedHeight: number;
  PoSeBanHeight: number;
  revocationReason: number;
  ownerAddress: string;
  votingAddress: string;
  platformNodeID?: string;
  platformP2PPort?: number;
  platformHTTPPort?: number;
  payoutAddress: string;
  pubKeyOperator: string;
  operatorPayoutAddress?: string;
}

export interface FiroMasternode {
  proTxHash: string;
  collateralHash: string;
  collateralIndex: number;
  collateralAddress: string;
  operatorReward: number;
  state: FiroMasternodeState;
  confirmations: number;
}
