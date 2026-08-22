#!/usr/bin/env bash
#
# Run one of this repo's hand-rolled test scripts and prove it ACTUALLY RAN.
#
# WHY THIS EXISTS
# ---------------
# `scripts/test-portal-cna-storage-safety.mjs` and
# `scripts/test-portal-signin-fields.mjs` are not conventional test files.
# Each one bundles real application source with esbuild, substituting stubs
# for the framework edges, and then asserts against the real code. That
# design is what makes them valuable -- they test the actual
# `attemptSubmit`, not a reimplementation of it -- but it gives them a
# failure mode a normal test runner does not have:
#
#   The stubs must enumerate every named export the code under test
#   imports. When application code grows a new import that no stub
#   exports, esbuild fails the BUILD. The assertions never execute.
#
# This has already happened. On `origin/main`, `portal.success.tsx` gained
# an import of `GUEST_LEGIBILITY_CARD_CLASS` that the stub did not export,
# and `test-portal-cna-storage-safety.mjs` stopped testing anything. Nobody
# noticed, because nothing in this repo ran it.
#
# WHAT THIS DOES AND DOES NOT PROTECT AGAINST
# -------------------------------------------
# Measured, not assumed: a top-level esbuild failure in an ESM script DOES
# exit non-zero (verified: exit code 1). So the exit code alone is not a
# liar, and simply wiring these into CI fixes the incident above.
#
# The residual risk that exit code cannot see is COVERAGE SILENTLY
# SHRINKING: a whole `{ ... }` assertion block gets removed or refactored
# away, a stub starts returning something that makes a check vacuous, or a
# section stops being reached. The suite still exits 0 -- it just tests
# less than it used to, quietly. That is the same class of failure as the
# original incident, so it gets the same treatment: make it impossible to
# happen in silence.
#
# Three gates, all of which must hold:
#   1. exit status 0
#   2. the suite's own success sentinel appears on stdout
#   3. at least MIN_CHECKS lines matching "  ok " -- the check count is
#      pinned, so deleting assertions fails the build
#
# Raise MIN_CHECKS in the caller whenever you legitimately add checks.
# Never lower it without saying why in the commit message.
#
# Usage:
#   ci-gated-test.sh <label> <min-checks> <success-sentinel> <cmd> [args...]
#
set -uo pipefail

LABEL="${1:?usage: ci-gated-test.sh <label> <min-checks> <sentinel> <cmd>...}"
MIN_CHECKS="${2:?missing min-checks}"
SENTINEL="${3:?missing success sentinel}"
shift 3
[[ $# -gt 0 ]] || { echo "ERROR: no command given" >&2; exit 2; }

echo "== $LABEL =="
echo "   command:    $*"
echo "   expecting:  >= $MIN_CHECKS checks, sentinel \"$SENTINEL\""
echo

OUT="$(mktemp)"
trap 'rm -f "$OUT"' EXIT

set +e
"$@" 2>&1 | tee "$OUT"
STATUS="${PIPESTATUS[0]}"
set -e

echo
FAILED=0

# --- Gate 1: exit status -------------------------------------------------
if [[ "$STATUS" -ne 0 ]]; then
  echo "FAIL [$LABEL] exited $STATUS"
  FAILED=1
else
  echo "  ok  exit status 0"
fi

# --- Gate 2: the suite says it succeeded ---------------------------------
# Guards the case where a harness is refactored into swallowing its own
# failure and returning 0 without ever reaching its own success path.
if grep -qF -- "$SENTINEL" "$OUT"; then
  echo "  ok  success sentinel present"
else
  echo "FAIL [$LABEL] success sentinel \"$SENTINEL\" never printed."
  echo "     The suite did not reach its own success path. If it died"
  echo "     during the esbuild bundle step, look for a named export the"
  echo "     stubs in the test file do not provide yet."
  FAILED=1
fi

# --- Gate 3: the assertions actually ran ---------------------------------
COUNT="$(grep -c '^  ok ' "$OUT" || true)"
if [[ "$COUNT" -ge "$MIN_CHECKS" ]]; then
  echo "  ok  $COUNT checks ran (floor $MIN_CHECKS)"
else
  echo "FAIL [$LABEL] only $COUNT checks ran, floor is $MIN_CHECKS."
  echo "     Assertions disappeared rather than failing. Either restore"
  echo "     them, or lower the floor deliberately and say why."
  FAILED=1
fi

echo
if [[ "$FAILED" -ne 0 ]]; then
  echo "== $LABEL: FAILED =="
  exit 1
fi
echo "== $LABEL: passed =="
