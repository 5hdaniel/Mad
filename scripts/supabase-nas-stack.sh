#!/usr/bin/env bash
# Persistent Supabase test stack on the UGREEN NAS (BACKLOG-3114).
#
# WHAT IT IS
#   A Postgres 17.6 + auth + PostgREST + storage + Studio stack running on the
#   NAS, holding PRODUCTION'S `public` SCHEMA as of 2026-09-05 (68 tables /
#   129 policies / 26 triggers / 177 functions) plus the migrations production
#   has not run yet. Schema only -- no production rows. It is where a plpgsql
#   change gets EXECUTED instead of grepped: before this, migration tests parsed
#   SQL text and a two-session concurrency test had nowhere to run.
#
# HOW AN AGENT CONNECTS -- the pair:
#   export DOCKER_HOST='ssh://ugreen'
#   export DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:54322/postgres'
#   ./scripts/supabase-nas-stack.sh bridge     # then any other subcommand
#
#   DOCKER_HOST is REQUIRED and this script refuses to run without it. It does
#   not default it for you on purpose: unset, the Supabase CLI targets this
#   Mac's Colima engine, and a run against the wrong database reports a full
#   GREEN board that means nothing.
#
#   DATABASE_URL says 127.0.0.1 and means the NAS. Two UGOS facts make that the
#   only address that works, both measured 2026-09-05:
#     * The NAS firewall REJECTS the published Postgres port from the LAN ("No
#       route to host") even though Docker publishes it on 0.0.0.0. Another
#       UGOS service port answers, so it is a per-port rule, not a blanket one.
#     * /etc/ssh/sshd_config carries `AllowTcpForwarding no`, so `ssh -L` cannot
#       be used either: the local listener accepts, the server refuses the
#       channel, and the client sees "connection reset by peer". That reset is
#       what killed the first `supabase start` -- read as a dead database when
#       the container was in fact healthy.
#   So the bridge below carries TCP over an ssh EXEC channel (`nc` on the NAS),
#   which UGOS does allow. `bridge` starts it; every other command needs it up.
#
#   The NAS's address is NEVER written down here -- this repo is public. It
#   lives in ~/.ssh/config under `Host ugreen` and nowhere else. Anything that
#   genuinely needs the literal derives it at runtime:
#       ssh -G ugreen | awk '/^hostname /{print $2}'
#
# WHAT DOES NOT WORK: `supabase migration up`
#   The repo's 151 migration files carry only 63 distinct versions (the CLI keys
#   history by the leading digits, so the 15 files named 20260313_* are one
#   version). `up` refuses this directory in both reachable states -- see
#   BACKLOG-3114 for the two measured failures. Apply new migrations with
#   `psql -v ON_ERROR_STOP=1 -f <file>` and insert the history row by hand.
#
# NEVER point any of this at production. Every command takes an explicit
# --db-url or a psql URL; none uses --linked.
set -euo pipefail

NAS_HOST="${NAS_HOST:-ugreen}"
EXPECT_DOCKER_HOST="ssh://${NAS_HOST}"
DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
BASELINE="${BASELINE:-$HOME/.keepr/db-baseline/baseline-2026-09-05.sql}"
PSQL="${PSQL:-/opt/homebrew/opt/libpq/bin/psql}"   # brew install libpq
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRIDGE_PORTS="${BRIDGE_PORTS:-54321 54322 54323 54324}"

# The NAS cluster's Postgres system identifier, read from the stack itself on
# 2026-09-05. It is the only thing that can tell the NAS apart from a local
# Colima stack squatting on 54322 -- both answer on 127.0.0.1, both accept
# postgres:postgres, and both look identical to `select 1`.
EXPECT_SYSID="${NAS_DB_SYSID:-7682178635586883628}"

# A dead bridge should fail in seconds, not hang on a TCP timeout.
export PGCONNECT_TIMEOUT="${PGCONNECT_TIMEOUT:-15}"

# Never echo a connection string: if anyone overrides DATABASE_URL with a real
# password it would land in stderr and in any captured log.
redact() { sed -E 's#://[^@/]*@#://***:***@#g' <<<"$1"; }

# ---------------------------------------------------------------------------
# Guards. Both run before anything touches a database.
# ---------------------------------------------------------------------------

# GUARD 1: the caller must have named the NAS. Unset or wrong -> refuse.
require_nas_docker_host() {
  if [ -z "${DOCKER_HOST:-}" ]; then
    echo "REFUSING: DOCKER_HOST is not set." >&2
    echo "  Unset, the Supabase CLI targets this Mac's Colima engine, not the NAS." >&2
    echo "  Run:  export DOCKER_HOST='${EXPECT_DOCKER_HOST}'" >&2
    exit 1
  fi
  if [ "$DOCKER_HOST" != "$EXPECT_DOCKER_HOST" ]; then
    echo "REFUSING: DOCKER_HOST is '${DOCKER_HOST}', expected '${EXPECT_DOCKER_HOST}'." >&2
    exit 1
  fi
  export DOCKER_HOST
}

# GUARD 2: the database on the other end must BE the NAS cluster. This is the
# one that catches a local `supabase start` holding 54322 -- bridge_up would
# see a listener, say "already listening", and every subcommand would then
# address the Mac while reporting success.
require_db() {
  local sysid
  sysid=$("$PSQL" "$DB_URL" -tAc "select system_identifier from pg_control_system()" 2>/dev/null || true)
  if [ -z "$sysid" ]; then
    echo "REFUSING: cannot reach a database at $(redact "$DB_URL")." >&2
    echo "  Start the bridge first:  $(basename "$0") bridge" >&2
    echo "  And check the stack is up:  $(basename "$0") status" >&2
    exit 1
  fi
  if [ "$sysid" != "$EXPECT_SYSID" ]; then
    echo "REFUSING: $(redact "$DB_URL") is Postgres cluster '${sysid}'," >&2
    echo "  but the NAS stack is '${EXPECT_SYSID}'. Something else is holding the port" >&2
    echo "  -- most likely a local 'supabase start' on this Mac. Stop it, or set" >&2
    echo "  NAS_DB_SYSID if the NAS volume was genuinely recreated." >&2
    exit 1
  fi
}

# The Docker Go SDK opens a NEW ssh connection per API call, and the bridge opens
# one per database connection. With the NAS key served by the 1Password agent
# that is one Touch ID prompt each -- dozens during a `supabase start`. An ssh
# ControlMaster (in ~/.ssh/config under `Host ugreen`) collapses them into one.
ensure_master() {
  ssh -O check "$NAS_HOST" >/dev/null 2>&1 && return 0
  echo "[nas] opening ssh master (approve the 1Password prompt once)" >&2
  ssh -fN -o ConnectTimeout=20 "$NAS_HOST"
}

bridge_up() {
  ensure_master
  for p in $BRIDGE_PORTS; do
    if lsof -nP -iTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1; then
      # NOTE: a listener here is not proof it is OUR bridge -- see GUARD 2,
      # which is what actually establishes the database is the NAS.
      echo "[bridge] $p already listening" >&2; continue
    fi
    nohup socat TCP-LISTEN:"$p",bind=127.0.0.1,reuseaddr,fork \
      EXEC:"ssh $NAS_HOST nc 127.0.0.1 $p" >/dev/null 2>&1 &
    echo "[bridge] $p -> ${NAS_HOST}:$p (pid $!)" >&2
  done
}

case "${1:-help}" in
  bridge) require_nas_docker_host; bridge_up ;;
  up)     require_nas_docker_host; bridge_up; cd "$REPO" && supabase start ;;
  # No --no-backup: the point of this stack is that the data survives.
  down)   require_nas_docker_host; ensure_master; cd "$REPO" && supabase stop ;;
  status) require_nas_docker_host; ensure_master; cd "$REPO" && supabase status ;;
  psql)   require_nas_docker_host; bridge_up; require_db; shift || true; "$PSQL" "$DB_URL" "$@" ;;

  baseline)
    # Schema load. Refuses over a database that already has the schema: a second
    # load is not idempotent and its errors scroll past unread.
    require_nas_docker_host; bridge_up; require_db
    [ -f "$BASELINE" ] || { echo "baseline not found: $BASELINE" >&2; exit 1; }
    n=$("$PSQL" "$DB_URL" -tAc "select count(*) from information_schema.tables where table_schema='public'")
    [ "$n" = "0" ] || { echo "public schema already has $n tables -- refusing" >&2; exit 1; }
    "$PSQL" "$DB_URL" -v ON_ERROR_STOP=1 -f "$BASELINE"
    ;;

  verify)
    # A fidelity assertion, not a smoke test. The four counts are production's,
    # and the md5 is production's own pg_get_functiondef for
    # auto_provision_it_admin BEFORE the 3096 fix -- so on a freshly loaded
    # baseline it matches, and after 3096 is applied it deliberately does not.
    require_nas_docker_host; bridge_up; require_db
    "$PSQL" "$DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
select (select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE') as tables,
       (select count(*) from pg_policies where schemaname='public') as policies,
       (select count(distinct trigger_name||':'||event_object_table) from information_schema.triggers where trigger_schema='public') as triggers,
       (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public') as functions,
       (select count(*) from supabase_migrations.schema_migrations) as history_rows,
       md5(pg_get_functiondef('public.auto_provision_it_admin'::regproc)) = '0f8c87bb35f8aa31b3b245907666e892' as baseline_body_unmodified;
SQL
    ;;

  controls)
    # The seven BACKLOG-3096 controls. Control 5 needs two concurrent sessions,
    # so psql must be on PATH for its runner.
    require_nas_docker_host; bridge_up; require_db
    rc=0
    for f in "$REPO"/supabase/tests/backlog-3096/control-[123467]-*.sql; do
      if out=$("$PSQL" "$DB_URL" -v ON_ERROR_STOP=1 -f "$f" 2>&1) && ! grep -qiE "ERROR|FATAL" <<<"$out"; then
        printf '%-72s GREEN\n' "$(basename "$f")"
      else
        printf '%-72s RED   %s\n' "$(basename "$f")" "$(grep -iE 'ERROR' <<<"$out" | head -1)"; rc=1
      fi
    done
    DATABASE_URL="$DB_URL" PATH="$(dirname "$PSQL"):$PATH" \
      "$REPO"/supabase/tests/backlog-3096/control-5-run.sh || rc=1
    exit $rc
    ;;

  *)
    sed -n '2,46p' "${BASH_SOURCE[0]}"
    echo "usage: $(basename "$0") {bridge|up|down|status|psql|baseline|verify|controls}"
    ;;
esac
