/* Desert Deal — Web Audio synth (card SFX + desert radio bed).
   No sample files: sibling style (Bandit). Unlock on first user gesture (iOS).
   Keys: deal_mute, deal_vol. Web cannot reliably read the iPhone silent switch. */
(function (global) {
  'use strict';

  var ctx = null;
  var master = null;
  var sfxGain = null;
  var radioGain = null;
  var unlocked = false;
  var muted = false;
  var volume = 0.7;
  var buffers = {};
  var radioTimer = null;
  var hissNodes = null;
  var TAU = Math.PI * 2;

  function loadSettings() {
    try {
      muted = localStorage.getItem('deal_mute') === '1';
      var v = parseFloat(localStorage.getItem('deal_vol'));
      if (isFinite(v)) volume = Math.max(0, Math.min(1, v));
    } catch (e) {}
  }
  function saveSettings() {
    try {
      localStorage.setItem('deal_mute', muted ? '1' : '0');
      localStorage.setItem('deal_vol', String(volume));
    } catch (e) {}
  }

  function ensureCtx() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : volume;
    master.connect(ctx.destination);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = 1;
    sfxGain.connect(master);
    radioGain = ctx.createGain();
    radioGain.gain.value = 0.35;
    radioGain.connect(master);
    return ctx;
  }

  function make(dur, fn) {
    var sr = ctx.sampleRate;
    var n = Math.max(1, Math.floor(dur * sr));
    var buf = ctx.createBuffer(1, n, sr);
    var d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = fn(i / sr, i);
    var fade = Math.min(n, Math.floor(0.004 * sr));
    for (var k = 0; k < n; k++) {
      var v = d[k];
      d[k] = v > 1 ? 1 : v < -1 ? -1 : v;
      if (k > n - fade) d[k] *= (n - k) / fade;
      if (k < fade) d[k] *= k / fade;
    }
    return buf;
  }

  function env(t, a, dcy) {
    return t < a ? t / a : Math.exp(-(t - a) / dcy);
  }

  function buildBuffers() {
    if (!ctx || buffers.slap) return;
    var lp = 0;
    function noise(k) {
      lp += k * ((Math.random() * 2 - 1) - lp);
      return lp;
    }

    // Card slap onto wood
    buffers.slap = make(0.12, function (t) {
      var body = env(t, 0.001, 0.028) * (0.55 * Math.sin(TAU * (180 - 90 * t) * t) + 0.35 * noise(0.55));
      var tick = env(t, 0.0004, 0.008) * 0.4 * (Math.random() * 2 - 1);
      return body + tick;
    });

    // Soft legal snap
    buffers.snap = make(0.09, function (t) {
      return env(t, 0.001, 0.02) * (0.4 * Math.sin(TAU * 420 * t) + 0.25 * noise(0.4));
    });

    // Illegal bounce
    buffers.bounce = make(0.18, function (t) {
      var e = env(t, 0.002, 0.05);
      return e * (0.35 * Math.sin(TAU * (140 + 40 * Math.sin(TAU * 8 * t)) * t) + 0.2 * noise(0.45));
    });

    // Stock flip rustle
    buffers.flip = make(0.16, function (t) {
      return env(t, 0.004, 0.04) * (0.45 * noise(0.6) + 0.15 * Math.sin(TAU * 900 * t));
    });

    // Shuffle / deal cascade unit
    buffers.deal = make(0.07, function (t) {
      return env(t, 0.001, 0.015) * (0.5 * noise(0.7) + 0.2 * Math.sin(TAU * 600 * t));
    });

    buffers.shuffle = make(0.55, function (t) {
      var s = 0;
      for (var i = 0; i < 8; i++) {
        var u = t - i * 0.055;
        if (u < 0 || u > 0.08) continue;
        s += env(u, 0.001, 0.02) * (0.35 * noise(0.65) + 0.12 * Math.sin(TAU * (500 + 80 * i) * u));
      }
      return s;
    });

    // Win chime (desert-warm, not casino)
    buffers.win = make(1.8, function (t) {
      var notes = [[0, 392], [0.18, 493.88], [0.36, 587.33], [0.58, 784], [0.95, 659.25]];
      var s = 0;
      for (var i = 0; i < notes.length; i++) {
        var u = t - notes[i][0];
        if (u < 0 || u > 0.7) continue;
        var f = notes[i][1];
        var e = (u < 0.01 ? u / 0.01 : 1) * Math.exp(-u / 0.28);
        s += e * (0.35 * Math.sin(TAU * f * u) + 0.18 * Math.sin(TAU * 2 * f * u));
      }
      return 0.55 * s;
    });

    // Radio key-up click
    buffers.rclick = make(0.05, function (t) {
      return env(t, 0.0005, 0.008) * (0.7 * (Math.random() * 2 - 1) + 0.2 * Math.sin(TAU * 1800 * t));
    });

    // Squelch tail
    buffers.rsquelch = make(0.22, function (t) {
      var e = env(t, 0.005, 0.06);
      return e * (0.55 * noise(0.8) * (1 - t / 0.22) + 0.15 * Math.sin(TAU * 320 * t));
    });

    // Scratchy "voice burble" — band-limited noise, not spoken lines
    buffers.rchatter = make(1.4, function (t) {
      var gate = (t < 0.05 ? t / 0.05 : t > 1.2 ? Math.max(0, (1.4 - t) / 0.2) : 1);
      var form = 0.55 + 0.45 * Math.sin(TAU * (3.2 + 1.1 * Math.sin(TAU * 0.7 * t)) * t);
      var buzz = Math.sin(TAU * (220 + 80 * Math.sin(TAU * 5 * t)) * t);
      return gate * form * (0.28 * noise(0.35) + 0.12 * buzz);
    });
  }

  function playBuf(name, dest, opts) {
    opts = opts || {};
    if (!unlocked || muted || !buffers[name]) return;
    ensureCtx();
    if (ctx.state === 'suspended') ctx.resume();
    var src = ctx.createBufferSource();
    src.buffer = buffers[name];
    if (opts.rate) src.playbackRate.value = opts.rate;
    var g = ctx.createGain();
    g.gain.value = opts.gain == null ? 1 : opts.gain;
    src.connect(g);
    g.connect(dest || sfxGain);
    try { src.start(); } catch (e) {}
  }

  function startHiss() {
    if (!ctx || hissNodes) return;
    // Continuous quiet radio hiss bed
    var sr = ctx.sampleRate;
    var len = sr * 2;
    var buf = ctx.createBuffer(1, len, sr);
    var d = buf.getChannelData(0);
    var lp = 0;
    for (var i = 0; i < len; i++) {
      lp += 0.12 * ((Math.random() * 2 - 1) - lp);
      d[i] = lp * 0.35;
    }
    var src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    var filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1400;
    filter.Q.value = 0.7;
    var g = ctx.createGain();
    g.gain.value = 0.22;
    src.connect(filter);
    filter.connect(g);
    g.connect(radioGain);
    try { src.start(); } catch (e) {}
    hissNodes = { src: src, g: g };
  }

  function stopHiss() {
    if (!hissNodes) return;
    try { hissNodes.src.stop(); } catch (e) {}
    hissNodes = null;
  }

  function scheduleRadio() {
    clearTimeout(radioTimer);
    if (!unlocked || muted) return;
    function tick() {
      if (!unlocked || muted) return;
      // Occasional key-up + chatter burble + squelch (Dispatch–R55 flavor, no voice IP)
      playBuf('rclick', radioGain, { gain: 0.45 });
      setTimeout(function () {
        playBuf('rchatter', radioGain, {
          gain: 0.35 + Math.random() * 0.25,
          rate: 0.85 + Math.random() * 0.35
        });
      }, 40 + Math.random() * 80);
      setTimeout(function () {
        playBuf('rsquelch', radioGain, { gain: 0.4 });
      }, 900 + Math.random() * 500);
      var next = 12000 + Math.random() * 22000;
      radioTimer = setTimeout(tick, next);
    }
    radioTimer = setTimeout(tick, 4000 + Math.random() * 6000);
  }

  function applyMuteVolume() {
    if (!master) return;
    master.gain.value = muted ? 0 : volume;
    if (muted) {
      stopHiss();
      clearTimeout(radioTimer);
      radioTimer = null;
    } else if (unlocked) {
      startHiss();
      scheduleRadio();
    }
  }

  function unlock() {
    ensureCtx();
    if (!ctx) return Promise.resolve(false);
    return ctx.resume().then(function () {
      unlocked = true;
      buildBuffers();
      applyMuteVolume();
      // silent buffer poke for iOS
      playBuf('snap', sfxGain, { gain: 0.0001 });
      updateUI();
      return true;
    }).catch(function () { return false; });
  }

  function updateUI() {
    var bar = document.getElementById('sound-bar');
    var btn = document.getElementById('btn-snd');
    var panel = document.getElementById('snd-panel');
    var muteEl = document.getElementById('set-mute');
    var volEl = document.getElementById('set-vol');
    var volVal = document.getElementById('set-vol-val');
    if (bar) {
      if (!unlocked) {
        bar.hidden = false;
        bar.textContent = 'Sound is paused. Tap here to turn it on.';
      } else if (muted) {
        bar.hidden = false;
        bar.textContent = 'Sound is muted. Tap to unmute.';
      } else {
        bar.hidden = true;
      }
    }
    if (btn) {
      btn.classList.toggle('muted', muted || !unlocked);
      btn.setAttribute('aria-pressed', muted ? 'true' : 'false');
    }
    if (muteEl) muteEl.checked = muted;
    if (volEl) volEl.value = String(Math.round(volume * 100));
    if (volVal) volVal.textContent = String(Math.round(volume * 100));
    if (panel && muteEl) { /* leave open state alone */ }
  }

  function wireUI() {
    loadSettings();
    var bar = document.getElementById('sound-bar');
    if (bar) {
      bar.addEventListener('click', function () {
        if (!unlocked) unlock();
        else if (muted) { muted = false; saveSettings(); applyMuteVolume(); updateUI(); }
      });
    }
    var btn = document.getElementById('btn-snd');
    var panel = document.getElementById('snd-panel');
    if (btn && panel) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (!unlocked) { unlock(); return; }
        panel.hidden = !panel.hidden;
        btn.setAttribute('aria-expanded', panel.hidden ? 'false' : 'true');
      });
      document.addEventListener('click', function () {
        if (panel && !panel.hidden) {
          panel.hidden = true;
          btn.setAttribute('aria-expanded', 'false');
        }
      });
      panel.addEventListener('click', function (e) { e.stopPropagation(); });
    }
    var muteEl = document.getElementById('set-mute');
    var volEl = document.getElementById('set-vol');
    if (muteEl) {
      muteEl.addEventListener('change', function () {
        muted = !!muteEl.checked;
        saveSettings();
        applyMuteVolume();
        updateUI();
      });
    }
    if (volEl) {
      volEl.addEventListener('input', function () {
        volume = Math.max(0, Math.min(1, (+volEl.value || 0) / 100));
        saveSettings();
        applyMuteVolume();
        updateUI();
      });
    }
    // First gesture anywhere unlocks (iOS policy)
    function once() {
      unlock();
      document.removeEventListener('pointerdown', once, true);
    }
    document.addEventListener('pointerdown', once, true);
    updateUI();
  }

  var API = {
    unlock: unlock,
    slap: function () { playBuf('slap', sfxGain, { gain: 0.85, rate: 0.92 + Math.random() * 0.16 }); },
    snap: function () { playBuf('snap', sfxGain, { gain: 0.7, rate: 0.95 + Math.random() * 0.1 }); },
    bounce: function () { playBuf('bounce', sfxGain, { gain: 0.75 }); },
    flip: function () { playBuf('flip', sfxGain, { gain: 0.8 }); },
    dealOne: function (i) { playBuf('deal', sfxGain, { gain: 0.55, rate: 0.9 + (i % 5) * 0.03 }); },
    shuffle: function () { playBuf('shuffle', sfxGain, { gain: 0.75 }); },
    win: function () { playBuf('win', sfxGain, { gain: 0.9 }); },
    setMuted: function (m) { muted = !!m; saveSettings(); applyMuteVolume(); updateUI(); },
    isMuted: function () { return muted; },
    isUnlocked: function () { return unlocked; },
    wireUI: wireUI,
    updateUI: updateUI
  };

  global.DDSound = API;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wireUI);
  else wireUI();
})(typeof window !== 'undefined' ? window : this);
