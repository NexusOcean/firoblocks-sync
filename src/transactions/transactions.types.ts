// ─── RPC raw shapes ───────────────────────────────────────────────────────────
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

export type FiroVin = FiroVinTransparent | FiroVinCoinbase | FiroVinSparkSpend;

export interface FiroVout {
  value: number;
  n: number;
  scriptPubKey: FiroScriptPubKey;
}

export type FiroTxType = 0 | 5 | 6 | 8 | 9;

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
}

// ─── Type guards ──────────────────────────────────────────────────────────────
export function isCoinbaseVin(vin: FiroVin): vin is FiroVinCoinbase {
  return 'coinbase' in vin;
}

export function isSparkSpendVin(vin: FiroVin): vin is FiroVinSparkSpend {
  return 'lTags' in vin;
}

export function isTransparentVin(vin: FiroVin): vin is FiroVinTransparent {
  return 'txid' in vin;
}

// ─── REST response DTOs ───────────────────────────────────────────────────────
export type TxType = 'coinbase' | 'transparent' | 'spark' | 'unknown';

export class TxVinDto {
  txid?: string;

  vout?: number;

  address?: string;

  value?: number;

  nFees?: number;

  lTags?: string[];

  coinbase?: string;
}

export class TxVoutDto {
  n: number;

  value: number;

  type: string;

  addresses: string[];
}

export class TransactionDto {
  txid: string;

  type: TxType;

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
