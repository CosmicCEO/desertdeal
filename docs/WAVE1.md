# Desert Deal — Wave 1 contract

Playable solo Klondike on a worn picnic-table look. Static site. No build step. No server required.
**Targets:** phone-portrait layout on all devices; Mac/desktop scales that board with the window. Pointer (mouse + touch).

## Done-when checklist

### 0. Scaffold — **done**
- [x] Private repo `CosmicCEO/desertdeal`
- [x] README + `docs/RULES.md` + `docs/DESIGN.md` + `docs/WAVE1.md` + `docs/PITCH.md`
- [x] Local pitch sheet (HTML/PDF/PNG under `/workspace/desertdeal/pitch/`; not committed)

### 1. Card art + table — **in progress (this push)**
- [x] 52 faces + card backs as layered HTML/CSS (defects seeded by card id)
- [x] Defect overlays (scuff, coffee, dog-ear, sun-bleach, crease)
- [x] Picnic table: weathered planks, grain/knots, silver-grey bleach, dark gaps, flush bolt heads
- [x] Deal animation onto the table
- [x] Optional ants (CSS wander)

### 2. Physics input — **in progress (this push)**
- [x] Drag cards/stacks; fling with inertia; snap to legal pile or bounce back
- [x] Stock/waste flip with a short rotation (scale-X)
- [x] Reduced-motion path

### 3. Full Klondike — **done** (tap-to-move + drag)
- [x] Deal, Draw 3 (default) + Draw 1 option
- [x] Tableau / foundation / stock / waste moves (basic validation)
- [x] Win detect, New game
- [x] Undo (header button; steps back through moves)
- [x] Live score + timer (Microsoft-style scoring hooks; polish TBD)

### 4. Save + stats — **done**
- [x] Autosave / resume mid-game (`localStorage` `deal_save`)
- [x] Plays count, high score, best time on home

### 5. Polish — **in progress**
- [x] Card sounds: recorded Kenney CC0 clips (synth removed)
- [x] Desert Ranger ambience bed + random radio chatter every 45-90 s
- [x] First-tap unlock (non-blocking hint), mute/volume persisted
- [x] Phone layout everywhere; Mac scales board with window; tap targets ≥ 44px on chrome
- [x] About screen (Jerod / CosmicCEO; desert-family nod)

## Layout
```
index.html           home + play + about
assets/css/game.css  picnic table, cards, responsive
assets/js/cards.js   deck + defects
assets/js/physics.js drag / fling / snap
assets/js/game.js    Klondike deal + moves
assets/img/          picnic-table.svg (pitch reference)
assets/fonts/        optional local sibling fonts (gitignored)
docs/                rules, design, wave contract, pitch text
```

## Non-goals for Wave 1
PHP/MySQL, online rooms, accounts, Matter.js unless CSS physics fails, Dust Storm mechanic, committing binary pitch art, embedding paid stock photos.

## Verification
`dev/test_play.py` (Playwright, headless Chromium) plays seed 43 to a win at 390x844 (touch) and 1440x900 (mouse) through real taps and drags, checking `window.__dd.state()` after every move, plus illegal drop/tap, undo, reload + Resume, stats. Run it before every push.
