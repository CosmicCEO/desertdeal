# Desert Deal — rules

Classic **Klondike** solitaire with a standard 52-card deck. Plain English for players and for the Wave 1 engine.

## Deal
- Shuffle 52 cards.
- **Tableau:** seven columns. Column *n* gets *n* cards; only the top card of each column is face up.
- **Foundations:** four empty piles (one per suit), above the tableau.
- Remaining cards form the **stock** (face down). Cards turned from the stock go to the **waste** (face up).

## Play
- **Tableau:** build **down by alternating color** (red on black, black on red). You may move a single face-up card, or a packed run that is already in order.
- **Foundations:** build **up by suit** from Ace to King.
- **Empty tableau column:** only a **King** (or a packed run starting with a King) may fill it.
- **Stock:** default is **Draw 3** (three cards to the waste per tap; you play the top waste card). **Draw 1** is an option for an easier game.
- When the stock is empty, recycle the waste back to the stock (face down, order preserved as usual). Each recycle costs score (below).
- **Undo:** step back through your moves (Wave 1 build allows more than one; easy to cap at one if preferred).

## Win
All 52 cards on the four foundations (Ace through King in each suit).

## Scoring (Microsoft-style)
| Event | Points |
|---|---|
| Waste → tableau | +5 |
| Any pile → foundation | +10 |
| Foundation → tableau | −15 |
| Each stock recycle (waste → stock) | −2 |

**Time bonus on a win:** `max(0, 700000 − elapsed_ms) / 1000` (integer; about 700 points if you finish instantly, zero after ~11.7 minutes).

Final score for a completed game = running score + time bonus. Incomplete games do not update high score.

## Stats (localStorage MVP)
| Stat | Meaning |
|---|---|
| **Plays** | Games started (New game / deal) |
| **High score** | Best **completed** score |
| **Best time** | Fastest win (elapsed wall time) |

Mid-game state (layout, score so far, elapsed, draw mode) is autosaved so you can resume.

## Defaults (locked for Wave 1)
Draw 3 · pure Klondike (no Dust Storm / special cards) · single player only.
