# ADR-0004: GitHub Actions for CI, Jenkins for CD

- Status: Accepted
- Date: 2026-09-25
- Deciders: Tech Lead / Platform
- Ticket: SP-064–SP-072 (pipelines)

## Context

PRs need fast, free-form checks close to the code host. Deployments to staging/production need gated, auditable promotion that can run on cluster infrastructure and talk to private registries/clusters.

## Decision

- **GitHub Actions**: continuous integration on pull requests and `main` (lint, typecheck, test, image/security scans as those tickets land)
- **Jenkins** (on Kubernetes): continuous delivery — build/push images, deploy Helm releases, promote staging → production with explicit gates

CI does not deploy production; CD does not replace PR quality gates.

## Alternatives considered

| Option | Why not |
| --- | --- |
| GitHub Actions for CI + CD | Possible; org preference is Jenkins for cluster-native CD and promotion |
| Jenkins for everything | Slower PR feedback; worse GitHub integration for checks |
| GitLab CI / Tekton only | Outside current hosting and team tooling |
| Argo CD Image Updater without Jenkins | Still need a build/promotion orchestrator |

## Consequences

- Branch protection and required checks are owned with GitHub (SP-068).
- Jenkinsfiles and deploy credentials live under `infra/` / cluster secrets (SP-059+).
- Developers validate with `pnpm lint`, `pnpm typecheck`, `pnpm test` locally; CI must stay aligned with those scripts.
- Release runbooks document who may promote (SP-085).
