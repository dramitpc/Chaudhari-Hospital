---
name: Chromium Indic print fonts
description: How Chromium labels Indic font subsets in printed PDFs
---

Chromium may embed a Noto Sans Devanagari browser-print subset under the internal PostScript name `NotoSans-Regular`, while still correctly painting and mapping Devanagari text. Do not use the CSS family name's appearance in `pdffonts` as the sole assertion of script support.

**Why:** A browser-print regression initially failed only for Devanagari despite correct extracted text and rasterized glyphs. The installed font's internal PDF subset name differed from its CSS family.

**How to apply:** For HTML-to-print-PDF tests, check A4 geometry, extracted base letters and combining marks, word bounds, and raster ink. Embedded Unicode font rows are useful, but a family-name match is not a reliable cross-font requirement.