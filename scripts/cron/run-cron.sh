#!/usr/bin/env bash
#
# Driplare — scheduled-job runner for a self-hosted deployment (Hostinger VPS / Coolify).
#
# Vercel Cron is deliberately NOT used: Hobby plans only accept once-per-day
# schedules, but `run-automations` has to tick every few minutes (broadcast
# draining and `session.idle` follow-ups), and failing that rule fails the whole
# deployment. On a VPS the clock lives in crontab (see crontab.example) and each
# entry calls this script with the job name.
#
# The job *logic* is not here — it already lives in `app/api/cron/<job>/route.ts`.
# This script only schedules, authenticates and reports.
#
# Usage:
#   run-cron.sh <job> [job...]     # run one or more jobs
#   run-cron.sh --list             # print the known job names
#
# Configuration is read from $CRON_ENV_FILE (default /etc/driplare/cron.env),
# a 0600 file holding:
#   BASE_URL="https://app.example.com"   # or http://127.0.0.1:3000 if the app
#                                        # runs on this same machine
#   CRON_SECRET="<same value as the app's CRON_SECRET>"
#
# Exit codes: 0 = every job succeeded · 1 = at least one job failed · 2 = misconfigured

set -uo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────

ENV_FILE="${CRON_ENV_FILE:-/etc/driplare/cron.env}"
TIMEOUT="${CRON_TIMEOUT:-120}"        # seconds per attempt
RETRIES="${CRON_RETRIES:-2}"          # total attempts, not extra ones
RETRY_DELAY="${CRON_RETRY_DELAY:-15}" # seconds between attempts

# Every job that exists. Anything else is rejected, so a typo in crontab cannot
# silently fetch some other URL.
KNOWN_JOBS=(
  process-downgrades
  reset-credits
  usage-alerts
  webhook-cleanup
  run-automations
)

# ── Helpers ───────────────────────────────────────────────────────────────────

log() {
  printf '%s [%s] %s\n' "$(date -Is)" "$1" "$2"
}

usage() {
  echo "Usage: $(basename "$0") <job> [job...]" >&2
  echo "       $(basename "$0") --list" >&2
  echo "Jobs: ${KNOWN_JOBS[*]}" >&2
}

is_known_job() {
  local candidate="$1" known
  for known in "${KNOWN_JOBS[@]}"; do
    [[ "$candidate" == "$known" ]] && return 0
  done
  return 1
}

# ── Argument handling ─────────────────────────────────────────────────────────

if [[ $# -eq 0 ]]; then
  usage
  exit 2
fi

if [[ "$1" == "--list" ]]; then
  printf '%s\n' "${KNOWN_JOBS[@]}"
  exit 0
fi

for job in "$@"; do
  if ! is_known_job "$job"; then
    log ERROR "unknown job: $job"
    usage
    exit 2
  fi
done

# ── Load configuration ────────────────────────────────────────────────────────

if [[ ! -r "$ENV_FILE" ]]; then
  log ERROR "env file is missing or unreadable: $ENV_FILE (override with CRON_ENV_FILE)"
  exit 2
fi

# Export everything the file defines. The app's own .env is NOT reused on
# purpose: this file must hold only what cron needs, so a leak of it exposes one
# secret instead of the whole application.
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if [[ -z "${BASE_URL:-}" || -z "${CRON_SECRET:-}" ]]; then
  log ERROR "BASE_URL and CRON_SECRET must both be set in $ENV_FILE"
  exit 2
fi

BASE_URL="${BASE_URL%/}"

# ── Job runner ────────────────────────────────────────────────────────────────

# Returns 0 on success, 1 on failure. Never retries a 401: a wrong secret cannot
# start working, so retrying only delays a human noticing.
run_job() {
  local job="$1"
  local url="${BASE_URL}/api/cron/${job}"
  local attempt code body

  for ((attempt = 1; attempt <= RETRIES; attempt++)); do
    body="$(mktemp)"
    # Deliberately NOT following redirects (-L). Clerk's `auth.protect()` answers
    # an unauthenticated API request with a redirect to the sign-in page, which
    # returns 200 — following it would report a healthy green job while the
    # handler never ran. A 3xx is therefore treated as the failure it is.
    code="$(curl --silent --show-error --max-time "$TIMEOUT" \
      --header "Authorization: Bearer ${CRON_SECRET}" \
      --output "$body" --write-out '%{http_code}' \
      "$url" 2>/dev/null)" || code="000"

    case "$code" in
      200)
        log INFO "${job} OK $(tr -d '\n' <"$body" | cut -c1-400)"
        rm -f "$body"
        return 0
        ;;
      401)
        log ERROR "${job} UNAUTHORIZED (401) — CRON_SECRET does not match the app's. Check $ENV_FILE"
        rm -f "$body"
        return 1
        ;;
      3??)
        log ERROR "${job} REDIRECTED (HTTP ${code}) — the route is still behind Clerk."
        log ERROR "  Fix: add '/api/cron/(.*)' to isPublicRoute in proxy.ts (see TASK-22 in docs/Architecture-Update/task.md)."
        rm -f "$body"
        return 1
        ;;
      503)
        log ERROR "${job} UNAVAILABLE (503) — the app reports it is not configured (missing CRON_SECRET or channel env)."
        rm -f "$body"
        return 1
        ;;
    esac

    rm -f "$body"

    if ((attempt < RETRIES)); then
      log WARN "${job} attempt ${attempt}/${RETRIES} failed (HTTP ${code}); retrying in ${RETRY_DELAY}s"
      sleep "$RETRY_DELAY"
    fi
  done

  log ERROR "${job} FAILED after ${RETRIES} attempt(s) (last HTTP ${code})"
  return 1
}

# ── Run ───────────────────────────────────────────────────────────────────────

failures=0
for job in "$@"; do
  run_job "$job" || failures=$((failures + 1))
done

if ((failures > 0)); then
  log ERROR "${failures} of $# job(s) failed"
  exit 1
fi

exit 0
