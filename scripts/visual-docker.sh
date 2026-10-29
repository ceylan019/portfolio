#!/usr/bin/env bash
# Runs the @visual tests in the same Playwright container as CI, as linux/amd64
# like the GitHub runners, against a copy of the working tree. The local
# node_modules and build folders are never touched.
#
#   pnpm test:visual          compare against the committed baselines
#   pnpm test:visual:update   write new baselines and list the changed ones
set -euo pipefail

mode=check
case "${1:-}" in
  --update) mode=update ;;
  "") ;;
  *) echo "Usage: $0 [--update]" >&2; exit 2 ;;
esac

root=$(git rev-parse --show-toplevel)
cd "$root"
playwright=$(sed -n 's/.*"@playwright\/test": "\([^"]*\)".*/\1/p' package.json)
image="mcr.microsoft.com/playwright:v$playwright-noble"
shots=tests/e2e/__screenshots__
out=$(mktemp -d)
trap 'rm -rf "$out"' EXIT

# Tracked and untracked files, minus ignored ones such as node_modules and dist.
git ls-files -co --exclude-standard | while IFS= read -r f; do
  [ -e "$f" ] && printf '%s\n' "$f"
done > "$out/files"

# Mirrors the baselines job in .github/workflows/visual-baselines.yml. Node,
# corepack and the pnpm store are cached in a Docker volume between runs.
read -r -d '' inside <<'SCRIPT' || true
set -euo pipefail
mkdir -p /work && cd /work && tar -x -f -

# Like setup-node with .nvmrc: the newest release of that Node line.
line=$(cat .nvmrc)
version=$(curl -fsSL https://nodejs.org/dist/index.json \
  | grep -o "\"version\":\"v$line\.[0-9.]*\"" | head -1 | cut -d'"' -f4)
if [ ! -x "/cache/node-$version/bin/node" ]; then
  mkdir -p "/cache/node-$version"
  curl -fsSL "https://nodejs.org/dist/$version/node-$version-linux-x64.tar.gz" \
    | tar -xz -C "/cache/node-$version" --strip-components=1
fi
export PATH="/cache/node-$version/bin:$PATH" COREPACK_HOME=/cache/corepack \
  COREPACK_ENABLE_DOWNLOAD_PROMPT=0 npm_config_store_dir=/cache/pnpm-store
corepack enable
echo "Node $(node -v), pnpm $(pnpm -v), $(uname -m)"

pnpm install --frozen-lockfile --reporter=silent
pnpm build:fixture > /out/build.log 2>&1 || { tail -30 /out/build.log; exit 1; }
scripts/serve-and-wait.sh serve:fixture http://localhost:8787/

flag=""
[ "$MODE" = update ] && flag=--update-snapshots
# Emulating amd64 on Apple silicon is slower than a runner, so the longest
# page gets more time than the 30 seconds it needs in CI.
status=0
PW_JSON=reports/playwright-visual.json pnpm exec playwright test --grep @visual \
  --project=chromium --project=pixel --timeout=120000 $flag || status=$?
cp -r tests/e2e/__screenshots__ /out/screenshots
[ -d test-results ] && cp -r test-results /out/test-results
exit $status
SCRIPT

status=0
COPYFILE_DISABLE=1 tar -c -f - -T "$out/files" | docker run --rm -i \
  --platform linux/amd64 --ipc=host \
  -e HOME=/root -e CI=true -e MODE="$mode" \
  -v "$out":/out -v portfolio-visual-cache:/cache \
  "$image" bash -c "$inside" || status=$?

if [ "$mode" = update ] && [ -d "$out/screenshots" ]; then
  changed=0
  while IFS= read -r f; do
    if ! cmp -s "$out/screenshots/$f" "$shots/$f"; then
      mkdir -p "$(dirname "$shots/$f")"
      cp "$out/screenshots/$f" "$shots/$f"
      echo "updated: $shots/$f"
      changed=$((changed + 1))
    fi
  done < <(cd "$out/screenshots" && find . -type f -name '*.png' | sed 's|^\./||' | sort)
  if [ "$changed" -eq 0 ]; then
    echo "No baselines changed."
  else
    echo "$changed baseline(s) changed. Review them, then commit."
  fi
elif [ "$status" -ne 0 ] && [ -d "$out/test-results" ]; then
  keep="$root/test-results/visual-docker"
  mkdir -p "$keep" && cp -r "$out/test-results/." "$keep/"
  echo "Differences saved in test-results/visual-docker (expected, actual and diff images)."
fi
exit "$status"
