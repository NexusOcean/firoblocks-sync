# Contributing to the FiroBlocks API

Thanks for your interest in contributing. This is a community infrastructure project maintained by [NexusOcean](https://nexusocean.io).

## Expectations

- Open an issue before starting work for a PR — this avoids duplicated effort
- PRs are reviewed on a best-effort basis
- Keep changes focused — one concern per PR
- This project follows [Semantic Versioning](https://semver.org)

## Development Setup

See [README.md](./README.md) for environment setup. You will need a fully synced and indexed firod node.

## Guidelines

- TypeScript is strictly enforced
- Follow existing module structure: controllers handle routing, services handle logic
- Cache behavior lives in the service layer, not controllers
- Do not commit `.env` or any RPC credentials

## Submitting a PR

1. Fork the repo and create a branch from `main`
2. Make your changes with clear, descriptive commits
3. Open a PR with a summary of what changed and why

## Questions

Join the community on Matrix: [#general:nexusocean.org](https://matrix.to/#/#general:nexusocean.org)  
Matrix client available at: [element.nexusocean.org](https://element.nexusocean.org)
