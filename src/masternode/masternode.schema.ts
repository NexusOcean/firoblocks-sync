import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { FiroMasternode } from '../masternode/masternode.types';

export interface MasternodeGeo {
  country: string;
  countryCode: string;
  asn: number;
  org: string;
}

export interface MasternodeStats {
  total: number;
  resolved: number;
  countries: { countryCode: string; country: string; count: number }[];
  asns: { asn: number; org: string; count: number }[];
}

export type StoredMasternode = FiroMasternode & { geo?: MasternodeGeo };

export type MasternodeCacheDocument = HydratedDocument<MasternodeCache>;

@Schema({ collection: 'masternode_cache' })
export class MasternodeCache {
  @Prop({ required: true, unique: true })
  key: string;

  @Prop({ type: Array })
  data: StoredMasternode[];

  @Prop({ type: Object })
  stats: MasternodeStats;

  @Prop({ required: true })
  fetchedAt: Date;
}

export const MasternodeCacheSchema = SchemaFactory.createForClass(MasternodeCache);
