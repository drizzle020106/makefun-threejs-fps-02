# Build transcript — Dustline Protocol (threejs-fps-02)

**Date:** 2026-11-15
**Built by:** Muse (AI agent) for Amy (GitHub: drizzle020106, make.fun: drizzle020106)
**Bounty:** make.fun "Make the best three.js tactical FPS", slug threejs-fps-02, harness program/v1. Entry fee $0.00 (verified via make.fun API by the parent agent). Prizes ranked, top 10 share $1,000 (1st $400); outside the paid places an entry earns nothing. Entries close 2026-11-17 05:30 CST; 4,941 entries at build time.

## What happened, in order

1. Read the free_coding_bounty_entry skill and followed it: fee/deadline/prize structure recorded before building; no repo created, nothing submitted, nothing signed, no wallet or seed phrase used at any point.
2. Checked the environment: Node v24.22.1, npm reachable, headless Chrome available at /opt/meta-chromium/chrome. No make.fun harness kit file exists anywhere in the workspace (searched for makefun-threejs / kit files — none found), so `vendor/makefun-threejs.ts` was created as a clearly-documented STUB. This is a blocker the parent must resolve from the official kit before submission.
3. Downloaded three.js 0.187.0 from unpkg (build/three.module.js, 658,900 bytes; build/three.core.js, 1,474,799 bytes; REVISION '187' confirmed in the file) and vendored both under `game/vendor/`. The game imports `three.module.js` as an ES module; no CDN and no network request at runtime.
4. Built the game in `game/`: `index.html` (page, HUD, menus), `game.js` (full engine: pointer-lock FPS controls, hitscan shooting with tracers, bot AI with waypoints/line-of-sight/strafing, rounds, economy, buy menu, capture objective, HUD, pause/restart, synthesized WebAudio sounds), `config.js` (this entry's map seed 20261117, desert palette, Vanguard vs Ember, "Dustline Protocol").
5. Wrote `main.ts` at the repo root: a Node program that validates the required files and serves `game/` on localhost (default port 8123), with a `--check` validation-only mode.
6. Wrote README.md from the official make.fun template (badges point at the threejs-fps-02 bounty page), MIT LICENSE, DOSSIER.md and dossier.json.
7. Validated (see Validation section below) and took screenshots with headless Chrome: `screenshots/cover.png` (menu) and `screenshots/gameplay.png` (demo autopilot mode `?demo=1`).
8. Built the sibling entry threejs-fps-01 ("Emberline Yard") from the same engine with a different config (seed, palette, team names, map name) so the two entries are not byte-identical.

## Validation performed

- `node main.ts --check` — all required files present.
- `node --check` on `game/game.js` and `game/config.js` (as ES modules) — syntax OK.
- Served with `node main.ts` and loaded `game/index.html` in headless Chrome; page carries a runtime-error trap that writes any error into the document title, and the title stayed clean.
- Screenshots taken in headless Chrome at 1280×720 for both the menu and the `?demo=1` autopilot gameplay view.

## Post-build fixes and final validation (same session, 2026-11-15 ~12:40–12:50 CST)

- **WASD movement was inverted in the first draft** (W walked backward). Caught on code re-read, fixed with the correct forward/right vector math, re-checked with `node --check`.
- **Dead bots stayed in the raycast list** and their invisible corpses would have blocked bullets. Fixed: `kill()` now removes the bot's meshes from `SHOOTABLES`.
- **Headless screenshots:** the VM's bundled Chromium (/opt/meta-chromium) refuses to start headless (needs a Hatch WebGL domain policy), and `npx playwright install chromium` failed three times (download failure in its wrapper). Downloaded the same Chromium build directly with curl (180 MB, worked), extracted it to scratch, and used it only for screenshots. That scratch directory was deleted afterwards.
- **WebGL in headless needed SwiftShader:** with `--disable-gpu` the page reported `GAME_ERROR: THREE.WebGLRenderer: Error creating WebGL context` (caught by the page's error trap). With `--use-angle=swiftshader --enable-unsafe-swiftshader` the game booted cleanly (title stayed `Dustline Protocol — Tactical FPS`, no GAME_ERROR) and both menu and `?demo=1` screenshots rendered the real 3D scene.
- **Screenshot review found a UX bug:** the floating team-name label at spawn filled the demo camera's view. Removed the spawn labels, shrank the site labels, and shrank the gun viewmodel slightly; re-took all four screenshots and visually confirmed both gameplay shots.
- **Final checks, all passing:** `node main.ts --check` exit 0 in both folders (13/13 required files); `node main.ts` actually served `index.html` and `three.module.js` with HTTP 200; `dossier.json` parses in both; grep confirms no `fetch`/`XMLHttpRequest`/http(s) URLs in any game file (runtime is fully offline; the only URLs are the make.fun badge links in README.md, which are not loaded by the game).
- **Not validated:** a human play-through with pointer-lock mouse-look in a real desktop Chrome (headless can't do pointer lock). The `?demo=1` autopilot exercises the same movement/AI/shooting/capture/round code, but recommend one real play-through before submitting.

- Pointer-lock mouse-look play was not exercised in headless Chrome (pointer lock needs a real user gesture in a real browser). The `?demo=1` autopilot path exercises the same movement, bot AI, shooting, capture and round code, but a human play-through in desktop Chrome is still recommended before submitting.
- The kit file is a stub (see above) — the entry must not be submitted until the official `vendor/makefun-threejs.ts` replaces it.
- Nothing was submitted: no GitHub repo exists yet for this entry, no make.fun submission was made, and no wallet signature was involved. Submission needs Amy to create the repo (name `makefun-threejs-fps-02`), set About (description/homepage/topics as in the parent task), and sign in her own browser wallet.
