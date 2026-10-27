# Desert Deal

<p align="center"><em>A card game in the desert-ranger theme, now playable on any phone.</em></p>

<p align="center"><strong><a href="https://www.jprice.net/desertdeal/">Play Desert Deal</a></strong> &nbsp;·&nbsp; <a href="https://www.jprice.net/desertdeal/about.html">About the game</a></p>

<br>

A single-player Klondike solitaire with a worn paper deck, card physics, and local save/stats — dealt on a **worn wooden picnic table** in the Anza-Borrego desert family of [Desert Ranger](https://github.com/CosmicCEO/desertranger) and [Desert Bandit](https://github.com/CosmicCEO/desertbandit).

Flavor: a dog-eared 52-card pack on weathered planks (grain, knots, sun bleach, flush bolt heads). Coffee stains, clipped corners. Drag, fling, flip. Pause mid-deal and pick it up later.

**Status:** Wave 1 playable — tap-to-move + drag/fling, full Klondike (Draw 3 / Draw 1), undo, autosave/resume, stats, Kenney CC0 card sounds + Desert Ranger radio chatter. Verified end-to-end with `dev/test_play.py`.

**Phone portrait layout on every device** — Mac/desktop scales the same board with the window.

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
# or http://127.0.0.1:8899/?play=1 to skip home (resumes a saved deal), ?seed=43&draw=1 for a fixed deal
```

## Test (play a full game in a real browser)
```bash
python3 -m http.server 8899 &              # repo root
pip install playwright && playwright install chromium
python3 dev/test_play.py                   # phone 390x844 touch + desktop 1440x900 mouse; exit 0 = pass
```

## Rights
© 2026 Jerod Price / CosmicCEO. All rights reserved. Sibling fonts may be linked from Desert Ranger for local builds; this game’s card faces, defect layers, and picnic-table art are original to Desert Deal.
