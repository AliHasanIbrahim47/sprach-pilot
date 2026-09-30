#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

COMPOSE_BASE=(docker compose -f docker-compose.yml)
CORE_SERVICES=(postgres redis seaweedfs mailpit)

usage() {
  cat <<'EOF'
Usage: scripts/infra.sh <up|down|reset> [compose options]

  up     Start core services and wait until healthy
  down   Stop services (keep volumes)
  reset  Wipe volumes and recreate services

Examples:
  scripts/infra.sh up
  scripts/infra.sh up --profile observability
  pnpm infra:up -- --profile observability
  scripts/infra.sh reset --profile clamav
EOF
}

# Split user args into compose profile flags vs everything else.
# Accepts a leading "--" so `pnpm infra:up -- --profile …` works.
PROFILE_ARGS=()
OTHER_ARGS=()

parse_args() {
  PROFILE_ARGS=()
  OTHER_ARGS=()
  local skip_next=0
  local arg

  for arg in "$@"; do
    if [[ "${skip_next}" -eq 1 ]]; then
      PROFILE_ARGS+=("${arg}")
      skip_next=0
      continue
    fi

    case "${arg}" in
      --)
        # Ignored separator from pnpm / make
        ;;
      --profile)
        PROFILE_ARGS+=("--profile")
        skip_next=1
        ;;
      --profile=*)
        PROFILE_ARGS+=("${arg}")
        ;;
      *)
        OTHER_ARGS+=("${arg}")
        ;;
    esac
  done
}

compose() {
  "${COMPOSE_BASE[@]}" "${PROFILE_ARGS[@]}" "$@"
}

wait_core() {
  parse_args "$@"

  if [[ "${#PROFILE_ARGS[@]}" -gt 0 ]]; then
    # With profiles, let Compose select default + profile services.
    compose up -d --wait --remove-orphans "${OTHER_ARGS[@]}"
  else
    compose up -d --wait --remove-orphans "${CORE_SERVICES[@]}" "${OTHER_ARGS[@]}"
  fi

  # One-shot bucket bootstrap (excluded from --wait via its own profile)
  "${COMPOSE_BASE[@]}" --profile init run --rm --no-deps seaweedfs-init
}

cmd="${1:-}"
shift || true

case "${cmd}" in
  up)
    wait_core "$@"
    echo
    echo "Local infrastructure is up."
    echo "  Postgres:   localhost:5432  (sprachpilot / sprachpilot)"
    echo "  Redis:      localhost:6379"
    echo "  S3 (SeaweedFS): localhost:9000  bucket=sprachpilot-dev"
    echo "  Mailpit UI: http://localhost:8025  SMTP=localhost:1025"
    if [[ "$*" == *observability* ]]; then
      echo "  Grafana:    http://localhost:3002  (admin / admin)"
      echo "  Prometheus: http://localhost:9090"
    fi
    ;;
  down)
    parse_args "$@"
    compose down --remove-orphans "${OTHER_ARGS[@]}"
    ;;
  reset)
    parse_args "$@"
    compose down -v --remove-orphans "${OTHER_ARGS[@]}"
    wait_core "$@"
    echo
    echo "Local infrastructure reset and healthy."
    ;;
  *)
    usage
    exit 1
    ;;
esac
