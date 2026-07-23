import {
  FiroTransaction,
  FiroVin,
  FiroVout,
  TxCategory,
  TxFlag,
  TxType,
  TxVinDto,
  TxVoutDto,
  VoutKind,
  isCoinbaseVin,
  isLelantusJoinSplitVin,
  isSigmaSpendVin,
  isSparkSpendVin,
  isTransparentVin,
  isZerocoinSpendVin,
} from './transactions.types';

export interface ClassifiedTransaction {
  type: TxType;
  category: TxCategory;
  flags: TxFlag[];
  vin: TxVinDto[];
  vout: TxVoutDto[];
  fee: number | undefined;
}

export function classifyTransaction(raw: FiroTransaction): ClassifiedTransaction {
  const vin = raw.vin.map(classifyVin);
  const vout = raw.vout.map(classifyVout);

  const isCoinbase = raw.vin.length > 0 && isCoinbaseVin(raw.vin[0]);
  const category = resolveCategory(raw, vin, vout, isCoinbase);
  const type = categoryToLegacyType(category);
  const flags = resolveFlags(vin, vout);
  const fee = computeFee(raw, vin, vout, category);

  return { type, category, flags, vin, vout, fee };
}

function classifyVin(v: FiroVin): TxVinDto {
  if (isCoinbaseVin(v)) {
    return { kind: 'coinbase', coinbase: v.coinbase };
  }
  if (isTransparentVin(v)) {
    return {
      kind: 'transparent',
      txid: v.txid,
      vout: v.vout,
      address: v.address,
      value: v.value,
    };
  }
  if (isSparkSpendVin(v)) {
    return { kind: 'spark_spend', nFees: v.nFees, lTags: v.lTags };
  }
  if (isLelantusJoinSplitVin(v)) {
    return { kind: 'lelantus_joinsplit', nFees: v.nFees, serials: v.serials };
  }
  if (isSigmaSpendVin(v)) {
    return { kind: 'sigma_spend', nFees: v.nFees, serials: v.serials };
  }
  if (isZerocoinSpendVin(v)) {
    return { kind: 'zerocoin_spend' };
  }
  return { kind: 'unknown' };
}

function classifyVout(v: FiroVout): TxVoutDto {
  const type = v.scriptPubKey.type;
  const addresses = v.scriptPubKey.addresses ?? [];
  const kind = resolveVoutKind(type, v.scriptPubKey.asm);
  const isPrivate =
    kind === 'spark_mint' ||
    kind === 'spark_smint' ||
    kind === 'lelantus_mint' ||
    kind === 'lelantus_jmint' ||
    kind === 'sigma_mint' ||
    kind === 'zerocoin_mint';

  return { n: v.n, value: v.value, kind, type, addresses, isPrivate };
}

function resolveVoutKind(scriptType: string, asm: string): VoutKind {
  switch (scriptType) {
    case 'pubkeyhash':
    case 'scripthash':
    case 'pubkey':
    case 'multisig':
    case 'witness_v0_keyhash':
    case 'witness_v0_scripthash':
      return 'transparent';
    case 'nulldata':
      return 'op_return';
    case 'sparkmint':
      return asm.startsWith('OP_SPARKSMINT') ? 'spark_smint' : 'spark_mint';
    case 'lelantusmint':
      return asm.startsWith('OP_LELANTUSJMINT') ? 'lelantus_jmint' : 'lelantus_mint';
    case 'sigmamint':
      return 'sigma_mint';
    case 'zerocoinmint':
      return 'zerocoin_mint';
    case 'exchangeaddr':
      return 'exchange_addr';
    default:
      if (asm.startsWith('OP_SPARKSMINT')) return 'spark_smint';
      if (asm.startsWith('OP_SPARKMINT')) return 'spark_mint';
      if (asm.startsWith('OP_LELANTUSJMINT')) return 'lelantus_jmint';
      if (asm.startsWith('OP_LELANTUSMINT')) return 'lelantus_mint';
      if (asm.startsWith('OP_SIGMAMINT')) return 'sigma_mint';
      if (asm.startsWith('OP_ZEROCOINMINT')) return 'zerocoin_mint';
      if (asm.startsWith('OP_RETURN')) return 'op_return';
      return 'unknown';
  }
}

function resolveCategory(
  raw: FiroTransaction,
  vin: TxVinDto[],
  vout: TxVoutDto[],
  isCoinbase: boolean,
): TxCategory {
  if (isCoinbase) return 'coinbase';

  switch (raw.type) {
    case 1:
      return 'masternode_register';
    case 2:
      return 'masternode_update_service';
    case 3:
      return 'masternode_update_registrar';
    case 4:
      return 'masternode_revoke';
    case 5:
      return 'coinbase_payload';
    case 6:
      return 'quorum_commitment';
    case 8:
      return 'lelantus_joinsplit';
    case 9:
      return 'spark_spend';
  }

  if (vin.some((v) => v.kind === 'sigma_spend')) return 'sigma_spend';
  if (vin.some((v) => v.kind === 'zerocoin_spend')) return 'zerocoin_spend';

  const hasSparkMint = vout.some((v) => v.kind === 'spark_mint' || v.kind === 'spark_smint');
  const hasLelantusMint = vout.some(
    (v) => v.kind === 'lelantus_mint' || v.kind === 'lelantus_jmint',
  );
  const hasSigmaMint = vout.some((v) => v.kind === 'sigma_mint');
  const hasZerocoinMint = vout.some((v) => v.kind === 'zerocoin_mint');

  if (hasSparkMint && vin.some((v) => v.kind === 'lelantus_joinsplit')) {
    return 'lelantus_to_spark';
  }

  if (hasSparkMint) return 'spark_mint';
  if (hasLelantusMint) return 'lelantus_mint';
  if (hasSigmaMint) return 'sigma_mint';
  if (hasZerocoinMint) return 'zerocoin_mint';

  if (vin.every((v) => v.kind === 'transparent')) return 'transparent';

  return 'unknown';
}

function categoryToLegacyType(category: TxCategory): TxType {
  switch (category) {
    case 'coinbase':
    case 'coinbase_payload':
      return 'coinbase';
    case 'transparent':
      return 'transparent';
    case 'spark_mint':
    case 'spark_spend':
      return 'spark';
    case 'masternode_register':
    case 'masternode_update_service':
    case 'masternode_update_registrar':
    case 'masternode_revoke':
    case 'quorum_commitment':
      return 'masternode';
    default:
      return 'unknown';
  }
}

function resolveFlags(vin: TxVinDto[], vout: TxVoutDto[]): TxFlag[] {
  const flags: TxFlag[] = [];

  const hasPrivateInput = vin.some(
    (v) =>
      v.kind === 'spark_spend' ||
      v.kind === 'lelantus_joinsplit' ||
      v.kind === 'sigma_spend' ||
      v.kind === 'zerocoin_spend',
  );
  const hasTransparentOutput = vout.some((v) => v.kind === 'transparent');
  if (hasPrivateInput && hasTransparentOutput) {
    flags.push('has_transparent_change');
  }

  if (vout.some((v) => v.kind === 'op_return')) flags.push('has_op_return');
  if (vout.some((v) => v.type === 'scripthash')) flags.push('has_p2sh');
  if (vout.some((v) => v.type === 'multisig')) flags.push('has_multisig');
  if (vout.some((v) => v.kind === 'exchange_addr')) flags.push('has_exchange_addr');

  return flags;
}

function computeFee(
  raw: FiroTransaction,
  vin: TxVinDto[],
  vout: TxVoutDto[],
  category: TxCategory,
): number | undefined {
  if (category === 'spark_spend') {
    return raw.vin.find(isSparkSpendVin)?.nFees;
  }
  if (category === 'lelantus_joinsplit') {
    return raw.vin.find(isLelantusJoinSplitVin)?.nFees;
  }
  if (category === 'transparent') {
    const totalIn = vin.reduce((s, v) => s + (v.value ?? 0), 0);
    const totalOut = vout.reduce((s, v) => s + v.value, 0);
    const fee = totalIn - totalOut;
    return fee > 0 ? parseFloat(fee.toFixed(8)) : undefined;
  }
  return undefined;
}
