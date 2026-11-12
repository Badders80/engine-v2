#!/usr/bin/env python3
"""Render the combined PDS/SA Markdown to one PDF with ReportLab."""

from __future__ import annotations

import html
import json
import re
import sys
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


def register_fonts() -> tuple[str, str]:
    regular = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
    bold = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")
    if regular.exists() and bold.exists():
        pdfmetrics.registerFont(TTFont("LegalSans", regular))
        pdfmetrics.registerFont(TTFont("LegalSans-Bold", bold))
        return "LegalSans", "LegalSans-Bold"
    return "Helvetica", "Helvetica-Bold"


FONT, FONT_BOLD = register_fonts()


def inline(text: str) -> str:
    value = html.escape(text.strip())
    value = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", value)
    value = re.sub(r"`(.+?)`", r"\1", value)
    return value


def styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()["BodyText"]
    return {
        "body": ParagraphStyle(
            "LegalBody",
            parent=base,
            fontName=FONT,
            fontSize=9.4,
            leading=13,
            textAlign=TA_LEFT,
            spaceAfter=5,
        ),
        "h1": ParagraphStyle(
            "LegalH1",
            parent=base,
            fontName=FONT_BOLD,
            fontSize=20,
            leading=24,
            spaceAfter=12,
        ),
        "h2": ParagraphStyle(
            "LegalH2",
            parent=base,
            fontName=FONT_BOLD,
            fontSize=13,
            leading=16,
            spaceBefore=10,
            spaceAfter=6,
        ),
        "h3": ParagraphStyle(
            "LegalH3",
            parent=base,
            fontName=FONT_BOLD,
            fontSize=10.5,
            leading=13,
            spaceBefore=7,
            spaceAfter=4,
        ),
        "small": ParagraphStyle(
            "LegalSmall",
            parent=base,
            fontName=FONT,
            fontSize=8,
            leading=10,
            textColor=colors.HexColor("#444444"),
        ),
    }


STYLE = styles()


def is_table_line(line: str) -> bool:
    return line.strip().startswith("|") and line.strip().endswith("|")


def table_flowable(lines: list[str]) -> Table:
    rows: list[list[str]] = []
    for line in lines:
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if all(re.fullmatch(r":?-{3,}:?", cell) for cell in cells):
            continue
        rows.append(cells)

    if not rows:
        return Table([[""]])

    column_count = max(len(row) for row in rows)
    normalized = [row + [""] * (column_count - len(row)) for row in rows]
    data = [[Paragraph(inline(cell), STYLE["body"]) for cell in row] for row in normalized]
    width = 178 * mm
    col_widths = [width / column_count] * column_count
    table = Table(data, colWidths=col_widths, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#888888")),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F0F0F0")),
                ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    return table


def markdown_flowables(markdown: str) -> list[object]:
    flowables: list[object] = []
    paragraph: list[str] = []
    bullets: list[tuple[int, str]] = []

    def flush_paragraph() -> None:
        if paragraph:
            flowables.append(Paragraph(inline(" ".join(paragraph)), STYLE["body"]))
            paragraph.clear()

    def flush_bullets() -> None:
        for depth, text in bullets:
            style = ParagraphStyle(
                f"LegalBullet{depth}",
                parent=STYLE["body"],
                leftIndent=(depth + 1) * 12,
                bulletIndent=depth * 12,
            )
            flowables.append(Paragraph(inline(text), style, bulletText="•"))
        bullets.clear()

    lines = markdown.splitlines()
    index = 0
    while index < len(lines):
        raw = lines[index]
        stripped = raw.strip()

        if is_table_line(raw):
            flush_paragraph()
            flush_bullets()
            table_lines: list[str] = []
            while index < len(lines) and is_table_line(lines[index]):
                table_lines.append(lines[index])
                index += 1
            flowables.append(table_flowable(table_lines))
            flowables.append(Spacer(1, 3 * mm))
            continue

        if stripped == "":
            flush_paragraph()
            flush_bullets()
            index += 1
            continue

        if stripped in {"---", "***"}:
            flush_paragraph()
            flush_bullets()
            flowables.append(Spacer(1, 2 * mm))
            index += 1
            continue

        heading = re.match(r"^(#{1,3})\s+(.+)$", stripped)
        if heading:
            flush_paragraph()
            flush_bullets()
            level = len(heading.group(1))
            style = STYLE["h1"] if level == 1 else STYLE["h2"] if level == 2 else STYLE["h3"]
            flowables.append(Paragraph(inline(heading.group(2)), style))
            index += 1
            continue

        bullet = re.match(r"^(\s*)[-*]\s+(.+)$", raw)
        if bullet:
            flush_paragraph()
            depth = min(len(bullet.group(1)) // 2, 3)
            bullets.append((depth, bullet.group(2)))
            index += 1
            continue

        numbered = re.match(r"^\s*\d+\.\s+(.+)$", raw)
        if numbered:
            flush_paragraph()
            flush_bullets()
            flowables.append(Paragraph(f"• {inline(numbered.group(1))}", STYLE["body"]))
            index += 1
            continue

        paragraph.append(stripped.removesuffix("  "))
        index += 1

    flush_paragraph()
    flush_bullets()
    return flowables


def build(payload: dict[str, str]) -> None:
    output_path = Path(payload["output_path"])
    contract_id = payload["contract_id"]
    version = payload["legal_pack_version"]

    def footer(canvas, doc) -> None:
        canvas.saveState()
        canvas.setFont(FONT, 7.5)
        canvas.setFillColor(colors.HexColor("#555555"))
        canvas.drawString(16 * mm, 9 * mm, f"{contract_id} · Legal pack {version}")
        canvas.drawRightString(194 * mm, 9 * mm, f"Page {doc.page}")
        canvas.restoreState()

    doc = SimpleDocTemplate(
        str(output_path),
        pagesize=A4,
        rightMargin=16 * mm,
        leftMargin=16 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
        title=f"{contract_id} — PDS and SA (MOCK)",
        author="Evolution Stables Ltd",
    )

    story: list[object] = [
        Paragraph("<b>MOCK — NOT EXECUTED</b>", STYLE["h3"]),
        Paragraph(f"<b>Contract ID:</b> {html.escape(contract_id)}", STYLE["body"]),
        Spacer(1, 4 * mm),
        *markdown_flowables(payload["pds_markdown"]),
        PageBreak(),
        Paragraph("<b>MOCK — NOT EXECUTED</b>", STYLE["h3"]),
        Paragraph(f"<b>Contract ID:</b> {html.escape(contract_id)}", STYLE["body"]),
        Spacer(1, 4 * mm),
        *markdown_flowables(payload["sa_markdown"]),
    ]
    doc.build(story, onFirstPage=footer, onLaterPages=footer)


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: render-legal-pdf.py <input-json>", file=sys.stderr)
        return 2
    payload = json.loads(Path(sys.argv[1]).read_text())
    build(payload)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
