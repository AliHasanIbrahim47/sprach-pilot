#!/bin/sh
set -eu

MASTER="${WEED_MASTER:-seaweedfs:9333}"
FILER="${WEED_FILER:-seaweedfs:8888}"
BUCKET="${S3_BUCKET:-sprachpilot-dev}"

echo "[seaweedfs-init] waiting for master at ${MASTER}…"
i=0
until wget -q -O /dev/null "http://${MASTER}/cluster/status"; do
  i=$((i + 1))
  if [ "$i" -ge 60 ]; then
    echo "[seaweedfs-init] master not ready after 60s" >&2
    exit 1
  fi
  sleep 1
done

echo "[seaweedfs-init] waiting for filer at ${FILER}…"
i=0
until wget -q -O /dev/null "http://${FILER}/"; do
  i=$((i + 1))
  if [ "$i" -ge 60 ]; then
    echo "[seaweedfs-init] filer not ready after 60s" >&2
    exit 1
  fi
  sleep 1
done

echo "[seaweedfs-init] ensuring bucket '${BUCKET}' exists…"
# Idempotent create via weed shell (S3 admin against filer).
if printf 's3.bucket.create -name %s\n' "${BUCKET}" | weed shell -master="${MASTER}" -filer="${FILER}"; then
  echo "[seaweedfs-init] bucket ready"
else
  echo "[seaweedfs-init] weed shell create failed; trying filer HTTP mkdir fallback…"
  # Filer path-style buckets live under /buckets/<name>
  wget -q -O /dev/null --method=POST "http://${FILER}/buckets/${BUCKET}/" || \
    wget -q -O /dev/null --method=PUT "http://${FILER}/buckets/${BUCKET}/" || true
fi

echo "[seaweedfs-init] done"
