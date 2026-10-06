# Desert Deal — design

Sibling of **Desert Ranger** and **Desert Bandit**: desert palette, ink outlines, tape accents. Solo Klondike instead of rooms/reels.

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

Fonts (same as siblings): **Bungee**, **Nunito**, **Caveat**, **Bangers**. No casino plastic blues or glossy vinyl.

## Play surface — worn wooden picnic table
Original art only (stock photos are reference, never embedded).
- **Weathered horizontal planks** with visible grain and knots
- **Silver-grey sun bleach** washes on the boards
- **Dark gaps** between planks
- **Flush dark circular bolt/nail heads** along each board (not shiny chrome)
- **Optional tiny ants** walking on the wood (static on the pitch; occasional wander in-game later)

## Cards = paper + defects
Each card is stacked layers, not one flat PNG:
1. **Face or back** (cream paper, ink pips/ranks; kraft/tape back).
2. **Reusable defect overlays** (SVG/CSS), seeded by card id so Ace♠ always has the same coffee ring:
   - scuffs / edge wear
   - coffee stain
   - dog-ear / clipped corner
   - sun-bleach wash
   - faint crease

Defects are separate assets so they can be mixed and reused. Slight irregular border-radius / wobble per card.

## Physics (CSS/JS first)
- Pointer drag with offset under the finger.
- On release: use **velocity** to fling; cards ease into a legal slot or **bounce back** if illegal.
- Stock flip: short 3D `rotateY` (or 2D scale-X flip) — not an instant texture swap.
- Prefer zero deps. Add **Matter.js** only if fling/collide feel needs real bodies.
- Respect `prefers-reduced-motion` (short fades, no fling).

## Save & stats
`localStorage` keys (names TBD in Wave 1 code), e.g.:
- `deal_save` — full mid-game snapshot + schema version
- `deal_plays`, `deal_highScore`, `deal_bestTimeMs`
- mute / volume

Autosave after every successful move. Resume on home screen. Optional later: tiny PHP stats ping for a global plays counter (out of scope for Wave 1).

## Flavor (fiction)
A pack left in **R273’s** truck / dealt on a desert picnic table — story seasoning only. This title is **Jerod Price / CosmicCEO**; no claim on Jeffery’s board art beyond the shared desert family palette and fonts.

## Out of scope for Wave 1
Accounts, multiplayer, PHP/MySQL, Matter.js, Dust Storm rule twist, real-money anything, shipping pitch PDF in git, embedding paid stock photos.
