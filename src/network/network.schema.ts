import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type NetworkStatsDocument = HydratedDocument<NetworkStats>;

@Schema({ collection: 'network_stats', timestamps: true })
export class NetworkStats {
  @Prop({ required: true })
  chain: string;

  @Prop({ required: true })
  type: string;

  // From gettxoutsetinfo
  @Prop()
  height?: number;

  @Prop()
  transactions?: number;

  @Prop()
  totalSupply?: number;

  // From getblockchaininfo
  @Prop()
  difficulty?: number;

  @Prop()
  bestBlockHash?: string;

  // From getnetworkhashps
  @Prop()
  hashrate?: number;

  @Prop({ required: true })
  updatedAt: Date;
}

export const NetworkStatsSchema = SchemaFactory.createForClass(NetworkStats);

NetworkStatsSchema.index({ chain: 1, type: 1 }, { unique: true });
