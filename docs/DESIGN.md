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
Web Audio synth in `assets/js/sound.js` (Bandit-style — **no sample files**, no third-party voice IP).
- **Card SFX:** slap, snap, bounce, flip, deal ticks, shuffle, win chime.
- **Radio bed:** quiet filtered hiss + occasional key-up click, scratchy band-limited “chatter” burble, squelch (Dispatch–R55 *flavor*, synthesized — not Ranger voice lines).
- **Controls:** home/play sound bar to unlock (iOS gesture), ♪ panel with mute + volume (`deal_mute` / `deal_vol` in `localStorage`).
- **iPhone silent switch:** not readable from the web; users mute in-app or via the OS switch (Safari may still play depending on settings).

## Save & stats
`localStorage` keys (names TBD in Wave 1 code), e.g.:
- `deal_save` — full mid-game snapshot + schema version (**TODO**)
- `deal_plays`, `deal_highScore`, `deal_bestTimeMs` — partially wired
- mute / volume (**TODO**)

Autosave after every successful move. Resume on home screen. Optional later: tiny PHP stats ping for a global plays counter (out of scope for Wave 1).

## Flavor (fiction)
A pack left in **R273’s** truck / dealt on a desert picnic table — story seasoning only. This title is **Jerod Price / CosmicCEO**; no claim on Jeffery’s board art beyond the shared desert family palette and fonts.

## Out of scope for Wave 1
Accounts, multiplayer, PHP/MySQL, Matter.js, Dust Storm rule twist, real-money anything, shipping pitch PDF in git, embedding paid stock photos.
