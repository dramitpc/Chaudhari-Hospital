---
name: Consultation workflow
description: Patient consultations can be interrupted by investigations while the doctor sees other patients.
---

The user described this workflow: first call a patient for history taking and differential diagnosis, advise X-rays or investigations if necessary, see another patient while the first gets investigations, then recall the first patient for prescription and visit completion.

**Why:** Elapsed time between the first call and visit completion includes investigation waits and overstates the doctor's active consultation time.

**How to apply:** When proposing consultation timing or queue changes, support multiple active sessions per visit and distinguish doctor-attended time from the patient's total elapsed visit time.

The user approved active pause/resume timing and queue estimates that include returning patients. Do not reinterpret older elapsed-only records as active time, and do not restart the doctor's timer just because investigation results are ready.

**Why:** Old records cannot reveal how much of the elapsed visit was investigation waiting. Results readiness is not evidence that the doctor has begun reviewing the patient.

**How to apply:** Keep elapsed and active metrics separate. Start timing only on an explicit Start/Resume action, stop it on pause or clinical completion, and keep at most one running patient per doctor when switching patients. Calling the next patient must not automatically complete the previous patient's visit.