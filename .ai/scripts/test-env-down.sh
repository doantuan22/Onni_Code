#!/bin/sh
# om-prepare-test-env: generated entrypoint (contract v2)
# regenerate with: om-prepare-test-env --regenerate
# history:
#   2026-07-14 generated — mirrors test-env-up.sh; no services to remove, so this
#             only stops the app PID this repo started and marks the descriptor stopped.
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
QA_DIR="$REPO_ROOT/.ai/qa"
ENV_DESCRIPTOR="$QA_DIR/test-env.json"

log() { echo "[test-env] $*" >&2; }

# The app descriptor contains a native Node PID; MSYS shell kill uses another PID namespace.
app_alive() { node -e '
  const pid = Number(process.argv[1]);
  if (!Number.isSafeInteger(pid) || pid <= 0) process.exit(1);
  try { process.kill(pid, 0); } catch { process.exit(1); }
' "$1" 2>/dev/null; }
app_kill() { node -e '
  const pid = Number(process.argv[1]);
  if (!Number.isSafeInteger(pid) || pid <= 0) process.exit(1);
  try { process.kill(pid, process.argv[2]); } catch { /* already stopped */ }
' "$1" "${2:-SIGTERM}" 2>/dev/null; }

[ -f "$ENV_DESCRIPTOR" ] || { log "no descriptor — nothing to stop"; exit 0; }

pid=$(node -e '
  const fs = require("fs");
  try {
    const d = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    if (d.startedByThisRepo && d.app && d.app.pid) process.stdout.write(String(d.app.pid));
  } catch { /* corrupt descriptor → nothing safe to stop */ }
' "$ENV_DESCRIPTOR" 2>/dev/null || true)

# Only ever stop what this repo started; safe to run twice.
if [ -n "$pid" ] && app_alive "$pid"; then
  log "stopping onni (pid $pid)"
  app_kill "$pid" || true
  waited=0
  while app_alive "$pid" && [ "$waited" -lt 10 ]; do
    sleep 1
    waited=$((waited + 1))
  done
  app_kill "$pid" SIGKILL || true
else
  log "app is already stopped"
fi

node -e '
  const fs = require("fs");
  const f = process.argv[1];
  try {
    const d = JSON.parse(fs.readFileSync(f, "utf8"));
    d.status = "stopped";
    fs.writeFileSync(f, JSON.stringify(d, null, 2) + "\n");
  } catch { /* leave a corrupt descriptor alone — up will treat it as stale */ }
' "$ENV_DESCRIPTOR"

rm -rf "$QA_DIR/test-env.lock" 2>/dev/null || true
echo "TEST_ENV_STATUS=stopped"
