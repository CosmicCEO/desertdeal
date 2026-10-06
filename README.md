# Desert Deal

A single-player Klondike solitaire with a worn paper deck, card physics, and local save/stats — dealt on a **worn wooden picnic table** in the Anza-Borrego desert family of [Desert Ranger](https://github.com/CosmicCEO/desertranger) and [Desert Bandit](https://github.com/CosmicCEO/desertbandit).

Flavor: a dog-eared 52-card pack on weathered planks (grain, knots, sun bleach, flush bolt heads). Coffee stains, clipped corners. Drag, fling, flip. Pause mid-deal and pick it up later.

**Status:** scaffold (docs + pitch). Playable Wave 1 not started yet.

## Docs
| Path | What |
|---|---|
| [`docs/RULES.md`](docs/RULES.md) | Classic Klondike rules, scoring, stats |
| [`docs/DESIGN.md`](docs/DESIGN.md) | Picnic table, card defects, physics, save plan |
| [`docs/WAVE1.md`](docs/WAVE1.md) | Wave 1 done-when contract |
| [`docs/PITCH.md`](docs/PITCH.md) | One-pager text (matches the pitch sheet) |

## Stack (MVP)
Static HTML + CSS + vanilla JS. No build step. No PHP/MySQL on day one. Stats and mid-game save live in `localStorage`. Fonts match the siblings (Bungee, Nunito, Caveat, Bangers). Original picnic-table art only — no paid stock embeds.

## Run locally (once the client lands)
```bash
# from the deploy folder (planned: desertdeal/)
python3 -m http.server 8899
# open http://127.0.0.1:8899/
```

## Rights
© 2026 Jerod Price / CosmicCEO. All rights reserved. Sibling fonts may be linked from Desert Ranger for local builds; this game’s card faces, defect layers, and picnic-table art are original to Desert Deal.
