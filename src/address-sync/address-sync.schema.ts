import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AddressDocument = CachedAddress & Document;

@Schema({ collection: 'cached_addresses' })
export class CachedAddress {
  @Prop({ required: true, unique: true, index: true })
  address: string;

  @Prop({ type: Object, required: true })
  data: Record<string, unknown>;

  @Prop({ default: () => new Date(Date.now() + 60 * 60 * 1000) })
  expiresAt?: Date;
}

export const CachedAddressSchema = SchemaFactory.createForClass(CachedAddress);

CachedAddressSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
