#!/usr/bin/env bash
set -euo pipefail

project="billz-smoke-$$"
volume="billz-smoke-data-$$"
image="billz:smoke"
port="${SMOKE_PORT:-$(( (RANDOM % 20000) + 40000 ))}"
base_url="http://127.0.0.1:$port"

cleanup() {
  docker compose -p "$project" down --volumes --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

wait_healthy() {
  for _ in $(seq 1 120); do
    if curl -fsS "$base_url/api/health" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done

  echo "Timed out waiting for Billz to become healthy" >&2
  docker compose -p "$project" logs billz >&2 || true
  return 1
}

export BILLZ_CURRENCY=PLN
export BILLZ_BIND=127.0.0.1
export BILLZ_ALLOWED_HOSTS=127.0.0.1
export BILLZ_PORT="$port"
export BILLZ_IMAGE="$image"
export BILLZ_VOLUME_NAME="$volume"

docker compose -p "$project" up -d --build
wait_healthy

uid="$(docker compose -p "$project" exec -T billz id -u)"
if [[ "$uid" == "0" ]]; then
  echo "Container is running as root" >&2
  exit 1
fi
echo "Non-root uid: $uid"

create_response="$(
  curl -fsS -X POST \
    -H 'Content-Type: application/json' \
    --data '{"name":"Smoke bill","amountMinor":12345,"frequency":"monthly","interval":1,"startDate":"2026-12-01","endDate":null,"category":null,"notes":null}' \
    "$base_url/api/bills"
)"
bill_id="$(printf '%s' "$create_response" | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')"
echo "Created bill $bill_id"

docker compose -p "$project" restart billz >/dev/null
wait_healthy

bill_response="$(curl -fsS "$base_url/api/bills/$bill_id")"
if [[ "$bill_response" != *"Smoke bill"* ]]; then
  echo "Bill did not survive the restart" >&2
  exit 1
fi
echo "Persistence across restart: ok"

docker compose -p "$project" exec -T billz test -w /data
echo "Data volume writable: ok"

container_id="$(docker compose -p "$project" ps -q billz)"
read_only="$(docker inspect --format '{{.HostConfig.ReadonlyRootfs}}' "$container_id")"
if [[ "$read_only" != "true" ]]; then
  echo "Root filesystem is not read-only" >&2
  exit 1
fi
echo "Read-only root filesystem: ok"

cleanup
if [[ -n "$(docker compose -p "$project" ps -aq)" ]]; then
  echo "Containers were left behind" >&2
  exit 1
fi

echo "Container smoke test passed."
