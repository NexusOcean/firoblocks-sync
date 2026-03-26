export interface RpcRequest {
  method: string;
  params?: unknown[];
}

export interface RpcResponse<T> {
  result: T;
  error: { code: number; message: string } | null;
  id: number;
}
