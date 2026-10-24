# 0007 Traceability tags and evidence rules

Date: 2026-09-27

**Decision:** Every test carries `@REQ-XXX-NN` tags from `tests/requirements.ts`. CI fails if a requirement has no passing test or check, a tag is unknown, or a test has no tag. A check only counts if it examined a non-empty, expected set (all 5 device profiles present, Lighthouse runs for both pages, links checked, HTML scanned).

**Why:** A matrix is only evidence if it cannot be satisfied by tests that ran nothing.

**Consequences:** The builder is itself unit and mutation tested.
