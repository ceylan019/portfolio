# 0003 Mutation testing covers src/lib only

Date: 2026-09-27

**Decision:** Stryker mutates the pure modules in `src/lib`, with a break threshold of 90 and `ignoreStatic` set to false, so module level constants (including the gate regexes themselves) are mutated too, not just code inside functions.

**Why:** That is where the rules live: certification expiry, traceability, the deploy gates. Templates and browser tests are too slow to rerun per mutant and would say little. Leaving static values unmutated would have left the gate's own regexes unmeasured.

**Consequences:** `/quality` says "mutation-tested business logic", never "mutation-tested site". The installed `@stryker-mutator/vitest-runner` 10.0.0 joins nested test names with a space, while Vitest 5 matches them joined with " > ", so it silently skipped every test inside a `describe` block. It is patched with `pnpm patch` until a released runner fixes this; see the runbook for how and when to remove that patch.
