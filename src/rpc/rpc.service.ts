import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { RpcResponse } from './rpc.types';

@Injectable()
export class RpcService {
  private readonly client: AxiosInstance;
  private readonly logger = new Logger(RpcService.name);
  private reqId = 0;

  constructor(private readonly config: ConfigService) {
    const host = config.get<string>('FIRO_RPC_HOST') || 'localhost';
    const port = config.get<number>('FIRO_RPC_PORT') || 8888;
    const user = config.get<string>('FIRO_RPC_USER') || '';
    const pass = config.get<string>('FIRO_RPC_PASS') || '';

    this.client = axios.create({
      baseURL: `http://${host}:${port}`,
      auth: { username: user, password: pass },
      headers: { 'Content-Type': 'application/json' },
      timeout: 60_000,
    });
  }

  async call<T>(method: string, params: unknown[] = []): Promise<T> {
    const id = ++this.reqId;

    try {
      const { data } = await this.client.post<RpcResponse<T>>('/', {
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
        this.logger.error(`RPC [${method}] transport error: ${err.message}`);
        throw new InternalServerErrorException(`RPC transport error: ${err.message}`);
      }
      throw err;
    }
  }
}
