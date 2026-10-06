Optional local copies of Bungee, Nunito, Caveat, Bangers (from Desert Ranger / Bandit pitch fonts).
Game loads Google Fonts in index.html; @font-face in game.css falls back to these files when present.
Do not commit .ttf (see .gitignore). Symlink from sibling:
  ln -sf /path/to/boardgame/pitch/fonts/*.ttf assets/fonts/

