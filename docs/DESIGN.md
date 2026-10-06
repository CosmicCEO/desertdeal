# Desert Deal — design

Sibling of **Desert Ranger** and **Desert Bandit**: desert palette, ink outlines, tape accents. Solo Klondike instead of rooms/reels.

## Platforms (locked)
- **One layout everywhere:** the phone-portrait Klondike board (design size **390×620**, cards 48×68) is used on iPhone *and* Mac/desktop.
- **Uniform scale:** `transform: scale(...)` on `#table-scale` fits that board to the available stage (width and height). Cards and picnic table grow/shrink together — no separate wide desktop arrangement.
- Pointer events for mouse + touch; drag math divides by the live scale so hit-tests stay correct after scaling. `viewport-fit=cover` + safe-area insets for notch/home bar.

## Look
| Token | Hex |
|---|---|
| cream | `#F4ECD8` |
| paper | `#fffaf0` |
| ink | `#3A2A1E` |
| terra | `#C3623B` |
| mari | `#E9A23B` |
| sage | `#7E9168` |
| kraft | `#b78a52` |
| sand | `#E8D7B4` |

Fonts (same as siblings): **Bungee**, **Nunito**, **Caveat**, **Bangers**. Loaded via Google Fonts in `index.html`; optional local copies under `assets/fonts/` (same files as Ranger/Bandit pitch). No casino plastic blues or glossy vinyl.

Shared UI bits borrowed from Bandit/Ranger: paper cards with kraft tape, ink drop-shadow buttons, cream radial wash background, Bungee title + Caveat tagline.

## Play surface — worn wooden picnic table
Original art only (stock photos are reference, never embedded).
- **Weathered horizontal planks** with visible grain and knots (CSS planks in `game.css`; pitch SVG reference in `assets/img/picnic-table.svg`)
- **Silver-grey sun bleach** washes on the boards
- **Dark gaps** between planks
- **Flush dark circular bolt/nail heads** along each board (not shiny chrome)
- **Tiny ants** that occasionally wander (CSS keyframe loops)

## Cards = paper + defects
Each card is stacked layers, not one flat PNG:
1. **Face or back** (cream paper, ink pips/ranks; kraft/tape back).
2. **Reusable defect overlays** (SVG/CSS), seeded by card id so Ace♠ always has the same coffee ring:
   - scuffs / edge wear
   - coffee stain
   - dog-ear / clipped corner
   - sun-bleach wash
   - faint crease

Defects are separate layers so they can be mixed and reused. Slight irregular border-radius / wobble per card.

## Physics (CSS/JS first)
- Pointer drag with offset under the finger.
- On release: use **velocity** to fling; cards ease into a legal slot or **bounce back** if illegal.
- Stock flip: short scale-X flip — not an instant texture swap.
- Prefer zero deps. Add **Matter.js** only if fling/collide feel needs real bodies.
- Respect `prefers-reduced-motion` (short fades, no fling).

## Sound
Recorded clips only — the old Web Audio synth (card blips + synthesized radio hiss) is gone. Sources and edits: `assets/audio/CREDITS.md`.
- **Cards:** Kenney *Casino Audio* (CC0): deal, place, flip, bounce, shuffle, win fan. Short (≤ 0.5 s, shuffle 1.6 s) and quiet.
- **Radio + ambience (Desert Ranger):** the Ranger desert bed loops quietly; every 45-90 s a random Dispatch / R55 / R273 exchange plays with Ranger's own key-up click and squelch. Nothing re-voiced or synthesized.
- **Unlock:** silent until the first tap anywhere (iOS rule). The "Sound starts after your first tap" hint is `position: fixed` and `pointer-events: none` — it never moves the layout and never blocks a tap.
- **Controls:** ♪ in the play header → mute + volume (`deal_mute`, `deal_vol`).
- **iPhone silent switch:** Web Audio on iOS follows the ring/silent switch; we also request `navigator.audioSession.type = 'ambient'` where Safari supports it. Audio suspends when the tab is hidden.

## Input (fixed after Wave 1 playtest)
- **Tap-to-move** (primary on iPhone): tap a face-up card → it (and the cards on it) goes to the best legal spot: its foundation, else the first non-empty tableau column it fits, else an empty column (Kings). Tap the stock to draw / recycle.
- **Drag / fling:** drag starts after 6 px; drop target = the legal pile the card overlaps most; a quick flick toward a pile also lands; anything else bounces home.
- All input is pointer events on the scaled board. No `click` handlers on the table (a click is lost if anything shifts between press and release).
- Layout is computed in unscaled board px from `offsetLeft/offsetTop`; pointer → board px divides by the live scale.
- Undo steps back through moves (button in the header). Autosave after every move (`deal_save`); Home offers **Resume**.

## Save & stats
`localStorage` keys (names TBD in Wave 1 code), e.g.:
- `deal_save` — full mid-game snapshot + schema version (v1): written after every move, cleared on a win
- `deal_plays` (+1 per new deal, not on resume), `deal_highScore`, `deal_bestTimeMs` (completed games only)
- `deal_mute`, `deal_vol`

Autosave after every successful move. Resume on home screen. Optional later: tiny PHP stats ping for a global plays counter (out of scope for Wave 1).

## Flavor (fiction)
A pack left in **R273’s** truck / dealt on a desert picnic table — story seasoning only. This title is **Jerod Price / CosmicCEO**; no claim on Jeffery’s board art beyond the shared desert family palette and fonts.

## Out of scope for Wave 1
Accounts, multiplayer, PHP/MySQL, Matter.js, Dust Storm rule twist, real-money anything, shipping pitch PDF in git, embedding paid stock photos.
