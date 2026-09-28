#!/usr/bin/env bash
# The one serve-and-wait helper (ruling P27): starts a pnpm serve script in the
# background, logging to a file, and returns once the URL answers. If it never
# answers within 60 seconds, it prints the server log and fails.
#
#   scripts/serve-and-wait.sh serve:fixture http://localhost:8787/ [log file]
set -u
script="$1"
url="$2"
log="${3:-reports/wrangler-${script#serve:}.log}"
mkdir -p "$(dirname "$log")"
pnpm "$script" > "$log" 2>&1 &
for _ in $(seq 60); do
  curl -fsS "$url" > /dev/null 2>&1 && exit 0
  sleep 1
done
cat "$log"
exit 1
