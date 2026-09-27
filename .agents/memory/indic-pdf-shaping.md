---
name: Indic PDF shaping
description: Limits of pdfmake's bundled Indic font shaping and sample-PDF coverage
---

pdfmake's bundled fontkit can throw a null-anchor error during Gurmukhi GPOS positioning for ordinary multiword phrases, even when other Gurmukhi text renders correctly. This is a generation failure, not a missing font asset; passing short-word font/glyph checks does not prove arbitrary Gurmukhi text is safe.

**Why:** A synthetic Gurmukhi prescription using an instruction equivalent to “after food” crashed in GPOS positioning, while shorter Gurmukhi instructions in the same PDF layout passed.

**How to apply:** When changing the PDF renderer or font versions, exercise realistic script-shaping phrases separately from the short smoke samples and investigate the shaping engine rather than suppressing errors or treating an embedded font as proof of coverage.