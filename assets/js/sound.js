/* Desert Deal — recorded sounds (no synthesis).
   Cards: Kenney "Casino Audio" (CC0). Radio + ambience: Desert Ranger clips (Jerod's own).
   Web Audio, decoded once after the first tap (iOS unlock). On iOS, Web Audio follows the
   ring/silent switch; we also ask for the 'ambient' audio session where Safari supports it.
   localStorage: deal_mute ('1'/'0'), deal_vol (0..1). */
(function (global) {
  'use strict';

  var BASE = 'assets/audio/';
  var SFX = {
    deal: ['cards/deal-1.mp3', 'cards/deal-2.mp3', 'cards/deal-3.mp3'],
    place: ['cards/place-1.mp3', 'cards/place-2.mp3', 'cards/place-3.mp3'],
    flip: ['cards/flip-1.mp3', 'cards/flip-2.mp3'],
    bounce: ['cards/bounce.mp3'],
    shuffle: ['cards/shuffle.mp3'],
    win: ['cards/win-fan.mp3']
  };
  var SFX_GAIN = { deal: 0.35, place: 0.5, flip: 0.4, bounce: 0.35, shuffle: 0.4, win: 0.55 };
  // Desert Ranger chatter, grouped as the short exchanges they were written as.
  var CONVOS = [];
  [[1, 3], [2, 3], [3, 3], [4, 3], [5, 2], [6, 4], [7, 2], [8, 3], [9, 4], [10, 4], [11, 4], [12, 4]].forEach(function (c) {
    var lines = [];
    for (var i = 1; i <= c[1]; i++) lines.push('radio/chatter/ch' + (c[0] < 10 ? '0' : '') + c[0] + '-' + i + '.mp3');
    CONVOS.push(lines);
  });
  var FX = { click: 'radio/fx/radio-click-01.mp3', squelch: ['radio/fx/radio-squelch-01.mp3', 'radio/fx/radio-squelch-02.mp3', 'radio/fx/radio-squelch-03.mp3'] };
  var BED = 'amb/amb-bed-01.mp3';
  var BED_GAIN = 0.12, RADIO_GAIN = 0.32;
  var CHATTER_MIN_MS = 45000, CHATTER_MAX_MS = 90000;

  var ctx = null, master = null, sfxBus = null, ambBus = null;
  var buffers = {}, loading = {};
  var unlocked = false, muted = false, volume = 0.7;
  var bedSrc = null, chatterTimer = null, talking = false, lastConvo = -1;

  function load() {
    try {
      muted = localStorage.getItem('deal_mute') === '1';
      var v = parseFloat(localStorage.getItem('deal_vol'));
      if (isFinite(v)) volume = Math.max(0, Math.min(1, v));
    } catch (e) {}
  }
  function persist() { try { localStorage.setItem('deal_mute', muted ? '1' : '0'); localStorage.setItem('deal_vol', String(volume)); } catch (e) {} }

  function makeCtx() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { if (navigator.audioSession) navigator.audioSession.type = 'ambient'; } catch (e) {}
    ctx = new AC();
    master = ctx.createGain(); master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.connect(master);
    ambBus = ctx.createGain(); ambBus.connect(master);
    applyGain();
    return ctx;
  }
  function applyGain() { if (master) master.gain.value = muted ? 0 : volume; }

  function fetchBuf(path) {
    if (buffers[path]) return Promise.resolve(buffers[path]);
    if (loading[path]) return loading[path];
    loading[path] = fetch(BASE + path).then(function (r) { if (!r.ok) throw new Error(path + ' ' + r.status); return r.arrayBuffer(); })
      .then(function (ab) { return new Promise(function (res, rej) { ctx.decodeAudioData(ab, res, rej); }); })
      .then(function (b) { buffers[path] = b; return b; })
      .catch(function (e) { delete loading[path]; console.warn('[sound]', e && e.message); return null; });
    return loading[path];
  }
  function play(path, bus, gain, rate) {
    if (!unlocked || muted || !ctx) return null;
    var b = buffers[path];
    if (!b) { fetchBuf(path); return null; }
    var src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = b;
    if (rate) src.playbackRate.value = rate;
    g.gain.value = gain;
    src.connect(g); g.connect(bus);
    src.start();
    return src;
  }
  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

  /* ---------------------------------------------------------------- ambience + radio chatter */
  function startBed() {
    if (bedSrc || muted || !unlocked) return;
    fetchBuf(BED).then(function (b) {
      if (!b || bedSrc || muted || !unlocked) return;
      bedSrc = ctx.createBufferSource();
      bedSrc.buffer = b; bedSrc.loop = true;
      var g = ctx.createGain(); g.gain.value = 0;
      g.gain.setTargetAtTime(BED_GAIN, ctx.currentTime, 1.5);   // fade in
      bedSrc.connect(g); g.connect(ambBus);
      bedSrc.start();
    });
  }
  function stopBed() { if (bedSrc) { try { bedSrc.stop(); } catch (e) {} bedSrc = null; } }
  function scheduleChatter(first) {
    clearTimeout(chatterTimer);
    if (muted || !unlocked) return;
    var wait = first ? 20000 + Math.random() * 20000 : CHATTER_MIN_MS + Math.random() * (CHATTER_MAX_MS - CHATTER_MIN_MS);
    chatterTimer = setTimeout(playConvo, wait);
  }
  function playConvo() {
    if (muted || !unlocked || talking || document.hidden) { scheduleChatter(false); return; }
    var i; do { i = Math.floor(Math.random() * CONVOS.length); } while (CONVOS.length > 1 && i === lastConvo);
    lastConvo = i;
    var lines = CONVOS[i];
    var paths = lines.concat([FX.click]).concat(FX.squelch);
    Promise.all(paths.map(fetchBuf)).then(function () {
      if (muted || !unlocked) { scheduleChatter(false); return; }
      talking = true;
      var t = ctx.currentTime + 0.05;
      lines.forEach(function (p) {
        var b = buffers[p]; if (!b) return;
        at(FX.click, t, RADIO_GAIN * 0.8);
        at(p, t + 0.08, RADIO_GAIN);
        t += 0.08 + b.duration;
        at(pick(FX.squelch), t, RADIO_GAIN * 0.7);
        t += 0.6 + Math.random() * 0.5;   // gap before the reply
      });
      setTimeout(function () { talking = false; scheduleChatter(false); }, (t - ctx.currentTime) * 1000);
    });
  }
  function at(path, when, gain) {
    var b = buffers[path]; if (!b || muted) return;
    var src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = b; g.gain.value = gain; src.connect(g); g.connect(ambBus); src.start(when);
  }
  function ambienceOn() { startBed(); scheduleChatter(true); }
  function ambienceOff() { stopBed(); clearTimeout(chatterTimer); }

  /* ---------------------------------------------------------------- unlock + controls */
  function unlock() {
    if (unlocked) return;
    if (!makeCtx()) return;
    var p = ctx.resume ? ctx.resume() : null;
    // a silent one-sample buffer, played inside the gesture, is what actually unlocks iOS
    try { var b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0); } catch (e) {}
    unlocked = true;
    Object.keys(SFX).forEach(function (k) { SFX[k].forEach(fetchBuf); });
    if (!muted) ambienceOn();
    updateUI();
    if (p && p.catch) p.catch(function () {});
  }
  function setMuted(m) {
    muted = !!m; persist(); applyGain();
    if (muted) ambienceOff(); else if (unlocked) ambienceOn();
    updateUI();
  }
  function setVolume(v) { volume = Math.max(0, Math.min(1, v)); persist(); applyGain(); updateUI(); }

  function updateUI() {
    var hint = document.getElementById('sound-hint');
    if (hint) hint.hidden = unlocked;
    var btn = document.getElementById('btn-snd');
    if (btn) { btn.classList.toggle('muted', muted || !unlocked); btn.setAttribute('aria-pressed', muted ? 'true' : 'false'); }
    var m = document.getElementById('set-mute'); if (m) m.checked = muted;
    var v = document.getElementById('set-vol'); if (v) v.value = String(Math.round(volume * 100));
    var vv = document.getElementById('set-vol-val'); if (vv) vv.textContent = String(Math.round(volume * 100));
  }
  function wire() {
    load();
    // first gesture anywhere unlocks; capture phase, never cancels the event, never changes layout
    function first() { unlock(); document.removeEventListener('pointerdown', first, true); document.removeEventListener('keydown', first, true); }
    document.addEventListener('pointerdown', first, true);
    document.addEventListener('keydown', first, true);
    var btn = document.getElementById('btn-snd'), panel = document.getElementById('snd-panel');
    if (btn && panel) {
      btn.addEventListener('click', function (e) { e.stopPropagation(); panel.hidden = !panel.hidden; btn.setAttribute('aria-expanded', String(!panel.hidden)); });
      panel.addEventListener('click', function (e) { e.stopPropagation(); });
      document.addEventListener('click', function () { if (!panel.hidden) { panel.hidden = true; btn.setAttribute('aria-expanded', 'false'); } });
    }
    var m = document.getElementById('set-mute'); if (m) m.addEventListener('change', function () { setMuted(m.checked); });
    var v = document.getElementById('set-vol'); if (v) v.addEventListener('input', function () { setVolume((+v.value || 0) / 100); });
    document.addEventListener('visibilitychange', function () {
      if (!ctx) return;
      if (document.hidden) { if (ctx.suspend) ctx.suspend(); } else if (unlocked && ctx.resume) ctx.resume();
    });
    updateUI();
  }

  global.DDSound = {
    deal: function (i) { play(SFX.deal[(i || 0) % SFX.deal.length], sfxBus, SFX_GAIN.deal, 0.96 + Math.random() * 0.08); },
    place: function () { play(pick(SFX.place), sfxBus, SFX_GAIN.place, 0.95 + Math.random() * 0.1); },
    flip: function () { play(pick(SFX.flip), sfxBus, SFX_GAIN.flip); },
    bounce: function () { play(SFX.bounce[0], sfxBus, SFX_GAIN.bounce); },
    shuffle: function () { play(SFX.shuffle[0], sfxBus, SFX_GAIN.shuffle); },
    win: function () { play(SFX.win[0], sfxBus, SFX_GAIN.win); },
    unlock: unlock, setMuted: setMuted, setVolume: setVolume,
    status: function () { return { unlocked: unlocked, muted: muted, volume: volume, ctx: ctx ? ctx.state : null, loaded: Object.keys(buffers).length, bed: !!bedSrc }; },
    _playChatterNow: function () { clearTimeout(chatterTimer); playConvo(); }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
})(window);
