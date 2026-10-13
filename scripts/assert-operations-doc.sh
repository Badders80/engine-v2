#!/usr/bin/env bash
#
# assert-operations-doc.sh
#
# PLAN.md step 1: the operator guide moves to `engine/OPERATIONS.md` inside this
# repo. It does not go in the parent folder, and the website app does not get a
# second copy.
#
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

TARGET="$REPO_ROOT/engine/OPERATIONS.md"
STRAY="$REPO_ROOT/website/OPERATIONS.md"
PARENT="$REPO_ROOT/../OPERATIONS.md"

status=0

if [[ ! -f "$TARGET" ]]; then
  echo "FAIL: engine/OPERATIONS.md is missing."
  status=1
elif [[ ! -s "$TARGET" ]]; then
  echo "FAIL: engine/OPERATIONS.md is empty."
  status=1
else
  echo "OK: engine/OPERATIONS.md present ($(wc -l < "$TARGET") lines)."
fi

if [[ -e "$STRAY" ]]; then
  echo "FAIL: website/OPERATIONS.md exists; the website app must not carry a second copy."
  status=1
fi

if [[ -e "$PARENT" ]]; then
  echo "FAIL: ../OPERATIONS.md exists; the guide does not live in the parent folder."
  status=1
fi

exit "$status"
