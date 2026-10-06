# Desert Deal

A single-player Klondike solitaire with a worn paper deck, card physics, and local save/stats — dealt on a **worn wooden picnic table** in the Anza-Borrego desert family of [Desert Ranger](https://github.com/CosmicCEO/desertranger) and [Desert Bandit](https://github.com/CosmicCEO/desertbandit).

Flavor: a dog-eared 52-card pack on weathered planks (grain, knots, sun bleach, flush bolt heads). Coffee stains, clipped corners. Drag, fling, flip. Pause mid-deal and pick it up later.

**Status:** Wave 1 playable scaffold — cards, picnic table, drag/fling physics, Klondike deal + stock flip + basic moves. Save/undo/sound still TODO.

**Designed for desktop and iPhone** (portrait-first phone layout; landscape desktop table).

## Docs
| Path | What |
|---|---|
| [`docs/RULES.md`](docs/RULES.md) | Classic Klondike rules, scoring, stats |
| [`docs/DESIGN.md`](docs/DESIGN.md) | Picnic table, card defects, physics, responsive targets |
| [`docs/WAVE1.md`](docs/WAVE1.md) | Wave 1 done-when contract |
| [`docs/PITCH.md`](docs/PITCH.md) | One-pager text (matches the pitch sheet) |

## Stack (MVP)
Static HTML + CSS + vanilla JS. No build step. No PHP/MySQL on day one. Stats and mid-game save live in `localStorage`. Fonts match the siblings (Bungee, Nunito, Caveat, Bangers) via Google Fonts; optional local copies from Ranger/Bandit. Original picnic-table art only — no paid stock embeds.

## Run locally
```bash
cd /path/to/desertdeal   # repo root (index.html here)
python3 -m http.server 8899
# open http://127.0.0.1:8899/
# or http://127.0.0.1:8899/?play=1 to skip home
```

## Rights
© 2026 Jerod Price / CosmicCEO. All rights reserved. Sibling fonts may be linked from Desert Ranger for local builds; this game’s card faces, defect layers, and picnic-table art are original to Desert Deal.
