import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type GeoDocument = HydratedDocument<Geo>;

@Schema({ collection: 'geo', timestamps: true })
export class Geo {
  @Prop({ required: true, unique: true, index: true })
  ip: string;

  @Prop()
  country: string;

  @Prop()
  countryCode: string;

  @Prop()
  asn: number;

  @Prop()
  org: string;

  @Prop({ required: true })
  lastFetched: Date;
}

export const GeoSchema = SchemaFactory.createForClass(Geo);
