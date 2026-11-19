#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
data_dir="$root/artifacts/e2e-data"

if [[ ! -f "$root/artifacts/publish/Billz.Api.dll" ]]; then
  echo "Published app not found. Run 'mise run build' first." >&2
  exit 1
fi

rm -rf "$data_dir"
mkdir -p "$data_dir"

cd "$root/artifacts/publish"

exec env \
  ASPNETCORE_URLS=http://127.0.0.1:5199 \
  ASPNETCORE_ENVIRONMENT=Production \
  Billz__DatabasePath="$data_dir/billz.db" \
  Billz__Currency=PLN \
  Logging__LogLevel__Microsoft.EntityFrameworkCore=Warning \
  dotnet Billz.Api.dll
