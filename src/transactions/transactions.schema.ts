import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TransactionDocument = CachedTransaction & Document;

@Schema({ collection: 'transactions' })
export class CachedTransaction {
  @Prop({ required: true, index: true }) txid: string;
  @Prop({ type: Object, required: true }) data: Record<string, unknown>;
  @Prop({ required: true, expires: 0 }) expiresAt: Date;
}

export const CachedTransactionSchema = SchemaFactory.createForClass(CachedTransaction);

export type RecentTransactionsCacheDocument = RecentTransactionsCache & Document;

@Schema({ collection: 'recent_txs' })
export class RecentTransactionsCache {
  @Prop({ required: true, unique: true, index: true })
  key: string; // always "recent"

  @Prop({ type: [Object], required: true })
  data: Record<string, unknown>[];

  @Prop({ required: true })
  expiresAt: Date;
}

export const RecentTransactionsCacheSchema = SchemaFactory.createForClass(RecentTransactionsCache);

RecentTransactionsCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
