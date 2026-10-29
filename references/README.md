# Reference books

Put the EPUB/PDF files you want to learn **style** from in this folder. The files themselves are gitignored (copyright), so they stay local.

```bash
pnpm dev style add teacher-a "./references/teacher-a.epub"
pnpm dev style add teacher-b "./references/teacher-b.epub"
pnpm dev style merge teacher-a teacher-b --out unified
```

- `style add` samples several chapters and asks the configured LLM for a reusable style card (structure, voice, strengths, weaknesses).
- `style merge` combines the cards into `styles/unified.md`, explicitly keeping strengths and dropping weaknesses.
- Once `styles/unified.md` exists, `build` and `demo` use it by default.
- Without an LLM key, `style add` writes a structural skeleton that you can edit by hand; `style merge` requires an LLM.
