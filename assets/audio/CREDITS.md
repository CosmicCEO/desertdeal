# Audio credits — Desert Deal

No synthesized sounds. Two sources only.

## 1. Card sounds — Kenney "Casino Audio" 1.1 (CC0 1.0)

- Source page: https://kenney.nl/assets/casino-audio
- Direct file: https://kenney.nl/media/pages/assets/casino-audio/2472606a04-1721639069/kenney_casino-audio.zip
- Author: Kenney Vleugels (Kenney.nl). License: Creative Commons Zero (CC0 1.0), per `License.txt` in the zip. Credit is optional; given here anyway.
- Retrieved 2026-10-06 (CT).
- Changes for every file: trailing silence removed, trimmed, 80 ms fade-out, `loudnorm` I=-22 LUFS, mono, 44.1 kHz, MP3 64 kbps (ffmpeg). Played at 0.35-0.55 gain in game.

| file in `assets/audio/cards/` | from (`Audio/` in the zip) | use |
|---|---|---|
| deal-1.mp3 / deal-2.mp3 / deal-3.mp3 | card-slide-1/2/3.ogg (trimmed 0.45 s) | dealing the tableau |
| place-1.mp3 / place-2.mp3 / place-3.mp3 | card-place-1/2/4.ogg (≤ 0.5 s) | a card lands on a pile |
| flip-1.mp3 / flip-2.mp3 | card-slide-4/6.ogg (0.4 s) | stock → waste |
| bounce.mp3 | card-shove-2.ogg (0.5 s) | illegal drop / no move |
| shuffle.mp3 | card-shuffle.ogg (first 1.6 s) | new deal, waste recycle |
| win-fan.mp3 | card-fan-2.ogg (1.3 s) | win |

## 2. Radio chatter + ambience — Desert Ranger (Jerod Price / CosmicCEO)

Copied unchanged from `CosmicCEO/desertranger` → `desertranger/audio/` (commit 58906c3). Jerod's own game audio; see that repo's `audio/CREDITS.md`:
voices generated with Chatterbox (ResembleAI, MIT) cloned from Kokoro preset voices (never a real person), radio chain + bed synthesized with ffmpeg in the Ranger repo.

| here | Ranger source | notes |
|---|---|---|
| amb/amb-bed-01.mp3 | audio/amb/amb-bed-01.mp3 | 90 s desert bed, looped at 0.12 gain |
| radio/chatter/ch01-1 … ch12-4.mp3 (39 files) | audio/chatter/ | Dispatch / R55 / R273 exchanges, all QA "pass" in Ranger's manifest |
| radio/fx/radio-click-01.mp3, radio-squelch-01..03.mp3 | audio/radio/fx/ | key-up click and squelch tail around each line |

One random exchange (never the same twice in a row) plays every 45-90 s; the first one 20-40 s after sound starts.
