# Infrastructure

Local Docker Compose (SP-007), Kubernetes manifests, Helm charts, and Jenkins assets live here.

This directory is intentionally **outside** the pnpm workspace. It contains no Node packages.

## Local infrastructure (SP-007)

Compose file: [`../docker-compose.yml`](../docker-compose.yml)

```bash
# From repo root
pnpm infra:up          # core stack, wait until healthy
pnpm infra:down        # stop (keep volumes)
pnpm infra:reset       # wipe volumes + recreate

# Optional profiles (pull images first)
pnpm infra:up -- --profile observability
pnpm infra:up -- --profile clamav
```

| Service              | Image                      | Host ports                   |
| -------------------- | -------------------------- | ---------------------------- |
| PostgreSQL 16        | `postgres:16-alpine`       | `5432`                       |
| Redis 7              | `redis:7-alpine`           | `6379`                       |
| SeaweedFS (S3)       | `chrislusf/seaweedfs:3.97` | `9000` (S3), `9333` (master) |
| Mailpit              | `axllent/mailpit:v1.27.10` | `1025` SMTP, `8025` UI       |
| ClamAV (profile)     | `clamav/clamav:1.4`        | `3310`                       |
| Prometheus (profile) | `prom/prometheus:v3.2.1`   | `9090`                       |
| Grafana (profile)    | `grafana/grafana:11.6.0`   | `3002`                       |

Dev credentials and connection strings: [`.env.example`](../.env.example).

### Why SeaweedFS instead of MinIO?

MinIO Community images were removed from Docker Hub and gated on Quay (401 for anonymous pulls) in September 2026. SeaweedFS provides a local S3-compatible API; the bootstrap job creates bucket `sprachpilot-dev`.

### Podman / Fedora SELinux

Volume mounts use the `:Z` label so SELinux-confined containers can write. Prefer:

```bash
podman compose -f docker-compose.yml up -d --wait
```

### Observability profile

Grafana ships with Prometheus preconfigured as the default datasource (`infra/docker/observability/grafana/provisioning`).

```bash
docker pull prom/prometheus:v3.2.1
docker pull grafana/grafana:11.6.0
pnpm infra:up -- --profile observability
# Grafana http://localhost:3002  (admin / admin)
# Prometheus http://localhost:9090
```

Further work: SP-057 (Dockerfiles), SP-058 (Helm).
