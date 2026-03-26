import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { RpcResponse } from './rpc.types';

@Injectable()
export class RpcService {
  private readonly clients: AxiosInstance[];
  private readonly logger = new Logger(RpcService.name);
  private reqId = 0;

  constructor(private readonly config: ConfigService) {
    const nodes = [
      {
        host: config.get<string>('FIRO_RPC_HOST') || 'localhost',
        port: config.get<number>('FIRO_RPC_PORT') || 8888,
        user: config.get<string>('FIRO_RPC_USER') || '',
        pass: config.get<string>('FIRO_RPC_PASS') || '',
      },
      {
        host: config.get<string>('FIRO_RPC_FALLBACK_HOST') || '',
        port: config.get<number>('FIRO_RPC_FALLBACK_PORT') || 8888,
        user: config.get<string>('FIRO_RPC_FALLBACK_USER') || '',
        pass: config.get<string>('FIRO_RPC_FALLBACK_PASS') || '',
      },
    ].filter((n) => n.host);

    this.clients = nodes.map((n) =>
      axios.create({
        baseURL: `http://${n.host}:${n.port}`,
        auth: { username: n.user, password: n.pass },
        headers: { 'Content-Type': 'application/json' },
        timeout: 60_000,
      }),
    );
  }

  async call<T>(method: string, params: unknown[] = []): Promise<T> {
    const id = ++this.reqId;
    let lastErr: unknown;

    for (const client of this.clients) {
      try {
        const { data } = await client.post<RpcResponse<T>>('/', {
          jsonrpc: '1.1',
          id,
          method,
          params,
        });

        if (data.error) {
          this.logger.error(`RPC [${method}] error ${data.error.code}: ${data.error.message}`);
          throw new InternalServerErrorException(`RPC error: ${data.error.message}`);
        }

        return data.result;
      } catch (err) {
        if (axios.isAxiosError(err)) {
          this.logger.warn(`RPC [${method}] failed on ${client.defaults.baseURL}, trying fallback`);
          lastErr = err;
          continue;
        }
        throw err;
      }
    }

    this.logger.error(`RPC [${method}] all nodes failed`);
    throw new InternalServerErrorException(`RPC transport error: ${(lastErr as any).message}`);
  }
}
