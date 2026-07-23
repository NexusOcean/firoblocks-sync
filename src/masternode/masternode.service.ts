import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RpcService } from '../rpc/rpc.service';
import { FiroMasternode } from './masternode.types';
import {
  MasternodeCache,
  MasternodeCacheDocument,
  MasternodeStats,
  StoredMasternode,
} from './masternode.schema';
import { Geo, GeoDocument } from '../geo/geo.schema';
import { MASTERNODE_CACHE_KEY } from '../constants';

@Injectable()
export class MasternodeService {
  private readonly logger = new Logger(MasternodeService.name);

  constructor(
    private readonly rpc: RpcService,
    @InjectModel(MasternodeCache.name)
    private readonly cacheModel: Model<MasternodeCacheDocument>,
    @InjectModel(Geo.name)
    private readonly geoModel: Model<GeoDocument>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async syncList(): Promise<void> {
    try {
      const result = await this.rpc.call<Record<string, FiroMasternode>>(
        'protx',
        'list',
        'valid',
        true,
      );
      const seen = new Set<string>();
      const raw = Object.values(result).filter((mn) => {
        if (seen.has(mn.proTxHash)) return false;
        seen.add(mn.proTxHash);
        return true;
      });

      const ips = raw.map((mn) => mn.state.service.split(':')[0]);
      const geoEntries = await this.geoModel.find({ ip: { $in: ips } }).lean();
      const geoMap = new Map(geoEntries.map((g) => [g.ip, g]));

      const enriched: StoredMasternode[] = raw.map((mn) => {
        const ip = mn.state.service.split(':')[0];
        const g = geoMap.get(ip);
        return {
          ...mn,
          geo: g
            ? {
                country: g.country,
                countryCode: g.countryCode,
                asn: g.asn,
                org: g.org,
              }
            : undefined,
        };
      });

      const stats = this.computeStats(enriched);

      await this.cacheModel.updateOne(
        { key: MASTERNODE_CACHE_KEY },
        {
          key: MASTERNODE_CACHE_KEY,
          data: enriched,
          stats,
          fetchedAt: new Date(),
        },
        { upsert: true },
      );

      this.logger.debug(
        `Synced ${enriched.length} masternodes (${stats.resolved} with geo, ${stats.countries.length} countries, ${stats.asns.length} ASNs)`,
      );
    } catch (err) {
      this.logger.error(`MN sync failed: ${err}`);
    }
  }

  private computeStats(masternodes: StoredMasternode[]): MasternodeStats {
    const total = masternodes.length;
    let resolved = 0;

    const countryMap = new Map<string, { country: string; count: number }>();
    const asnMap = new Map<number, { org: string; count: number }>();

    for (const mn of masternodes) {
      if (!mn.geo) continue;

      resolved++;

      const c = countryMap.get(mn.geo.countryCode);
      if (c) c.count++;
      else countryMap.set(mn.geo.countryCode, { country: mn.geo.country, count: 1 });

      const a = asnMap.get(mn.geo.asn);
      if (a) a.count++;
      else asnMap.set(mn.geo.asn, { org: mn.geo.org, count: 1 });
    }

    const countries = Array.from(countryMap.entries())
      .map(([countryCode, v]) => ({ countryCode, country: v.country, count: v.count }))
      .sort((a, b) => b.count - a.count);

    const asns = Array.from(asnMap.entries())
      .map(([asn, v]) => ({ asn, org: v.org, count: v.count }))
      .sort((a, b) => b.count - a.count);

    return { total, resolved, countries, asns };
  }
}
