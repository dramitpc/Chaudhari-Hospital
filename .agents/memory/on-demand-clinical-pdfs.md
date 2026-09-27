---
name: On-demand clinical PDFs
description: Confirmed policy for generating prescription, receipt, and future clinical document PDFs.
---

Generate prescription and billing PDFs on demand from structured application data. Do not create PDFs from screenshots or permanently store routine generated copies. Archive a PDF only when a legally immutable document copy is explicitly required.

Generated documents must preserve the corresponding screen preview's hierarchy and format controls. Multilingual prescriptions must use bundled local Unicode fonts, retain translated/bilingual display modes, and remain usable without an internet font service. Payment receipts remain English-only and preserve the compact September 3 layout: upper-half A4 composition, right-aligned INVOICE heading and status, Bill To/Doctor cards, navy item table, split payment/totals summary, and thank-you footer.

Apply script-aware font selection to all text in a prescription PDF, not only fields explicitly marked as translations. Original structured fields can already contain Indian-language text; a Latin-only embedded font renders those characters as boxes even when the PDF is valid and one page.

**Why:** A real downloaded prescription contained Indian-language text in source fields, but only a Latin font was embedded; multiple viewers showed boxes instead of characters.

**How to apply:** Choose embedded font runs by Unicode script across letterhead, instructions, advice, consultation text, and signature as well as translated sections. Verify a rendered sample visually and inspect embedded fonts, not just page count.

Prescriptions must always generate as a single A4 page. Adjust typography, margins, table padding, section spacing, and signature sizing together according to content volume rather than creating a second page.

Do not trust content-length estimates alone for prescription pagination. Render the PDF, inspect its actual page count, and progressively reduce the whole-document fit until the generated file contains exactly one A4 page.

If the renderer still returns multiple pages, impose those rendered pages proportionally onto one final A4 page. On Android, send this final PDF through the native share/print sheet; browser HTML printing does not reliably honor CSS scaling.

**Why:** The user confirmed this approach to avoid browser and Android print-layout differences while minimizing storage and keeping PDF text searchable and selectable.

**How to apply:** Reuse data-driven document builders for print, download, and native file sharing. Pass the active preview format and language into the builder, use script-specific bundled fonts, verify actual output pagination, keep database records as the source of truth, and treat generated PDF files as temporary client-side artifacts.

Browser PDF viewers loaded from Blob URLs can become cross-origin inside the Replit preview, so the app must not call `print()` through a hidden PDF iframe. Use the page's print layout with `window.print()` for popup-free printing and provide a separate direct-download action for saving the generated PDF.