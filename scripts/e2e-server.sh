#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
data_dir="$root/artifacts/e2e-data"

if [[ ! -f "$root/artifacts/publish/Billz.Api.dll" ]]; then
  echo "Published app not found. Run 'mise run build' first." >&2
  exit 1
fi

if [[ ! -f "$root/artifacts/publish/wwwroot/index.html" ]]; then
  echo "Published SPA not found. Run 'mise run build' first." >&2
  exit 1
fi

if find "$root/src" "$root/Directory.Build.props" "$root/global.json" "$root/Billz.sln" \
  \( -path '*/bin' -o -path '*/obj' \) -prune -o \
  -type f -newer "$root/artifacts/publish/Billz.Api.dll" -print -quit | grep -q .; then
  echo "Published API is older than source files. Run 'mise run build' first." >&2
  exit 1
fi

if find "$root/frontend/src" "$root/frontend/public" "$root/frontend/index.html" \
  "$root/frontend/package.json" "$root/frontend/vite.config.ts" "$root/frontend/tsconfig.json" \
  -type f -newer "$root/artifacts/publish/wwwroot/index.html" \
  -print -quit | grep -q .; then
  echo "Published SPA is older than source files. Run 'mise run build' first." >&2
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
