## Learnings
- Bun's `import.meta.dir` needs a local `ImportMeta` declaration/augmentation in TS to satisfy typechecking.
- Embedding the logo via base64 works cleanly in the HTML template without changing report behavior.
- A minimal OTLP JSONL fixture is enough to verify the web report path and confirm the header image is emitted.
- Final QA confirms the web report emits exactly one embedded PNG data URI and places the `<img>` immediately before the Tawny `<h1>` header.
- Final QA confirms `assets/logo.png` is 128×128 at 12K and `package.json` includes `assets` in the published files list.
- `bunx tsc --noEmit` still reports only the known pre-existing errors in `src/component/service-filter.tsx` and `src/context/filter.tsx`, with no new `src/web.ts` errors.
