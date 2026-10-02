---
name: Workspace package installation
description: Package-install callback limitations when targeting a pnpm workspace package.
---

Do not pass pnpm CLI flags as package names to the package-install callback, and do not assume a failed callback installed the dependency.

**Why:** In this workspace, the callback's default install runs at the pnpm workspace root, which pnpm rejects without explicit root approval. The callback also rejects workspace-filter flags as invalid package tokens. A failed call may still report that the language runtime was installed.

**How to apply:** Check the success result, not just runtime installation messages. Prefer an existing dependency or a supported workspace-targeted installation method; never add unintended root dependencies or bypass the package firewall.