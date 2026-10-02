---
name: Clinic date alignment
description: Queue actions and tests must preserve the displayed queue date across browser and clinic timezones.
---

Queue mutations must use the date of the queue being viewed, rather than independently inferring the date from the browser or server.

**Why:** Around clinic midnight, a UTC browser and the clinic's local timezone can fall on different calendar days. A visible waiting patient can then be missed by Call Next even though the queue display is correct.

**How to apply:** Pass the selected queue date through date-scoped actions. In browser tests, use the displayed date explicitly and test this mismatch without changing real patient records. Do not assume the tester's timezone matches the clinic's timezone.