#!/usr/bin/env python3
"""Assert the assembled Investor Pack has a cover, one contents page and accurate TOC pages."""

from __future__ import annotations

import re
import sys
from pathlib import Path


def fail(message: str) -> None:
    print(f"Investor Pack layout: {message}", file=sys.stderr)
    raise SystemExit(1)


def normalize(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def markdown_headings(path: Path) -> list[str]:
    headings: list[str] = []
    for line in path.read_text().splitlines():
        match = re.match(r"^#{2,3}\s+(.+?)\s*$", line)
        if match:
            headings.append(normalize(match.group(1)))
    return headings


def main() -> int:
    if len(sys.argv) != 6:
        print(
            "usage: assert-investor-pack-layout.py <text> <pds.md> <sa.md> <contract-id> <renderer>",
            file=sys.stderr,
        )
        return 2

    text_path = Path(sys.argv[1])
    pds_path = Path(sys.argv[2])
    sa_path = Path(sys.argv[3])
    contract_id = sys.argv[4]
    renderer_path = Path(sys.argv[5])

    pds = pds_path.read_text()
    sa = sa_path.read_text()
    legal_text = f"{pds}\n{sa}"
    for forbidden in (
        "Head Lease",
        "head lease",
        "There is no buyout",
        "strictly",
        "Shareholder",
        "Lessor",
        "Prize Freeze",
    ):
        if forbidden.lower() in legal_text.lower():
            fail(f"legal text still contains obsolete wording {forbidden!r}")

    pds_required = (
        "6.1 Voluntary Exit (Subscription Float only)",
        "9.1 14-Day Notice",
        "9.2 Horse Retired from Racing",
        "9.3 Settlement and Refunds",
        "9.4 Fixed Expiry",
        "Are 18 years of age or older",
    )
    sa_required = (
        "8. Individual Exit, Default & Forfeiture",
        "8.1 Voluntary Exit (Subscription Float only)",
        "15.1 14-Day Notice",
        "15.2 Horse Retired from Racing",
        "15.3 Settlement and Refunds",
    )
    both_required = (
        "right of first refusal",
        "Evolution Stables reserves the right to terminate",
    )
    for required in pds_required:
        if required not in pds:
            fail(f"PDS is missing {required!r}")
    for required in sa_required:
        if required not in sa:
            fail(f"SA is missing {required!r}")
    for required in both_required:
        if required not in pds or required not in sa:
            fail(f"both legal documents must contain {required!r}")

    if '**5.1 Calculation:**' not in pds:
        fail("PDS 5.1-5.5 are not separated into readable numbered clauses")
    for obsolete_bullet in ("- **5.1", "- **7.1", "- **10.1"):
        if obsolete_bullet in legal_text:
            fail(f"numbered clause still uses a bullet: {obsolete_bullet}")
    if "**13.1 Performance:**" not in pds:
        fail("PDS Risk Disclosure clauses are not separated")
    if "Campaign:" in legal_text:
        fail("investor-facing metadata still includes the raw campaign slug")
    if "Quarterly." not in pds:
        fail("distribution schedule is not sentence-cased and punctuated")
    if "early.." in pds:
        fail("PDS 13.2 still contains a double period")
    if "processed Quarterly." in sa:
        fail("SA 10.4 still capitalises Quarterly mid-sentence")
    if "| Signatory | Capacity | Date |" not in legal_text:
        fail("signatory grids do not share Signatory / Capacity / Date columns")
    canonical_declarations = (
        "I am at least 18 years of age.",
        "I am not subject to any racing disqualification, exclusion order, or ban under NZTR rules.",
        "I am acquiring the stake as the true beneficial owner.",
        "I accept Evolution Stables Ltd as the syndicate manager and agree to be bound by the NZTR Rules of Racing and Welfare Guidelines.",
        "I understand that participation is a fixed-term leasehold interest and does not confer direct equity ownership.",
        "I will complete identity verification before payment.",
        "I will provide proof of address when requested by the Syndicate Manager.",
    )
    for declaration in canonical_declarations:
        if declaration not in sa:
            fail(f"SA is missing canonical declaration {declaration!r}")
    if "Have provided verified identity and proof of address" in sa:
        fail("SA still declares identity and proof of address as already complete")
    if pds.count("whole calendar months only") != 1:
        fail("PDS must state the whole-calendar-month rule exactly once")
    if sa.count("whole calendar months only") != 1:
        fail("SA must state the whole-calendar-month rule exactly once")

    renderer = renderer_path.read_text()
    for match in re.finditer(r'HexColor\("#([0-9A-Fa-f]{6})"\)', renderer):
        value = match.group(1)
        if not (value[0:2] == value[2:4] == value[4:6]):
            fail(f"renderer contains non-grayscale colour #{value}")

    pages = text_path.read_text(errors="replace").split("\f")
    while pages and not pages[-1].strip():
        pages.pop()
    if len(pages) < 4:
        fail(f"expected at least four pages, found {len(pages)}")

    total_pages = len(pages)
    if total_pages > 15:
        fail(f"density pass should keep the pack to 15 pages; found {total_pages}")
    page_lines = [
        [normalize(line) for line in page.splitlines() if normalize(line)] for page in pages
    ]

    cover = normalize(pages[0])
    for required in (
        "Investor Pack",
        "Product Disclosure Statement + Syndicate Agreement",
        contract_id,
        "Prepared for Session DoD Buyer",
        "Horse Mulan The Brave (NZ)",
        "Legal pack 1.0.4",
        "MOCK — NOT EXECUTED",
    ):
        if required not in cover:
            fail(f"cover page is missing {required!r}")

    contents = normalize(pages[1])
    section_one = "Section 1: Product Disclosure Statement"
    section_two = "Section 2: Syndicate Agreement"
    if "Contents" not in contents:
        fail("page 2 is not the contents page")
    if section_one not in contents or section_two not in contents:
        fail("contents page does not identify both legal sections")
    if re.search(r"(?:\s*\.){3,}", contents):
        fail("contents page still contains dot leaders")

    def section_start(label: str) -> int:
        for page_number, lines in enumerate(page_lines, start=1):
            heading = lines[:6]
            if label == section_one and "SECTION 1" in heading and "Product Disclosure Statement" in heading:
                return page_number
            if label == section_two and "SECTION 2" in heading and "Syndicate Agreement" in heading:
                return page_number
        fail(f"could not find {label!r} at the start of a fresh page")
        raise AssertionError("unreachable")

    pds_start = section_start(section_one)
    sa_start = section_start(section_two)
    if pds_start != 3:
        fail(f"PDS must start on page 3 immediately after one contents page; found {pds_start}")
    if sa_start <= pds_start:
        fail("SA must start after the PDS on a fresh page")

    def page_containing(fragment: str) -> int | None:
        for page_number, lines in enumerate(page_lines, start=1):
            if fragment in lines:
                return page_number
        return None

    for first, second in (
        ("4. Deposit, Float & Billing", "Subscription Float Model:"),
        ("Key Information Summary", "Manager Evolution Stables Ltd is an NZTR-authorised syndicator"),
        ("9. Fees, Float & Billing", "advance)."),
        ("Thoroughbred Details", "Commercial Terms"),
        ("Schedule 2: NZTR Statutory Member Declarations", "Execution"),
    ):
        first_page = page_containing(first)
        second_page = page_containing(second)
        if first_page is not None and second_page is not None and first_page != second_page:
            fail(f"{first!r} and {second!r} must remain on the same page")

    for orphan in ("success across Australasia.", "advance)."):
        for page_number, lines in enumerate(page_lines, start=1):
            if lines and lines[0] == orphan:
                fail(f"page {page_number} starts with orphaned fragment {orphan!r}")

    for page_number in range(2, total_pages + 1):
        text = normalize(pages[page_number - 1])
        if f"Page {page_number} of {total_pages}" not in text:
            fail(
                f"page {page_number} must show 'Page {page_number} of {total_pages}'"
            )
    if "CONTENTS" not in normalize(pages[1]).upper():
        fail("contents page is missing its running page furniture")

    pds_headings = markdown_headings(pds_path)
    sa_headings = markdown_headings(sa_path)
    expected = (
        [(0, section_one, pds_start)]
        + [(1, heading, pds_start) for heading in pds_headings]
        + [(0, section_two, sa_start)]
        + [(1, heading, sa_start) for heading in sa_headings]
    )

    toc_entries: list[tuple[str, int]] = []
    for line in pages[1].splitlines():
        match = re.match(
            r"^\s*(.+?)(?:(?:\s*[.·]){2,}\s*|\s{2,})(\d+)\s*$",
            line,
        )
        if match:
            label = match.group(1).rstrip(". ·")
            toc_entries.append((normalize(label), int(match.group(2))))

    if len(toc_entries) != len(expected):
        fail(
            f"contents has {len(toc_entries)} entries but the two documents contain "
            f"{len(expected)} section/subsection headings"
        )

    for index, ((_, expected_label, search_start), (toc_label, toc_page)) in enumerate(
        zip(expected, toc_entries, strict=True)
    ):
        if expected_label != toc_label:
            fail(
                f"contents entry {index + 1} is {toc_label!r}; expected {expected_label!r}"
            )

        if expected_label == section_one:
            actual_page = pds_start
        elif expected_label == section_two:
            actual_page = sa_start
        else:
            search_end = sa_start - 1 if search_start == pds_start else len(page_lines)
            actual_page = None
            for page_number in range(search_start, search_end + 1):
                if any(
                    line.casefold() == expected_label.casefold()
                    for line in page_lines[page_number - 1]
                ):
                    actual_page = page_number
                    break
        if actual_page is None:
            fail(f"could not find {expected_label!r} in the document body")
        if toc_page != actual_page:
            fail(
                f"contents says {expected_label!r} starts on page {toc_page}; "
                f"it actually starts on page {actual_page}"
            )

    print(
        f"Investor Pack layout PASS: cover 1, contents 2, PDS {pds_start}, "
        f"SA {sa_start}, {len(toc_entries)} indexed headings"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
