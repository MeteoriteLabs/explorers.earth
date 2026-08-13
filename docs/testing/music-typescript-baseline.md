# Music TypeScript baseline — pre-change

Captured before C0 implementation on 2026-08-13 using Node v24.14.0:

```text
npm run check --prefix tunes
```

The normalized baseline is **245 diagnostics in 26 files** (exit 2). It is an
existing regression baseline, not an acceptance of new diagnostics. The
dominant sources are TanStack Query typing, legacy routes/storage implicit
types, dashboard/playlist response types, and stale schema-field references.
The regression gate is `npm run check --prefix tunes`; prove it detects a
deliberate diagnostic in an isolated change, then remove that change before
commit. Explorers' `tsc -b` could not be run through the root resolver in this
checkout (`npx` reported TypeScript unavailable); that setup defect is recorded
as a preflight concern, not hidden.
