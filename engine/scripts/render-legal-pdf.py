#!/usr/bin/env python3
"""Render one Investor Pack (PDS + SA) PDF with ReportLab."""

from __future__ import annotations

import html
import json
import re
import sys
from datetime import datetime
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    CondPageBreak,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.platypus.flowables import HRFlowable
from reportlab.platypus.tableofcontents import TableOfContents


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
    value = html.escape(text.strip().replace(" — ", ", "))
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
            fontSize=9.5,
            leading=13.9,
            alignment=TA_JUSTIFY,
            spaceBefore=0,
            spaceAfter=6,
            allowWidows=0,
            allowOrphans=0,
        ),
        "h1": ParagraphStyle(
            "LegalH1",
            parent=base,
            fontName=FONT_BOLD,
            fontSize=22,
            leading=27,
            spaceBefore=0,
            spaceAfter=8,
            keepWithNext=True,
            textColor=colors.HexColor("#1F1F1F"),
        ),
        "sectionEyebrow": ParagraphStyle(
            "SectionEyebrow",
            parent=base,
            fontName=FONT_BOLD,
            fontSize=8,
            leading=10,
            spaceBefore=0,
            spaceAfter=2,
            keepWithNext=True,
            textColor=colors.HexColor("#666666"),
        ),
        "h2": ParagraphStyle(
            "LegalH2",
            parent=base,
            fontName=FONT_BOLD,
            fontSize=13,
            leading=16.5,
            spaceBefore=13,
            spaceAfter=6,
            keepWithNext=True,
            textColor=colors.HexColor("#242424"),
        ),
        "h3": ParagraphStyle(
            "LegalH3",
            parent=base,
            fontName=FONT_BOLD,
            fontSize=8.8,
            leading=11.5,
            spaceBefore=9,
            spaceAfter=4,
            keepWithNext=True,
            textColor=colors.HexColor("#555555"),
        ),
        "small": ParagraphStyle(
            "LegalSmall",
            parent=base,
            fontName=FONT,
            fontSize=8.5,
            leading=11.5,
            textColor=colors.HexColor("#444444"),
        ),
        "tableCell": ParagraphStyle(
            "LegalTableCell",
            parent=base,
            fontName=FONT,
            fontSize=8.7,
            leading=11.8,
            alignment=TA_LEFT,
            spaceBefore=0,
            spaceAfter=0,
        ),
        "coverBrand": ParagraphStyle(
            "CoverBrand",
            parent=base,
            fontName=FONT_BOLD,
            fontSize=10,
            leading=14,
            textColor=colors.HexColor("#555555"),
            spaceAfter=18,
        ),
        "coverTitle": ParagraphStyle(
            "CoverTitle",
            parent=base,
            fontName=FONT_BOLD,
            fontSize=34,
            leading=40,
            textColor=colors.HexColor("#111111"),
            spaceAfter=8,
        ),
        "coverSubtitle": ParagraphStyle(
            "CoverSubtitle",
            parent=base,
            fontName=FONT,
            fontSize=14,
            leading=20,
            textColor=colors.HexColor("#333333"),
            spaceAfter=20,
        ),
        "metaLabel": ParagraphStyle(
            "MetaLabel",
            parent=base,
            fontName=FONT_BOLD,
            fontSize=8.5,
            leading=11,
            textColor=colors.HexColor("#555555"),
        ),
        "metaValue": ParagraphStyle(
            "MetaValue",
            parent=base,
            fontName=FONT,
            fontSize=9.5,
            leading=12,
            textColor=colors.HexColor("#111111"),
        ),
        "coverStatus": ParagraphStyle(
            "CoverStatus",
            parent=base,
            fontName=FONT_BOLD,
            fontSize=10,
            leading=14,
            textColor=colors.HexColor("#333333"),
        ),
        "contentsTitle": ParagraphStyle(
            "ContentsTitle",
            parent=base,
            fontName=FONT_BOLD,
            fontSize=22,
            leading=27,
            spaceAfter=6,
        ),
        "contentsIntro": ParagraphStyle(
            "ContentsIntro",
            parent=base,
            fontName=FONT,
            fontSize=8.8,
            leading=11.5,
            textColor=colors.HexColor("#444444"),
            spaceAfter=10,
        ),
        "tocSection": ParagraphStyle(
            "TOCSection",
            parent=base,
            fontName=FONT_BOLD,
            fontSize=9.8,
            leading=12.5,
            textColor=colors.HexColor("#111111"),
            spaceBefore=6,
            spaceAfter=1,
        ),
        "tocLevel1": ParagraphStyle(
            "TOCLevel1",
            parent=base,
            fontName=FONT,
            fontSize=7.5,
            leading=9.2,
            leftIndent=10,
            firstLineIndent=-4,
            spaceBefore=0,
            spaceAfter=0,
            textColor=colors.HexColor("#222222"),
        ),
        "tocLevel2": ParagraphStyle(
            "TOCLevel2",
            parent=base,
            fontName=FONT,
            fontSize=7,
            leading=8.6,
            leftIndent=24,
            firstLineIndent=-4,
            spaceBefore=0,
            spaceAfter=0,
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
    data = [[Paragraph(inline(cell), STYLE["tableCell"]) for cell in row] for row in normalized]
    width = 170 * mm
    col_widths = [width / column_count] * column_count
    table = Table(data, colWidths=col_widths, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("LINEBELOW", (0, 0), (-1, 0), 0.7, colors.HexColor("#777777")),
                ("LINEBELOW", (0, 1), (-1, -2), 0.25, colors.HexColor("#DDDDDD")),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F5F5F5")),
                ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return table


def markdown_flowables(markdown: str, section_number: int | None = None) -> list[object]:
    flowables: list[object] = []
    paragraph: list[str] = []
    bullets: list[tuple[int, str]] = []

    def flush_paragraph() -> None:
        if paragraph:
            flowables.append(Paragraph(inline(" ".join(paragraph)), STYLE["body"]))
            paragraph.clear()

    def flush_bullets() -> None:
        for depth, text in bullets:
            marker = "•" if depth == 0 else "–"
            style = ParagraphStyle(
                f"LegalBullet{depth}",
                parent=STYLE["body"],
                leftIndent=12 + depth * 16,
                bulletIndent=depth * 16,
                alignment=TA_LEFT,
                spaceAfter=4,
                allowWidows=0,
                allowOrphans=0,
            )
            flowables.append(
                KeepTogether([Paragraph(inline(text), style, bulletText=marker)])
            )
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
            heading_text = heading.group(2)
            display_heading = (
                re.sub(r"^(\d+\.\d+)\s+", r"\1  ", heading_text.upper())
                if level == 3
                else heading_text
            )
            if level == 2 and heading_text.startswith("Schedule 2:"):
                flowables.append(PageBreak())
            elif level == 2 and heading_text.startswith("9. Fees, Float & Billing"):
                flowables.append(CondPageBreak(105 * mm))
            elif level == 2 and heading_text.startswith("4. Deposit, Float & Billing"):
                flowables.append(CondPageBreak(65 * mm))
            elif level == 2:
                flowables.append(CondPageBreak(44 * mm))
            elif level == 3:
                flowables.append(CondPageBreak(34 * mm))
            if level == 1 and section_number is not None:
                flowables.append(
                    Paragraph(f"SECTION {section_number}", STYLE["sectionEyebrow"])
                )
            paragraph_flowable = Paragraph(inline(display_heading), style)
            if section_number is not None:
                paragraph_flowable._toc_level = 0 if level == 1 else level - 1
                toc_text = (
                    f"Section {section_number}: {heading_text}"
                    if level == 1
                    else heading_text
                )
                paragraph_flowable._toc_text = inline(toc_text)
                paragraph_flowable._toc_bookmark = heading_text
            flowables.append(paragraph_flowable)
            if level == 1:
                flowables.append(
                    HRFlowable(
                        width="100%",
                        thickness=0.6,
                        color=colors.HexColor("#888888"),
                        spaceBefore=0,
                        spaceAfter=5 * mm,
                    )
                )
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


def display_date(value: str) -> str:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return value
    month = (
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
    )[parsed.month - 1]
    return f"{parsed.day} {month} {parsed.year}"


def cover_flowables(payload: dict[str, str]) -> list[object]:
    rows = (
        ("Prepared for", payload["investor_name"]),
        ("Horse", payload["horse_name"]),
        ("Contract ID", payload["contract_id"]),
        ("Sale date", display_date(payload["executed_date"])),
        ("Issued", display_date(payload["created_at"])),
        ("Legal pack", payload["legal_pack_version"]),
    )
    metadata = Table(
        [
            [
                Paragraph(inline(label), STYLE["metaLabel"]),
                Paragraph(inline(value), STYLE["metaValue"]),
            ]
            for label, value in rows
        ],
        colWidths=[38 * mm, 132 * mm],
        hAlign="LEFT",
    )
    metadata.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LINEBELOW", (0, 0), (-1, -2), 0.35, colors.HexColor("#D5D5D5")),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )

    status = Table(
        [[Paragraph("MOCK — NOT EXECUTED", STYLE["coverStatus"])]],
        colWidths=[68 * mm],
        hAlign="LEFT",
    )
    status.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F7F7F7")),
                ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#999999")),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )

    return [
        Spacer(1, 26 * mm),
        Paragraph("EVOLUTION STABLES", STYLE["coverBrand"]),
        Paragraph("Investor Pack", STYLE["coverTitle"]),
        Paragraph(
            "Product Disclosure Statement + Syndicate Agreement",
            STYLE["coverSubtitle"],
        ),
        HRFlowable(
            width="46%",
            thickness=1,
            color=colors.HexColor("#888888"),
            spaceBefore=0,
            spaceAfter=7 * mm,
        ),
        metadata,
        Spacer(1, 12 * mm),
        status,
        Spacer(1, 8 * mm),
        Paragraph(
            "This Investor Pack contains two legal documents. The Product Disclosure "
            "Statement appears first, followed by the Syndicate Agreement. Each section "
            "starts on a new page.",
            STYLE["small"],
        ),
        PageBreak(),
    ]


def contents_flowables() -> list[object]:
    toc = TableOfContents()
    toc.levelStyles = [STYLE["tocSection"], STYLE["tocLevel1"], STYLE["tocLevel2"]]
    toc.dotsMinLevel = -1
    toc.tableStyle = TableStyle(
        [
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ]
    )
    return [
        Paragraph("Contents", STYLE["contentsTitle"]),
        Paragraph(
            "Section 1 contains the Product Disclosure Statement. Section 2 contains "
            "the Syndicate Agreement. Page numbers refer to this Investor Pack.",
            STYLE["contentsIntro"],
        ),
        toc,
        PageBreak(),
    ]


class InvestorPackCanvas(canvas.Canvas):
    """Draw final running headers and page totals after all page breaks are known."""

    def __init__(self, *args, document: "InvestorPackDocTemplate", **kwargs) -> None:
        self._document = document
        self._saved_page_states: list[dict[str, object]] = []
        super().__init__(*args, **kwargs)

    def showPage(self) -> None:
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self) -> None:
        total_pages = len(self._saved_page_states)
        for page_number, state in enumerate(self._saved_page_states, start=1):
            self.__dict__.update(state)
            self._draw_page_furniture(page_number, total_pages)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def _draw_page_furniture(self, page_number: int, total_pages: int) -> None:
        if page_number == 1:
            return

        left = 20 * mm
        right = A4[0] - 20 * mm
        header_y = A4[1] - 14 * mm
        footer_y = 11 * mm

        if page_number == 2:
            section_name = "CONTENTS"
        else:
            pds_start = self._document.section_pages.get("Product Disclosure Statement")
            sa_start = self._document.section_pages.get("Syndicate Agreement")
            section_name = (
                "SYNDICATE AGREEMENT"
                if sa_start is not None and page_number >= sa_start
                else "PRODUCT DISCLOSURE STATEMENT"
                if pds_start is not None and page_number >= pds_start
                else "INVESTOR PACK"
            )

        self.saveState()
        self.setFont(FONT, 7)
        self.setFillColor(colors.HexColor("#666666"))
        self.drawString(left, header_y, "EVOLUTION STABLES")
        self.drawRightString(right, header_y, f"INVESTOR PACK · {section_name}")
        self.setStrokeColor(colors.HexColor("#CCCCCC"))
        self.setLineWidth(0.3)
        self.line(left, header_y - 2.5 * mm, right, header_y - 2.5 * mm)

        self.line(left, footer_y + 4 * mm, right, footer_y + 4 * mm)
        self.setFont(FONT, 7)
        self.drawString(
            left,
            footer_y,
            f"{self._document.contract_id} · MOCK — NOT EXECUTED",
        )
        self.drawRightString(right, footer_y, f"Page {page_number} of {total_pages}")
        self.restoreState()


class InvestorPackDocTemplate(SimpleDocTemplate):
    """Build the Investor Pack twice so the contents page can carry final page numbers."""

    def __init__(self, *args, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        self._toc_entry_index = 0
        self.section_pages: dict[str, int] = {}
        self.contract_id = ""

    def beforeDocument(self) -> None:
        self._toc_entry_index = 0
        self.section_pages = {}
        super().beforeDocument()

    def afterFlowable(self, flowable) -> None:
        level = getattr(flowable, "_toc_level", None)
        text = getattr(flowable, "_toc_text", None)
        bookmark = getattr(flowable, "_toc_bookmark", None)
        if level is None or text is None or bookmark is None:
            return

        self._toc_entry_index += 1
        key = f"toc-entry-{self._toc_entry_index}"
        if level == 0:
            self.section_pages[bookmark] = self.page
        self.canv.bookmarkPage(key)
        self.canv.addOutlineEntry(bookmark, key, level, False)
        self.notify("TOCEntry", (level, text, self.page, key))


def build(payload: dict[str, str]) -> None:
    output_path = Path(payload["output_path"])
    contract_id = payload["contract_id"]

    doc = InvestorPackDocTemplate(
        str(output_path),
        pagesize=A4,
        rightMargin=20 * mm,
        leftMargin=20 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
        allowWidows=0,
        allowOrphans=0,
        title=f"{contract_id} — Investor Pack (PDS + SA) (MOCK)",
        author="Evolution Stables Ltd",
    )
    doc.contract_id = contract_id

    story: list[object] = [
        *cover_flowables(payload),
        *contents_flowables(),
        *markdown_flowables(payload["pds_markdown"], section_number=1),
        PageBreak(),
        *markdown_flowables(payload["sa_markdown"], section_number=2),
    ]

    def canvasmaker(*args, **kwargs):
        return InvestorPackCanvas(*args, document=doc, **kwargs)

    doc.multiBuild(story, canvasmaker=canvasmaker)


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: render-legal-pdf.py <input-json>", file=sys.stderr)
        return 2
    payload = json.loads(Path(sys.argv[1]).read_text())
    build(payload)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
