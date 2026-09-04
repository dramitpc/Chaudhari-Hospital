---
name: On-demand clinical PDFs
description: Confirmed policy for generating prescription, receipt, and future clinical document PDFs.
---

Generate prescription and billing PDFs on demand from structured application data. Do not create PDFs from screenshots or permanently store routine generated copies. Archive a PDF only when a legally immutable document copy is explicitly required.

Generated documents must preserve the corresponding screen preview's hierarchy and format controls. Multilingual prescriptions must use bundled local Unicode fonts, retain translated/bilingual display modes, and remain usable without an internet font service. Payment receipts remain English-only and use the established receipt layout.

**Why:** The user confirmed this approach to avoid browser and Android print-layout differences while minimizing storage and keeping PDF text searchable and selectable.

**How to apply:** Reuse data-driven document builders for print, download, and native file sharing. Pass the active preview format and language into the builder, use script-specific bundled fonts, keep database records as the source of truth, and treat generated PDF files as temporary client-side artifacts.