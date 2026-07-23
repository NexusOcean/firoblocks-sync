export interface FiroScriptPubKey {
  asm: string;
  hex: string;
  type: string;
  reqSigs?: number;
  addresses?: string[];
}

export interface FiroScriptSig {
  asm: string;
  hex: string;
}

export interface FiroVinTransparent {
  txid: string;
  vout: number;
  scriptSig: FiroScriptSig;
  value: number;
  valueSat: number;
  address: string;
  sequence: number;
}

export interface FiroVinCoinbase {
  coinbase: string;
  sequence: number;
}

export interface FiroVinSparkSpend {
  scriptSig: FiroScriptSig;
  nFees: number;
  lTags: string[];
  sequence: number;
}

export interface FiroVinLelantusJoinSplit {
  scriptSig: FiroScriptSig;
  nFees: number;
  serials: string[];
  sequence: number;
}

export interface FiroVinSigmaSpend {
  scriptSig: FiroScriptSig;
  nFees?: number;
  serials?: string[];
  sequence: number;
}

export interface FiroVinZerocoinSpend {
  scriptSig: FiroScriptSig;
  sequence: number;
}

export type FiroVin =
  | FiroVinTransparent
  | FiroVinCoinbase
  | FiroVinSparkSpend
  | FiroVinLelantusJoinSplit
  | FiroVinSigmaSpend
  | FiroVinZerocoinSpend;

export interface FiroVout {
  value: number;
  n: number;
  scriptPubKey: FiroScriptPubKey;
}

export type FiroTxType = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 9;

export interface FiroTransaction {
  txid: string;
  hash: string;
  hex: string;
  size: number;
  vsize: number;
  version: number;
  locktime: number;
  type: FiroTxType;
  vin: FiroVin[];
  vout: FiroVout[];
  blockhash: string;
  height: number;
  confirmations: number;
  time: number;
  blocktime: number;
  instantlock: boolean;
  chainlock: boolean;
  cbTx?: {
    version: number;
    height: number;
    merkleRootMNList: string;
    merkleRootQuorums: string;
  };
  sparkData?: string;
  lelantusData?: string;
  extraPayload?: string;
}

export function isCoinbaseVin(vin: FiroVin): vin is FiroVinCoinbase {
  return 'coinbase' in vin;
}

export function isSparkSpendVin(vin: FiroVin): vin is FiroVinSparkSpend {
  return 'lTags' in vin;
}

export function isLelantusJoinSplitVin(vin: FiroVin): vin is FiroVinLelantusJoinSplit {
  return (
    'serials' in vin && 'scriptSig' in vin && vin.scriptSig.asm.startsWith('OP_LELANTUSJOINSPLIT')
  );
}

export function isSigmaSpendVin(vin: FiroVin): vin is FiroVinSigmaSpend {
  return 'scriptSig' in vin && vin.scriptSig.asm.startsWith('OP_SIGMASPEND');
}

export function isZerocoinSpendVin(vin: FiroVin): vin is FiroVinZerocoinSpend {
  return 'scriptSig' in vin && vin.scriptSig.asm.startsWith('OP_ZEROCOINSPEND');
}

export function isTransparentVin(vin: FiroVin): vin is FiroVinTransparent {
  return (
    'txid' in vin && 'vout' in vin && 'address' in vin && !('lTags' in vin) && !('serials' in vin)
  );
}

export type VinKind =
  | 'coinbase'
  | 'transparent'
  | 'spark_spend'
  | 'lelantus_joinsplit'
  | 'sigma_spend'
  | 'zerocoin_spend'
  | 'unknown';

export type VoutKind =
  | 'transparent'
  | 'spark_mint'
  | 'spark_smint'
  | 'lelantus_mint'
  | 'lelantus_jmint'
  | 'sigma_mint'
  | 'zerocoin_mint'
  | 'op_return'
  | 'exchange_addr'
  | 'unknown';

export type TxType = 'coinbase' | 'transparent' | 'spark' | 'masternode' | 'unknown';

export type TxCategory =
  | 'coinbase'
  | 'transparent'
  | 'lelantus_mint'
  | 'lelantus_joinsplit'
  | 'lelantus_to_spark'
  | 'spark_mint'
  | 'spark_spend'
  | 'sigma_mint'
  | 'sigma_spend'
  | 'zerocoin_mint'
  | 'zerocoin_spend'
  | 'masternode_register'
  | 'masternode_update_service'
  | 'masternode_update_registrar'
  | 'masternode_revoke'
  | 'coinbase_payload'
  | 'quorum_commitment'
  | 'unknown';

export type TxFlag =
  | 'has_transparent_change'
  | 'has_op_return'
  | 'has_p2sh'
  | 'has_multisig'
  | 'has_exchange_addr';

export class TxVinDto {
  kind: VinKind;

  txid?: string;

  vout?: number;

  address?: string;

  value?: number;

  nFees?: number;

  lTags?: string[];

  serials?: string[];

  coinbase?: string;
}

export class TxVoutDto {
  n: number;

  value: number;

  kind: VoutKind;

  type: string;

  addresses: string[];

  isPrivate: boolean;
}

export class TransactionDto {
  txid: string;

  type: TxType;

  category: TxCategory;

  flags: TxFlag[];

  size: number;

  fee?: number;

  confirmations: number;

  time: number;

  blockHash: string;

  blockHeight: number;

  chainlock: boolean;

  instantlock: boolean;

  vin: TxVinDto[];

  vout: TxVoutDto[];
}
