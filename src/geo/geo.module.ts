import { Module } from '@nestjs/common';
import { GeoService } from './geo.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Geo, GeoSchema } from './geo.schema';
import { MasternodeCache, MasternodeCacheSchema } from '../masternode/masternode.schema';
import { MmdbLoaderService } from './mmdb-loader.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Geo.name, schema: GeoSchema },
      { name: MasternodeCache.name, schema: MasternodeCacheSchema },
    ]),
  ],
  providers: [GeoService, MmdbLoaderService],
  exports: [MongooseModule],
})
export class GeoModule {}
