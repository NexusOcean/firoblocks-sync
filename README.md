# firoblocks-sync

NestJS background service for [FiroBlocks](https://firoblocks.app) — periodically syncs chain stats, UTXO data, and recent transactions from firod RPC into MongoDB. Runs independently of the API and owns all write operations to the shared database.

## Requirements

- Node.js 24
- MongoDB 8
- A fully synced [firod](https://github.com/firoorg/firo) node with the following indexes enabled in `firo.conf`:

```
txindex=1
addressindex=1
spentindex=1
timestampindex=1
```

## Setup

```bash
cp .env.example .env
yarn --frozen
yarn dev
```

## Environment Variables

| Variable        | Description               |
| --------------- | ------------------------- |
| `FIRO_RPC_HOST` | firod RPC host            |
| `FIRO_RPC_PORT` | firod RPC port            |
| `FIRO_RPC_USER` | firod RPC username        |
| `FIRO_RPC_PASS` | firod RPC password        |
| `MONGO_URI`     | MongoDB connection string |

## Sync Jobs

| Job                      | Interval | Description                                   |
| ------------------------ | -------- | --------------------------------------------- |
| `syncChainStats`         | 30s      | Difficulty, best block hash, network hashrate |
| `warmRecentTransactions` | 60s      | Caches recent transactions                    |
| `syncUtxoStats`          | 15m      | Block height, transaction count, total supply |

## Community

- Chat: [#general:nexusocean.org](https://matrix.to/#/#general:nexusocean.org)
- Matrix client: [elements.nexusocean.org](https://elements.nexusocean.org)

## License

[Mozilla Public License 2.0](./LICENSE)
