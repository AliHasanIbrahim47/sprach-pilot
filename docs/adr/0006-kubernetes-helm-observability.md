# ADR-0006: Kubernetes + Helm, Prometheus + Grafana

- Status: Accepted
- Date: 2026-09-26
- Deciders: Tech Lead / Platform
- Ticket: SP-058, SP-075–SP-077

## Context

Production must run multiple processes (web, API, worker, migrate job, optional ML) with secrets, TLS, scaling, and observability. Ad-hoc VM deploys do not meet the operability bar. Local Compose remains for developer machines only.

## Decision

- **Kubernetes** as the production runtime
- **Helm** charts for packaging and environment overlays
- **Prometheus + Grafana** (kube-prometheus-stack / Compose profile for local) for metrics and dashboards
- Probes, HPA, PDB, NetworkPolicies, and resource quotas land in dedicated tickets

Local `docker-compose` is explicitly **not** the production topology.

## Alternatives considered

| Option | Why not |
| --- | --- |
| Docker Compose in production | Weak scheduling, secrets, and multi-node story |
| Nomad / ECS | Team and cluster standard is Kubernetes |
| PaaS-only (e.g. single Vercel for everything) | API/worker/ML and self-host constraints need a cluster |
| OpenTelemetry-only without Prometheus | Metrics UX and alerting still need a TSDB + Grafana |

## Consequences

- Manifests/charts live under `infra/`; apps stay deployable images (`output: "standalone"` for Next).
- Observability tickets define SLOs and dashboards; apps expose metrics (SP-074).
- Developers use Compose for Postgres/Redis/S3/Mail; they do not need a full local cluster for day-to-day feature work.
- CD (Jenkins) renders/applies Helm releases per environment.
