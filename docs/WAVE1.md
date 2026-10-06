# Desert Deal — Wave 1 contract

Playable solo Klondike in the desert paper look. Static site. No build step. No server required.

## Done-when checklist

### 0. Scaffold — **done**
- [x] Private repo `CosmicCEO/desertdeal`
- [x] README + `docs/RULES.md` + `docs/DESIGN.md` + `docs/WAVE1.md` + `docs/PITCH.md`
- [x] Local pitch sheet (HTML/PDF/PNG under `/workspace/desertdeal/pitch/`; not committed)

### 1. Card art system
- [ ] 52 faces + card backs as layered HTML/SVG (or generated assets)
- [ ] Defect overlays (scuff, coffee, dog-ear, sun-bleach, crease) seeded by card id
- [ ] Deal animation onto kraft table

### 2. Physics input
- [ ] Drag cards; fling with inertia; snap to legal pile or bounce back
- [ ] Stock/waste flip with a short rotation
- [ ] Reduced-motion path

### 3. Full Klondike
- [ ] Deal, Draw 3 (default) + Draw 1 option
- [ ] Tableau / foundation / stock / waste rules per `docs/RULES.md`
- [ ] Win detect, New game, undo last move
- [ ] Live score + timer

### 4. Save + stats
- [ ] Autosave / resume mid-game (`localStorage`)
- [ ] Plays count, high score, best time on home screen

### 5. Polish
- [ ] Web Audio card slap / shuffle (synth, sibling style)
- [ ] Sound bar (iOS-friendly), mute/volume persisted
- [ ] Mobile-first (~390px), tap targets ≥ 44px
- [ ] About page (Jerod / CosmicCEO; desert-family nod)

## Layout (planned)
```
desertdeal/          deployable static folder
  index.html about.html
  assets/css/ assets/js/ assets/img/ assets/fonts/
docs/                rules, design, wave contract, pitch text
dev/                 later: simple checks / screenshot helpers
```

## Non-goals for Wave 1
PHP/MySQL, online rooms, accounts, Matter.js unless CSS physics fails, Dust Storm mechanic, committing binary pitch art.
