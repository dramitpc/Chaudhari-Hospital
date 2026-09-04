---
name: On-demand clinical PDFs
description: Confirmed policy for generating prescription, receipt, and future clinical document PDFs.
---

Generate prescription and billing PDFs on demand from structured application data. Do not create PDFs from screenshots or permanently store routine generated copies. Archive a PDF only when a legally immutable document copy is explicitly required.

**Why:** The user confirmed this approach to avoid browser and Android print-layout differences while minimizing storage and keeping PDF text searchable and selectable.

**How to apply:** Reuse data-driven document builders for print, download, and native file sharing. Keep the database records as the source of truth and treat generated PDF files as temporary client-side artifacts.