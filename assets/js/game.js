/* Desert Deal — Klondike engine + table layout.
   One phone-portrait board (390x620 board px) scaled to fit any window.
   Input: tap-to-move (primary, reliable on iPhone) + drag/fling. Undo, autosave/resume, stats.
   URL params: ?play=1 (start/resume immediately), ?seed=N (deterministic deal), ?draw=1|3 */
(function () {
  'use strict';

  var FSUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
  var FSYM = { spades: '\u2660', hearts: '\u2665', diamonds: '\u2666', clubs: '\u2663' };
  var BOARD_W = 390, BOARD_H = 620;
  var SAVE_KEY = 'deal_save', SAVE_V = 1;
  var PILES = ['stock', 'waste', 'f0', 'f1', 'f2', 'f3', 't0', 't1', 't2', 't3', 't4', 't5', 't6'];

  var state = null;          // { piles: {id: [card]}, drawCount, score, elapsedMs, won, seed, moves }
  var byId = {};             // card id -> card object (persistent across games)
  var els = {};              // card id -> element
  var undoStack = [];
  var startedAt = 0;         // wall clock when elapsed counting resumed
  var timerId = null;
  var scale = 1;
  var busy = false;          // deal animation in progress
  var ctl = null;

  function $(id) { return document.getElementById(id); }
  function sfx(name, arg) { if (window.DDSound && typeof DDSound[name] === 'function') DDSound[name](arg); }
  function cssPx(name, d) { var v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)); return isFinite(v) ? v : d; }
  function dims() { return { w: cssPx('--card-w', 48), h: cssPx('--card-h', 68), fan: cssPx('--fan-y', 16), fanDown: cssPx('--fan-down', 8), wfan: cssPx('--waste-fan', 14) }; }
  function pile(id) { return state.piles[id]; }
  function topOf(id) { var p = pile(id); return p[p.length - 1] || null; }
  function isRed(c) { return c.color === 'red'; }
  function params() { var o = {}; location.search.replace(/[?&]([^=&]+)=?([^&]*)/g, function (_, k, v) { o[k] = decodeURIComponent(v); }); return o; }

  /* ---------------------------------------------------------------- table art */
  function buildPlanks() {
    var host = $('planks');
    if (!host || host.children.length) return;
    var knots = [[12, 18], [70, 40], [35, 60], [85, 22], [20, 75], [55, 30], [40, 50]];
    for (var i = 0; i < 7; i++) {
      var p = document.createElement('div');
      p.className = 'plank';
      p.innerHTML = '<div class="bleach"></div><div class="bolt" style="left:12px"></div><div class="bolt" style="right:12px"></div>' +
        (i % 2 === 0 ? '<div class="bolt" style="left:50%;margin-left:-5px"></div>' : '') +
        '<div class="knot" style="left:' + knots[i][0] + '%;top:' + knots[i][1] + '%"></div>';
      host.appendChild(p);
    }
    for (var f = 0; f < 4; f++) $('pile-f' + f).setAttribute('data-suit-sym', FSYM[FSUITS[f]]);
  }

  /* ---------------------------------------------------------------- scaling */
  function updateScale() {
    var stage = $('table-stage'), root = $('table-scale');
    if (!stage || !root || !stage.clientWidth) return;
    var pad = 8;
    scale = Math.min((stage.clientWidth - pad) / BOARD_W, (stage.clientHeight - pad) / BOARD_H);
    if (!isFinite(scale) || scale <= 0) scale = 1;
    root.style.transform = 'scale(' + scale + ')';
  }
  /** client px -> board px (the board is transform-scaled around its centre). */
  function toBoard(cx, cy) {
    var r = $('table-scale').getBoundingClientRect();
    var s = r.width / BOARD_W || 1;
    return { x: (cx - r.left) / s, y: (cy - r.top) / s };
  }

  /* ---------------------------------------------------------------- layout (board px, transform-free) */
  function pileOrigin(id) {
    var el = document.querySelector('[data-pile="' + id + '"]');
    return { x: el.offsetLeft, y: el.offsetTop };   // offsetParent = #playfield, which fills the board
  }
  function positionsFor(id) {
    var d = dims(), o = pileOrigin(id), cards = pile(id), out = [], i;
    if (id === 'waste') {
      var start = Math.max(0, cards.length - 3);
      for (i = 0; i < cards.length; i++) out.push({ left: o.x + (i < start ? 0 : (i - start) * d.wfan), top: o.y, z: 20 + i });
    } else if (id.charAt(0) === 't') {
      var y = o.y;
      for (i = 0; i < cards.length; i++) { out.push({ left: o.x, top: y, z: 20 + i }); y += cards[i].faceUp ? d.fan : d.fanDown; }
    } else {
      for (i = 0; i < cards.length; i++) out.push({ left: o.x, top: o.y, z: 20 + i });
    }
    return out;
  }
  function layoutAll() {
    PILES.forEach(function (id) {
      var cards = pile(id), pos = positionsFor(id);
      for (var i = 0; i < cards.length; i++) {
        var el = els[cards[i].id];
        el.style.left = pos[i].left + 'px';
        el.style.top = pos[i].top + 'px';
        el.style.zIndex = String(pos[i].z);
        if (!el.classList.contains('flipping')) DDCards.setFace(el, cards[i].faceUp);
      }
    });
    var stockEl = $('pile-stock');
    stockEl.classList.toggle('empty-recycle', !pile('stock').length && pile('waste').length > 0);
  }
  /** Raise moving cards above everything while they fly, then settle. */
  function fly(cards) {
    cards.forEach(function (c, i) { els[c.id].style.zIndex = String(400 + i); });
    setTimeout(function () { if (state) layoutAll(); }, 260);
  }

  /* ---------------------------------------------------------------- state / save */
  function emptyPiles() { var p = {}; PILES.forEach(function (id) { p[id] = []; }); return p; }
  function serialize() {
    var piles = {};
    PILES.forEach(function (id) { piles[id] = pile(id).map(function (c) { return [c.id, c.faceUp ? 1 : 0]; }); });
    return { v: SAVE_V, seed: state.seed, drawCount: state.drawCount, score: state.score,
             elapsedMs: currentElapsed(), won: state.won, moves: state.moves, piles: piles };
  }
  function restore(snap) {
    var piles = emptyPiles();
    PILES.forEach(function (id) {
      (snap.piles[id] || []).forEach(function (pair) { var c = byId[pair[0]]; c.faceUp = !!pair[1]; piles[id].push(c); });
    });
    state = { piles: piles, drawCount: snap.drawCount === 1 ? 1 : 3, score: snap.score | 0,
              elapsedMs: snap.elapsedMs | 0, won: !!snap.won, seed: snap.seed, moves: snap.moves | 0 };
  }
  function validSnap(s) {
    if (!s || s.v !== SAVE_V || !s.piles) return false;
    var n = 0, seen = {};
    for (var i = 0; i < PILES.length; i++) {
      var arr = s.piles[PILES[i]];
      if (!arr) return false;
      for (var j = 0; j < arr.length; j++) { if (!byId[arr[j][0]] || seen[arr[j][0]]) return false; seen[arr[j][0]] = 1; n++; }
    }
    return n === 52;
  }
  function save() {
    try {
      if (!state || state.won) localStorage.removeItem(SAVE_KEY);
      else localStorage.setItem(SAVE_KEY, JSON.stringify(serialize()));
    } catch (e) {}
  }
  function loadSave() {
    try { var s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); return validSnap(s) && !s.won ? s : null; } catch (e) { return null; }
  }
  function pushUndo() { undoStack.push(serialize()); if (undoStack.length > 200) undoStack.shift(); }

  /* ---------------------------------------------------------------- deal / resume */
  function ensureDeck() {
    if (Object.keys(byId).length) return;
    DDCards.createDeck().forEach(function (c) { byId[c.id] = c; });
  }
  function mountCards() {
    var host = $('playfield');
    Object.keys(els).forEach(function (id) { var e = els[id]; if (e.parentNode) e.parentNode.removeChild(e); });
    els = {};
    Object.keys(byId).forEach(function (id) { var el = DDCards.createCardEl(byId[id]); host.appendChild(el); els[id] = el; });
  }
  function newGame(opts) {
    opts = opts || {};
    ensureDeck();
    var seed = opts.seed != null ? String(opts.seed) : String(Date.now() % 2147483647);
    var draw = opts.drawCount || ($('opt-draw1') && $('opt-draw1').checked ? 1 : 3);
    var order = DDCards.shuffle(DDCards.createDeck(), seed).map(function (c) { return byId[c.id]; });
    var piles = emptyPiles(), k = 0;
    for (var col = 0; col < 7; col++) for (var n = 0; n <= col; n++) { var c = order[k++]; c.faceUp = (n === col); piles['t' + col].push(c); }
    while (k < order.length) { var s = order[k++]; s.faceUp = false; piles.stock.push(s); }
    state = { piles: piles, drawCount: draw, score: 0, elapsedMs: 0, won: false, seed: seed, moves: 0 };
    undoStack = [];
    bumpStat('deal_plays');
    startPlay(true);
  }
  function resumeGame() {
    var s = loadSave();
    if (!s) { newGame(); return; }
    ensureDeck();
    restore(s);
    undoStack = [];
    startPlay(false);
  }
  function startPlay(animateDeal) {
    showScreen('screen-play');
    $('win-banner').hidden = true;
    updateScale();
    mountCards();
    var origin = pileOrigin('stock');
    if (animateDeal && !DDPhysics.reducedMotion) {
      busy = true;
      // start every card on the stock, then let the left/top transition deal them out
      Object.keys(els).forEach(function (id) { var e = els[id]; e.classList.add('no-anim'); e.style.left = origin.x + 'px'; e.style.top = origin.y + 'px'; DDCards.setFace(e, false); });
      void $('playfield').offsetWidth;
      var order = [];
      for (var row = 0; row < 7; row++) for (var col = row; col < 7; col++) order.push(pile('t' + col)[row]);
      Object.keys(els).forEach(function (id) { els[id].classList.remove('no-anim'); });
      order.forEach(function (c, i) { els[c.id].style.transitionDelay = (i * 0.025) + 's'; });
      sfx('shuffle');
      layoutAll();
      order.forEach(function (c, i) { if (i % 3 === 0) setTimeout(function () { sfx('deal', i); }, 120 + i * 25); });
      setTimeout(function () { order.forEach(function (c) { els[c.id].style.transitionDelay = ''; }); busy = false; }, 120 + order.length * 25 + 300);
    } else {
      layoutAll();
    }
    startTimer();
    updateHud();
    save();
  }

  /* ---------------------------------------------------------------- rules */
  function fIndexFor(card) { return FSUITS.indexOf(card.suit); }
  function canFoundation(card, fi) {
    if (FSUITS[fi] !== card.suit) return false;
    var t = topOf('f' + fi);
    return t ? t.rankN === card.rankN - 1 : card.rankN === 1;
  }
  function canTableau(card, ti) {
    var t = topOf('t' + ti);
    return t ? (t.faceUp && isRed(t) !== isRed(card) && t.rankN === card.rankN + 1) : card.rankN === 13;
  }
  /** Movable run starting at index (null if not movable). */
  function runFrom(id, index) {
    var p = pile(id);
    if (!p[index] || !p[index].faceUp) return null;
    if (id === 'stock') return null;
    if ((id === 'waste' || id.charAt(0) === 'f') && index !== p.length - 1) return null;
    for (var i = index; i < p.length - 1; i++) {
      var a = p[i], b = p[i + 1];
      if (!b.faceUp || isRed(a) === isRed(b) || a.rankN !== b.rankN + 1) return null;
    }
    return p.slice(index);
  }
  function legal(cards, to) {
    if (to.charAt(0) === 'f') return cards.length === 1 && canFoundation(cards[0], +to.slice(1));
    if (to.charAt(0) === 't') return canTableau(cards[0], +to.slice(1));
    return false;
  }
  /** Tap-to-move target: foundation first, then a non-empty tableau column, then an empty column (Kings). */
  function bestTarget(from, index) {
    var cards = runFrom(from, index);
    if (!cards) return null;
    if (cards.length === 1 && from.charAt(0) !== 'f') {
      var fi = fIndexFor(cards[0]);
      if (canFoundation(cards[0], fi)) return 'f' + fi;
    }
    var emptyCol = null;
    for (var t = 0; t < 7; t++) {
      var id = 't' + t;
      if (id === from) continue;
      if (!pile(id).length) { if (emptyCol === null) emptyCol = id; continue; }
      if (canTableau(cards[0], t)) return id;
    }
    if (emptyCol && cards[0].rankN === 13 && !(from.charAt(0) === 't' && index === 0)) return emptyCol;
    return null;
  }

  /* ---------------------------------------------------------------- moves */
  function locate(card) {
    for (var i = 0; i < PILES.length; i++) { var j = pile(PILES[i]).indexOf(card); if (j >= 0) return { pile: PILES[i], index: j }; }
    return null;
  }
  function doMove(from, index, to) {
    if (!state || state.won || from === to) return false;
    var cards = runFrom(from, index);
    if (!cards || !legal(cards, to)) return false;
    pushUndo();
    pile(from).splice(index, cards.length);
    Array.prototype.push.apply(pile(to), cards);
    if (to.charAt(0) === 'f') state.score += 10;
    else if (from === 'waste') state.score += 5;
    else if (from.charAt(0) === 'f') state.score = Math.max(0, state.score - 15);
    var revealed = null;
    if (from.charAt(0) === 't') { var t = topOf(from); if (t && !t.faceUp) { t.faceUp = true; revealed = t; } }
    state.moves++;
    layoutAll();
    fly(cards);
    if (revealed) DDPhysics.flipCard(els[revealed.id], true);
    sfx('place');
    afterMove();
    return true;
  }
  function flipStock() {
    if (!state || state.won) return false;
    var st = pile('stock'), wa = pile('waste');
    if (!st.length && !wa.length) return false;
    pushUndo();
    if (!st.length) {
      while (wa.length) { var c = wa.pop(); c.faceUp = false; st.push(c); }
      state.score = Math.max(0, state.score - 2);
      state.moves++;
      layoutAll();
      sfx('shuffle');
    } else {
      var n = Math.min(state.drawCount, st.length), drawn = [];
      for (var i = 0; i < n; i++) { var d = st.pop(); d.faceUp = true; wa.push(d); drawn.push(d); }
      state.moves++;
      layoutAll();
      fly(drawn);
      drawn.forEach(function (d) { DDCards.setFace(els[d.id], false); DDPhysics.flipCard(els[d.id], true); });
      sfx('flip');
    }
    afterMove();
    return true;
  }
  function undo() {
    if (!undoStack.length || !state || busy || state.won) return false;
    var el = currentElapsed();
    restore(undoStack.pop());
    state.elapsedMs = el;            // undo never rewinds the clock
    startedAt = timerId ? Date.now() : 0;
    layoutAll();
    sfx('flip');
    updateHud();
    save();
    return true;
  }
  function afterMove() {
    updateHud();
    if (countFoundation() === 52) win();
    save();
  }
  function countFoundation() { return pile('f0').length + pile('f1').length + pile('f2').length + pile('f3').length; }
  function win() {
    state.elapsedMs = currentElapsed();
    state.won = true;
    stopTimer();
    var bonus = Math.max(0, Math.floor((700000 - state.elapsedMs) / 1000));
    state.score += bonus;
    try {
      var hi = parseInt(localStorage.getItem('deal_highScore') || '0', 10);
      if (state.score > hi) localStorage.setItem('deal_highScore', String(state.score));
      var best = parseInt(localStorage.getItem('deal_bestTimeMs') || '0', 10);
      if (!best || state.elapsedMs < best) localStorage.setItem('deal_bestTimeMs', String(state.elapsedMs));
      localStorage.removeItem(SAVE_KEY);
    } catch (e) {}
    updateHud();
    $('win-detail').textContent = 'Score ' + state.score + ' (time bonus ' + bonus + ') \u00b7 ' + fmtTime(state.elapsedMs);
    setTimeout(function () { $('win-banner').hidden = false; sfx('win'); }, 350);
  }

  /* ---------------------------------------------------------------- input */
  function cardOf(el) { return el ? byId[el.dataset.id] : null; }
  function nudge(el) {
    if (!el) return;
    el.classList.remove('nope'); void el.offsetWidth; el.classList.add('nope');
    setTimeout(function () { el.classList.remove('nope'); }, 400);
  }
  function onTap(cardEl, pileEl) {
    if (!state || busy || state.won) return;
    var card = cardOf(cardEl);
    var where = card ? locate(card) : null;
    if ((where && where.pile === 'stock') || (pileEl && pileEl.getAttribute('data-pile') === 'stock')) { flipStock(); return; }
    if (!where || !card.faceUp) return;
    var to = bestTarget(where.pile, where.index);
    if (!to || !doMove(where.pile, where.index, to)) { nudge(cardEl); sfx('bounce'); }
  }
  function canDrag(cardEl) {
    if (!state || busy || state.won) return false;
    var card = cardOf(cardEl), w = card && locate(card);
    return !!(w && runFrom(w.pile, w.index));
  }
  function onPick(cardEl) {
    var card = cardOf(cardEl), w = locate(card), run = runFrom(w.pile, w.index);
    if (!run) return null;
    return { from: w.pile, index: w.index, cards: run, els: run.map(function (c) { return els[c.id]; }) };
  }
  /** Drop rectangle a pile accepts (board px). */
  function dropRect(id) {
    var d = dims(), p = pile(id);
    if (id.charAt(0) === 't' && p.length) {
      var pos = positionsFor(id), last = pos[pos.length - 1];
      return { x: last.left, y: pos[0].top, w: d.w, h: last.top - pos[0].top + d.h + d.fan };
    }
    var o = pileOrigin(id);
    return { x: o.x, y: o.y, w: d.w, h: d.h };
  }
  function overlap(a, b) {
    var w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    return w > 0 && h > 0 ? w * h : 0;
  }
  function inside(pt, r) { return pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h; }
  function onDrop(pick, info) {
    var d = dims(), cards = pick.cards;
    var cardRect = { x: info.cardLeft, y: info.cardTop, w: d.w, h: d.h };
    var targets = PILES.filter(function (id) { return id !== pick.from && (id.charAt(0) === 't' || id.charAt(0) === 'f'); });
    // 1) the legal pile the dragged card overlaps most
    var best = null, bestArea = 0;
    targets.forEach(function (id) {
      if (!legal(cards, id)) return;
      var a = overlap(cardRect, dropRect(id));
      if (a > bestArea) { bestArea = a; best = id; }
    });
    // 2) fling: project the card centre along the release velocity (capped) and look for a legal pile there
    if (!best) {
      var speed = Math.sqrt(info.vx * info.vx + info.vy * info.vy);
      if (speed > 0.6) {
        var t = Math.min(220, 180 / speed * 1.2);
        var c = { x: info.cardLeft + d.w / 2 + info.vx * t, y: info.cardTop + d.h / 2 + info.vy * t };
        targets.forEach(function (id) { if (!best && legal(cards, id) && inside(c, dropRect(id))) best = id; });
      }
    }
    if (!best) { sfx('bounce'); setTimeout(function () { if (state) layoutAll(); }, 450); return false; }
    return doMove(pick.from, pick.index, best);
  }

  /* ---------------------------------------------------------------- hud / timer / stats */
  function fmtTime(ms) { var s = Math.floor(ms / 1000), m = Math.floor(s / 60); s %= 60; return m + ':' + (s < 10 ? '0' : '') + s; }
  function currentElapsed() { return state ? (state.won ? state.elapsedMs : state.elapsedMs + (startedAt ? Date.now() - startedAt : 0)) : 0; }
  function updateHud() {
    if (!state) return;
    $('hud-score').textContent = String(state.score);
    $('hud-time').textContent = fmtTime(currentElapsed());
    $('btn-undo').disabled = !undoStack.length;
  }
  function startTimer() {
    stopTimer();
    if (state.won) return;
    startedAt = Date.now();
    timerId = setInterval(updateHud, 500);
  }
  function stopTimer() {
    if (timerId) { clearInterval(timerId); timerId = null; }
    if (state && startedAt && !state.won) state.elapsedMs += Date.now() - startedAt;
    startedAt = 0;
  }
  function bumpStat(k) { try { localStorage.setItem(k, String(parseInt(localStorage.getItem(k) || '0', 10) + 1)); } catch (e) {} }
  function refreshHome() {
    try {
      $('stat-plays').textContent = localStorage.getItem('deal_plays') || '0';
      $('stat-high').textContent = localStorage.getItem('deal_highScore') || '\u2014';
      var b = localStorage.getItem('deal_bestTimeMs');
      $('stat-best').textContent = b ? fmtTime(+b) : '\u2014';
    } catch (e) {}
    var s = loadSave();
    $('resume-box').hidden = !s;
    if (s) $('resume-detail').textContent = 'Score ' + s.score + ' \u00b7 ' + fmtTime(s.elapsedMs) + ' \u00b7 Draw ' + s.drawCount;
  }

  /* ---------------------------------------------------------------- screens */
  function showScreen(id) {
    ['screen-home', 'screen-play', 'screen-about'].forEach(function (s) { $(s).hidden = (s !== id); });
    document.body.setAttribute('data-screen', id);
  }
  function goHome() {
    if (state && !state.won) { stopTimer(); save(); }
    showScreen('screen-home');
    refreshHome();
  }

  /* ---------------------------------------------------------------- read-only test/debug hook */
  function publicState() {
    if (!state) return null;
    var piles = {};
    PILES.forEach(function (id) {
      piles[id] = pile(id).map(function (c) { return { id: c.id, suit: c.suit, rank: c.rankN, color: c.color, up: !!c.faceUp }; });
    });
    return { piles: piles, score: state.score, moves: state.moves, drawCount: state.drawCount, seed: state.seed,
             won: state.won, undo: undoStack.length, busy: busy, elapsedMs: currentElapsed(),
             screen: document.body.getAttribute('data-screen') };
  }
  var hook = {};
  Object.defineProperty(hook, 'state', { value: function () { return JSON.parse(JSON.stringify(publicState())); } });
  Object.defineProperty(hook, 'scale', { value: function () { return scale; } });
  Object.defineProperty(window, '__dd', { value: Object.freeze(hook) });

  /* ---------------------------------------------------------------- init */
  function init() {
    buildPlanks();
    ensureDeck();
    $('btn-new').addEventListener('click', function () { newGame(); });
    $('btn-resume').addEventListener('click', resumeGame);
    $('btn-redeal').addEventListener('click', function () { newGame({ drawCount: state ? state.drawCount : null }); });
    $('btn-home').addEventListener('click', goHome);
    $('btn-undo').addEventListener('click', undo);
    $('btn-win-new').addEventListener('click', function () { newGame({ drawCount: state ? state.drawCount : null }); });
    $('btn-win-home').addEventListener('click', goHome);
    $('btn-about-back').addEventListener('click', goHome);
    Array.prototype.forEach.call(document.querySelectorAll('.about-link'), function (a) {
      a.addEventListener('click', function (e) { e.preventDefault(); showScreen('screen-about'); });
    });
    ctl = DDPhysics.createController({ root: $('table-scale'), toBoard: toBoard, canDrag: canDrag, onPick: onPick, onDrop: onDrop, onTap: onTap });
    function relayout() { if (!$('screen-play').hidden) { updateScale(); } }
    window.addEventListener('resize', relayout);
    window.addEventListener('orientationchange', relayout);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', relayout);
    document.addEventListener('visibilitychange', function () {
      if (!state || state.won || $('screen-play').hidden) return;
      if (document.hidden) { stopTimer(); save(); } else startTimer();
    });
    window.addEventListener('pagehide', function () { if (state && !state.won && !$('screen-play').hidden) { stopTimer(); save(); } });

    var q = params();
    if (q.draw === '1' && $('opt-draw1')) $('opt-draw1').checked = true;
    if (q.play === '1') {
      if (q.seed != null) newGame({ seed: q.seed, drawCount: q.draw === '1' ? 1 : 3 });
      else if (loadSave()) resumeGame();
      else newGame();
    } else if (location.hash === '#about') showScreen('screen-about');
    else goHome();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
