# Desktop shell

A thin Electron shell around the existing local server. The CLI remains the core; the shell only starts `src/cli.ts review` and points a window at it.

```bash
pnpm desktop        # run from source
pnpm desktop:pack   # unpacked app in desktop-dist/
pnpm desktop:build:mac  # macOS app + unsigned dmg (electron-builder --dir + hdiutil)
pnpm desktop:build:win  # Windows NSIS; build this on Windows
```

The packaged app stores its data under Electron's `userData` directory (`data/` and `packs/`), not inside the app bundle. The first launch can take 30–60 seconds because the shell starts the TypeScript source through `tsx`; a splash window stays open until the local server is ready. If port 4317 is busy, the app automatically tries 4318–4349.

Notes:

- No code signing or Apple notarization is configured; local macOS builds need the usual right-click → Open for an unsigned app.
- A Windows installer should be built on Windows or in a Windows CI runner; cross-building NSIS from macOS is not guaranteed. `pnpm desktop:build:win` is configured, but the actual Windows build was not produced on this Mac.
- The app currently bundles the TypeScript source and runs it through `tsx` to keep the shell small to maintain. This makes the app directory larger than a native binary; a bundled server build can replace it later.
