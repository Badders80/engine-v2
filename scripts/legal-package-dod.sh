#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

cd "$ROOT"
pnpm --filter engine run legal:package:fixture -- --out-dir "$TMP/out"
bash scripts/verify-legal-package.sh "$TMP/out/ES-DSL-2026-900001"
