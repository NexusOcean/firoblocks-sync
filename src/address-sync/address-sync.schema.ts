import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AddressDocument = CachedAddress & Document;

@Schema({ collection: 'cachedaddresses' })
export class CachedAddress {
  @Prop({ required: true, unique: true, index: true })
  address: string;

  @Prop({ type: Object, required: true })
  data: Record<string, unknown>;

  @Prop({ required: true, index: { expires: 0 } })
  expiresAt: Date;
}

export const CachedAddressSchema = SchemaFactory.createForClass(CachedAddress);
