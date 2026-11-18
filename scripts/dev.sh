#!/usr/bin/env bash
set -euo pipefail
set -m

api_pid=""
web_pid=""

cleanup() {
  trap - EXIT INT TERM

  for pid in "$api_pid" "$web_pid"; do
    if [[ -n "$pid" ]]; then
      kill -- "-$pid" 2>/dev/null || true
    fi
  done

  sleep 0.5

  for pid in "$api_pid" "$web_pid"; do
    if [[ -n "$pid" ]]; then
      kill -KILL -- "-$pid" 2>/dev/null || true
    fi
  done

  wait 2>/dev/null || true
}

trap cleanup EXIT INT TERM

dotnet watch --project src/Billz.Api/Billz.Api.csproj run --launch-profile http &
api_pid=$!

pnpm --dir frontend dev &
web_pid=$!

wait -n
