Fonts (Bungee, Nunito, Caveat, Bangers — same as Desert Ranger / Bandit) load from Google Fonts in index.html.
No @font-face points here any more: the .ttf files are gitignored, and a same-name local @font-face that 404s
overrides the Google face and drops the page to system fonts. Local .ttf copies in this folder are unused.
