#!/usr/bin/env bash
# Release gate for folder-timeline (pnpm + esbuild, dev -> master squash model).
# Run from plugin root: bash scripts/verify_release.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> [1/5] Lint"
pnpm run lint

echo "==> [2/5] Build (tsc --noEmit + esbuild)"
pnpm run build

echo "==> [3/5] node --check main.js"
node --check main.js

echo "==> [4/5] Security scan (every line MUST be 0)"
rc=0
for p in 'fetch(' 'eval(' 'innerHTML' 'console.' 'sourceMappingURL'; do
  count=$(grep -o "$p" main.js 2>/dev/null | wc -l | tr -d ' ' || true)
  count=${count:-0}
  printf '   %-16s %s\n' "$p" "$count"
  [ "$count" = "0" ] || rc=1
done
if [ "$rc" -ne 0 ]; then
  echo "!! Security scan FAILED (non-zero hits above)"
  exit 1
fi

echo "==> [5/5] Manifest sanity"
node -e "const m=require('./manifest.json');const req=['id','name','version','minAppVersion','description','isDesktopOnly'];const miss=req.filter(k=>!(k in m));console.log('   missing:',miss.join(',')||'none');const ok=typeof m.version==='string'&&/^[0-9]+\\.[0-9]+\\.[0-9]+\$/.test(m.version);console.log('   version:',m.version,'| semver:',ok);if(miss.length||!ok)process.exit(1);"

echo "ALL_GATES_OK"
