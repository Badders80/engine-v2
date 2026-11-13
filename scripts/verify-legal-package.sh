#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATES="$ROOT/engine/src/templates"
DIR="${1:-}"

if [ -z "$DIR" ] || [ ! -d "$DIR" ]; then
  echo "usage: verify-legal-package.sh <contract-package-directory>" >&2
  exit 2
fi

cd "$DIR"

for file in contract.pdf pds.md sa.md manifest.json provenance.json SHA256SUMS; do
  [ -f "$file" ] || { echo "missing $file" >&2; exit 1; }
done

contract_id="$(jq -r '.contract_id' manifest.json)"
[[ "$contract_id" =~ ^ES-DSL-[0-9]{4}-[0-9]{6}$ ]] || {
  echo "invalid contract_id: $contract_id" >&2
  exit 1
}

manifest_keys="$(jq -r 'keys | sort | join(" ")' manifest.json)"
[ "$manifest_keys" = "contract_id created_at object_key pdf_sha256 sale_id template_versions" ] || {
  echo "manifest keys are not the locked six: $manifest_keys" >&2
  exit 1
}

jq -e --arg contract "$contract_id" \
  '.object_key == ("out/legal/" + $contract + "/contract.pdf")' manifest.json >/dev/null
jq -e --argjson hashes "$(jq '.template_hashes' provenance.json)" \
  '.template_versions.files == $hashes' manifest.json >/dev/null
jq -e 'tostring | (contains("full_name") or contains("email")) | not' manifest.json >/dev/null

actual_pdf_hash="$(sha256sum contract.pdf | awk '{print $1}')"
manifest_pdf_hash="$(jq -r '.pdf_sha256' manifest.json)"
[ "$actual_pdf_hash" = "$manifest_pdf_hash" ] || {
  echo "PDF hash does not match manifest" >&2
  exit 1
}
sha256sum -c SHA256SUMS >/dev/null

actual_pds_hash="$(sha256sum pds.md | awk '{print $1}')"
actual_sa_hash="$(sha256sum sa.md | awk '{print $1}')"
[ "$actual_pds_hash" = "$(jq -r '.pds_sha256' provenance.json)" ] || {
  echo "PDS hash does not match provenance" >&2
  exit 1
}
[ "$actual_sa_hash" = "$(jq -r '.sa_sha256' provenance.json)" ] || {
  echo "SA hash does not match provenance" >&2
  exit 1
}

while IFS=$'\t' read -r relative expected; do
  actual="$(sha256sum "$TEMPLATES/$relative" | awk '{print $1}')"
  [ "$actual" = "$expected" ] || {
    echo "template hash mismatch: $relative" >&2
    exit 1
  }
done < <(jq -r '.template_hashes | to_entries[] | [.key, .value] | @tsv' provenance.json)

if rg -n '\{\{|\}\}' pds.md sa.md >/dev/null; then
  echo "rendered Markdown still contains a token" >&2
  exit 1
fi

pages="$(pdfinfo contract.pdf | awk '/^Pages:/ {print $2}')"
[ -n "$pages" ] && [ "$pages" -ge 2 ] || {
  echo "PDF must have at least two pages" >&2
  exit 1
}

text_file="$(mktemp)"
trap 'rm -f "$text_file"' EXIT
pdftotext -layout contract.pdf "$text_file"
python3 "$ROOT/scripts/assert-investor-pack-layout.py" \
  "$text_file" pds.md sa.md "$contract_id" "$ROOT/engine/scripts/render-legal-pdf.py"
grep -Fq 'MOCK — NOT EXECUTED' "$text_file" || {
  echo "PDF is missing the mock banner" >&2
  exit 1
}
grep -Fq 'Product Disclosure Statement' "$text_file"
grep -Fq 'Syndicate Agreement' "$text_file"
grep -Fq 'Legal pack' "$text_file"
occurrences="$(grep -Fo "$contract_id" "$text_file" | wc -l)"
[ "$occurrences" -ge 2 ] || {
  echo "contract ID appears fewer than twice in the PDF" >&2
  exit 1
}

printf 'PASS legal package %s\n' "$contract_id"
printf 'pdf_sha256 %s\n' "$actual_pdf_hash"
printf 'pds_sha256 %s\n' "$actual_pds_hash"
printf 'sa_sha256 %s\n' "$actual_sa_hash"
printf 'pages %s\n' "$pages"
