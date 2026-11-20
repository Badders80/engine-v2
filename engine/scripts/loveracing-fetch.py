#!/usr/bin/env python3
"""Fetch a loveracing.nz page for the engine.

Why this exists: loveracing.nz sits behind a Cloudflare JS challenge, and a
plain HTTP client — Node's `fetch`, curl, requests — gets `403 Just a moment…`
regardless of User-Agent. TLS impersonation gets through: `curl_cffi` presents
the same TLS fingerprint as a real Chrome and the edge lets it past. Proven
against both Stud Book URL shapes on 2026-11-09.

Usage:  python3 loveracing-fetch.py <url>
        python3 loveracing-fetch.py <pedigree-endpoint-url> --json '<payload>'
Output: the response body on stdout, nothing else.
Exit:   0 on success; non-zero with a message on stderr otherwise.

The engine validates the URL before calling (https, exact host allowlist, no
redirects). This script repeats the host check so it is safe to use alone.
"""

import json
import re
import sys
from urllib.parse import urlparse

ALLOWED_HOSTS = {"loveracing.nz", "www.loveracing.nz"}
PEDIGREE_SUMMARY_URL = (
    "https://loveracing.nz/Common/ServerScript/Breeding.aspx/GetHorsePedigree"
)
MAX_BYTES = 8 * 1024 * 1024


def main() -> int:
    if len(sys.argv) not in (2, 4) or (len(sys.argv) == 4 and sys.argv[2] != "--json"):
        print(
            "usage: loveracing-fetch.py <url> [--json '<payload>']",
            file=sys.stderr,
        )
        return 2

    url = sys.argv[1].strip()
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.hostname not in ALLOWED_HOSTS:
        print(f"refused: not an https loveracing.nz link ({url})", file=sys.stderr)
        return 3

    payload = None
    if len(sys.argv) == 4:
        if url != PEDIGREE_SUMMARY_URL:
            print("refused: --json is only allowed for the pedigree summary endpoint", file=sys.stderr)
            return 3
        try:
            payload = json.loads(sys.argv[3])
        except json.JSONDecodeError as error:
            print(f"refused: --json payload is invalid: {error}", file=sys.stderr)
            return 3
        horse_id = payload.get("horseID") if isinstance(payload, dict) else None
        if not isinstance(horse_id, str) or re.fullmatch(r"\d+", horse_id) is None:
            print("refused: pedigree payload needs a numeric horseID string", file=sys.stderr)
            return 3

    try:
        from curl_cffi import requests as cffi
    except ImportError:
        print(
            "curl_cffi is not installed: pip install --user curl_cffi",
            file=sys.stderr,
        )
        return 4

    try:
        if payload is None:
            response = cffi.get(url, impersonate="chrome124", timeout=25, allow_redirects=False)
        else:
            response = cffi.post(
                url,
                json=payload,
                headers={"Accept": "application/json"},
                impersonate="chrome124",
                timeout=25,
                allow_redirects=False,
            )
    except Exception as error:  # noqa: BLE001 - any transport failure is a refusal
        print(f"fetch failed: {type(error).__name__}: {error}", file=sys.stderr)
        return 5

    if 300 <= response.status_code < 400:
        print(f"redirected ({response.status_code}); redirects are refused", file=sys.stderr)
        return 6

    if response.status_code != 200:
        print(f"loveracing.nz answered {response.status_code}", file=sys.stderr)
        return 7

    body = response.text
    if len(body.encode("utf-8")) > MAX_BYTES:
        print("page too large", file=sys.stderr)
        return 8

    sys.stdout.write(body)
    return 0


if __name__ == "__main__":
    sys.exit(main())
