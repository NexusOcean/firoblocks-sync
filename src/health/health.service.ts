import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

interface Heartbeat {
  lastAt: number;
  maxStaleMs: number;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly heartbeats = new Map<string, Heartbeat>();

  register(name: string, maxStaleMs: number): void {
    this.heartbeats.set(name, { lastAt: Date.now(), maxStaleMs });
    this.logger.log(`Registered heartbeat "${name}" (max stale: ${maxStaleMs}ms)`);
  }

  beat(name: string): void {
    const entry = this.heartbeats.get(name);
    if (!entry) {
      this.logger.warn(`beat() called for unregistered task "${name}"`);
      return;
    }
    entry.lastAt = Date.now();
  }

  @Cron('*/30 * * * * *')
  check(): void {
    const now = Date.now();
    for (const [name, { lastAt, maxStaleMs }] of this.heartbeats) {
      const stale = now - lastAt;
      if (stale > maxStaleMs) {
        this.logger.error(`Task "${name}" stuck for ${stale}ms, exiting for restart`);
        process.exit(1);
      }
    }
  }
}
