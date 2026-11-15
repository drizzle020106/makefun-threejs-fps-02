# Dossier — Dustline Protocol (threejs-fps-02)

**Entry title:** Tactical FPS — Dustline Protocol
**Bounty:** Make the best three.js tactical FPS (threejs-fps-02) — $1,000 in USDC shared by the top 10 entries (1st $400). Ranked by an AI judge comparing entries pairwise on screenshots + source.
**Entry fee:** $0.00. Ranked prizes only — outside the paid places an entry earns nothing.
**Entries close:** 2026-11-17 05:30 CST (Nov 16 21:30 UTC). 4,941 entries at build time — a very crowded field.
**Harness:** program/v1. Entry point: `main.ts` (Node 22+) at repo root.

## The game

**Dustline Protocol** is a round-based tactical FPS in the style Counter-Strike made famous — never a copy: original map, art, sounds and names. Single-player against bots, runs in a desktop browser from static files, no build step, no network request at runtime.

- **Map:** an 80×80 m desert industrial yard — perimeter walls, a mid wall with two gaps, seeded crate cover, and two capture sites (Site A north-east, Site B south-east). The crate layout is seeded (seed 20261117), so this entry's map differs from the sibling Emberline Yard entry.
- **Teams:** Vanguard (you + 2 bot teammates, blue) vs Ember (3 bots, red).
- **Rounds:** first to 5 round wins (max 9 rounds), 100 seconds per round. A round is won by eliminating the enemy team, by capturing the active site, or by the defenders holding until time expires. Attack/defence alternates each round; the active site alternates A/B.
- **Objective:** stand inside the active site's ring uncontested for 6 seconds to capture it. A defender inside the ring stalls and reverses the capture.
- **Economy:** start with $800. Kill +$300, round win +$325, round loss +$190. Money buys weapons between rounds.
- **Buy menu (B, 18 s between rounds):** P2000 Sidearm (free, 26 dmg), Hornet SMG ($600, 22 dmg, fast), Longbow Rifle ($2,700, 34 dmg), Deadeye Sniper ($4,750, 88 dmg, right-click scope zoom), Kevlar Vest ($650, +50 armor).
- **Bots:** move between waypoints, bias toward the active site when attacking, take cover in strafing duels, check line of sight before firing, and shoot with distance-based accuracy. Health bars float above them.
- **Feel:** pointer-lock mouse look, WASD + Shift sprint, click/hold to shoot (hitscan with tracers), recoil, muzzle flash, reload (R), weapon switch (1–4), hitmarkers, killfeed, damage vignette, synthesized WebAudio gunfire (no audio files), HUD (health/armor, money, ammo, timer, round score, alive counts), pause (P/Esc), restart, match-end screen.
- **Demo mode:** open `?demo=1` for an autopilot third-person view (used for the gameplay screenshot).

## Controls

| Input | Action |
|---|---|
| WASD | Move |
| Mouse | Aim (pointer lock) |
| Left click | Shoot (hold for automatic weapons) |
| R | Reload |
| 1–4 | Switch weapon |
| B | Buy menu |
| Shift | Sprint |
| Right click | Sniper scope zoom |
| P / Esc | Pause |
| Enter | Deploy from the menu |

## Run it

```sh
node main.ts          # validates files, serves game/ at http://localhost:8123
node main.ts --check  # validate only
```

Or serve `game/` with any static server (`npx serve game`). Open in desktop Chrome.

## Tech

- three.js **0.187.0**, vendored locally under `game/vendor/` (`three.module.js` + `three.core.js`, downloaded from npm/unpkg 2026-11-15). No CDN, no network at runtime.
- ES modules loaded directly by the browser; no bundler, no build step.
- `vendor/makefun-threejs.ts` is a **clearly-marked STUB** — the official make.fun harness kit file was not available to this build session. It must be replaced with the official kit file unchanged before submission (see the file itself and the blockers below).
- `main.ts` is a small Node program (static server + file validation), not a game build step.

## Files

- `main.ts` — entry point: validate + serve
- `game/index.html` — page, HUD, menus
- `game/game.js` — the whole game (engine, AI, rounds, economy)
- `game/config.js` — this entry's map seed, colours, team names
- `game/vendor/three.module.js`, `game/vendor/three.core.js` — three.js 0.187.0
- `vendor/makefun-threejs.ts` — STUB (see above)
- `screenshots/cover.png`, `screenshots/gameplay.png`
- `DOSSIER.md`, `dossier.json`, `README.md`, `LICENSE`, `TRANSCRIPT.md`

## Blockers / honest notes

1. **Kit file is a stub.** `vendor/makefun-threejs.ts` is NOT the official kit file. Replace it from the official make.fun harness kit before submitting.
2. **Very crowded bounty.** 4,941 entries for threejs-fps-02; the sibling phase (threejs-fps-01) had 0 entries at build time and closes a week later — it is the better-value entry.
3. **Not yet submitted.** No GitHub repo created, nothing submitted on make.fun, nothing signed. Submission still needs Amy to create the repo, set About/topics, and sign in her own wallet (signing cannot be delegated).
4. **Validation done locally:** `node main.ts --check`, `node --check` on the JS modules, headless-Chrome load of `index.html` and `?demo=1` with a runtime-error trap in the page title, and real screenshots (see TRANSCRIPT.md). Pointer-lock mouse-look gameplay was not exercised in headless Chrome (pointer lock needs a real user gesture); the demo autopilot path exercises the same movement, AI, shooting and round code.
