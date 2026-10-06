/* Desert Deal — Klondike deal, layout, moves, stock flip. Wave 1 scaffold. */
(function () {
  'use strict';

  var FSUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
  var FSYM = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };

  var state = {
    stock: [],
    waste: [],
    foundations: [[], [], [], []],
    tableau: [[], [], [], [], [], [], []],
    drawCount: 3,
    score: 0,
    startedAt: 0,
    elapsedMs: 0,
    undo: null,
    won: false,
    seed: 0
  };

  var els = {};
  var cardMap = {}; // id -> { card, el, pile }
  var drag = null;
  var timerId = null;
  var scale = 1;

  function $(id) { return document.getElementById(id); }

  function cssPx(name) {
    return parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;
  }

  function cardSize() {
    return { w: cssPx('--card-w') || 78, h: cssPx('--card-h') || 110, fan: cssPx('--fan-y') || 26, wfan: cssPx('--waste-fan') || 22 };
  }

  /* —— picnic planks —— */
  function buildPlanks() {
    var host = $('planks');
    if (!host || host.children.length) return;
    var knotSpots = [
      [12, 18], [70, 40], [35, 60], [85, 22], [20, 75], [55, 30], [40, 50]
    ];
    for (var i = 0; i < 7; i++) {
      var p = document.createElement('div');
      p.className = 'plank';
      p.innerHTML = '<div class="bleach"></div>';
      // bolts left + right
      var b1 = document.createElement('div');
      b1.className = 'bolt';
      b1.style.left = '18px';
      p.appendChild(b1);
      var b2 = document.createElement('div');
      b2.className = 'bolt';
      b2.style.right = '18px';
      b2.style.left = 'auto';
      p.appendChild(b2);
      // occasional mid bolt
      if (i % 2 === 0) {
        var b3 = document.createElement('div');
        b3.className = 'bolt';
        b3.style.left = '50%';
        b3.style.marginLeft = '-5px';
        p.appendChild(b3);
      }
      var ks = knotSpots[i];
      if (ks) {
        var k = document.createElement('div');
        k.className = 'knot';
        k.style.left = ks[0] + '%';
        k.style.top = ks[1] + '%';
        p.appendChild(k);
      }
      host.appendChild(p);
    }
    // foundation suit marks
    for (var f = 0; f < 4; f++) {
      var fp = $('pile-f' + f);
      if (fp) {
        fp.dataset.suitSym = FSYM[FSUITS[f]];
        fp.setAttribute('data-suit-sym', FSYM[FSUITS[f]]);
      }
    }
  }

  /* —— scaling —— */
  function updateScale() {
    var stage = $('table-stage');
    var root = $('table-scale');
    if (!stage || !root) return;
    var bw = cssPx('--board-w') || 1100;
    var bh = cssPx('--board-h') || 720;
    // phone CSS may change board size — read computed width of root's style vars via getComputedStyle on :root
    var pad = 8;
    var sw = stage.clientWidth - pad;
    var sh = stage.clientHeight - pad;
    scale = Math.min(sw / bw, sh / bh, 1.15);
    if (!isFinite(scale) || scale <= 0) scale = 1;
    root.style.setProperty('--scale', String(scale));
    root.style.transform = 'scale(' + scale + ')';
  }

  /* —— layout positions (board coords) —— */
  function pileOrigin(pileId) {
    var pile = $('pile-' + pileId.replace(/^(stock|waste|f\d|t\d)$/, function (m) { return m; }));
    // ids: stock, waste, f0.., t0..
    var el = document.querySelector('[data-pile="' + pileId + '"]');
    if (!el) return { x: 0, y: 0 };
    var scaleRoot = $('table-scale');
    var pr = el.getBoundingClientRect();
    var rr = scaleRoot.getBoundingClientRect();
    return {
      x: (pr.left - rr.left) / scale,
      y: (pr.top - rr.top) / scale
    };
  }

  function computePilePositions(pileId) {
    var sz = cardSize();
    var cards = getPileCards(pileId);
    var o = pileOrigin(pileId);
    var fanY = 0, fanX = 0;
    if (pileId.charAt(0) === 't') fanY = sz.fan;
    else if (pileId === 'stock') { fanY = 0.35; fanX = 0.25; }
    else if (pileId.charAt(0) === 'f') { fanY = 0.4; fanX = 0.2; }
    var out = [];
    if (pileId === 'waste') {
      var start = Math.max(0, cards.length - 3);
      for (var w = 0; w < cards.length; w++) {
        var wi = Math.max(0, w - start);
        out.push({
          left: w < start ? o.x : o.x + wi * sz.wfan,
          top: o.y,
          z: 20 + w
        });
      }
      return out;
    }
    for (var i = 0; i < cards.length; i++) {
      out.push({ left: o.x + i * fanX, top: o.y + i * fanY, z: 10 + i });
    }
    return out;
  }

  function layoutAll(animateDeal, skipIds) {
    var sz = cardSize();
    skipIds = skipIds || {};

    function placePile(cards, pileId, fanY, fanX) {
      var o = pileOrigin(pileId);
      fanY = fanY || 0;
      fanX = fanX || 0;
      for (var i = 0; i < cards.length; i++) {
        var c = cards[i];
        var entry = cardMap[c.id];
        if (!entry) continue;
        var el = entry.el;
        entry.pile = pileId;
        entry.index = i;
        DDCards.setFace(el, c.faceUp);
        if (skipIds[c.id]) {
          el.style.zIndex = String(10 + i);
          continue;
        }
        var left = o.x + i * fanX;
        var top = o.y + i * fanY;
        el.style.left = left + 'px';
        el.style.top = top + 'px';
        el.style.zIndex = String(10 + i);
        if (animateDeal) {
          el.classList.remove('deal-in');
          void el.offsetWidth;
          el.style.animationDelay = (i * 0.02) + 's';
          el.classList.add('deal-in');
        }
      }
    }

    placePile(state.stock, 'stock', 0.35, 0.25);
    // waste: show last up to 3 with horizontal fan
    placePile(state.waste, 'waste', 0, 0);
    if (state.waste.length) {
      var o = pileOrigin('waste');
      var start = Math.max(0, state.waste.length - 3);
      for (var w = 0; w < state.waste.length; w++) {
        var wc = state.waste[w];
        var we = cardMap[wc.id];
        if (!we) continue;
        DDCards.setFace(we.el, true);
        we.el.style.zIndex = String(20 + w);
        if (skipIds[wc.id]) continue;
        var wi = Math.max(0, w - start);
        if (w < start) {
          we.el.style.left = o.x + 'px';
          we.el.style.top = o.y + 'px';
        } else {
          we.el.style.left = (o.x + wi * sz.wfan) + 'px';
          we.el.style.top = o.y + 'px';
        }
      }
    }
    for (var f = 0; f < 4; f++) placePile(state.foundations[f], 'f' + f, 0.4, 0.2);
    for (var t = 0; t < 7; t++) placePile(state.tableau[t], 't' + t, sz.fan, 0);

    // stock empty recycle cue
    var stockEl = document.querySelector('[data-pile="stock"]');
    if (stockEl) {
      stockEl.classList.toggle('empty-recycle', state.stock.length === 0 && state.waste.length > 0);
    }
  }

  function mountCards(deck) {
    var host = $('playfield');
    // remove old card els
    Object.keys(cardMap).forEach(function (id) {
      var e = cardMap[id].el;
      if (e && e.parentNode) e.parentNode.removeChild(e);
    });
    cardMap = {};
    for (var i = 0; i < deck.length; i++) {
      var c = deck[i];
      var el = DDCards.createCardEl(c);
      host.appendChild(el);
      cardMap[c.id] = { card: c, el: el, pile: null, index: 0 };
    }
  }

  function allCards() {
    return state.stock.concat(state.waste)
      .concat(state.foundations[0], state.foundations[1], state.foundations[2], state.foundations[3])
      .concat(state.tableau[0], state.tableau[1], state.tableau[2], state.tableau[3],
              state.tableau[4], state.tableau[5], state.tableau[6]);
  }

  /* —— deal —— */
  function newGame(opts) {
    opts = opts || {};
    state.drawCount = opts.drawCount || (els.draw1 && els.draw1.checked ? 1 : 3);
    state.seed = opts.seed != null ? opts.seed : (Date.now() & 0xffffffff);
    state.score = 0;
    state.startedAt = Date.now();
    state.elapsedMs = 0;
    state.undo = null;
    state.won = false;
    state.stock = [];
    state.waste = [];
    state.foundations = [[], [], [], []];
    state.tableau = [[], [], [], [], [], [], []];

    var deck = DDCards.shuffle(DDCards.createDeck(), state.seed);
    // deal tableau
    var i = 0;
    for (var col = 0; col < 7; col++) {
      for (var n = 0; n <= col; n++) {
        var card = deck[i++];
        card.faceUp = (n === col);
        state.tableau[col].push(card);
      }
    }
    while (i < deck.length) {
      var c = deck[i++];
      c.faceUp = false;
      state.stock.push(c);
    }

    mountCards(allCards());
    // bump play count
    bumpPlays();
    showPlay();
    updateScale();
    // wait a frame for layout/pile positions
    requestAnimationFrame(function () {
      layoutAll(true);
      updateHud();
      startTimer();
      // TODO: autosave snapshot
    });
  }

  /* —— rules —— */
  function isRed(card) { return card.color === 'red'; }

  function canStackOnTableau(moving, target) {
    if (!target) return moving.rankN === 13; // king on empty
    return isRed(moving) !== isRed(target) && moving.rankN === target.rankN - 1;
  }

  function canStackOnFoundation(moving, foundation) {
    if (!foundation.length) return moving.rankN === 1 && moving.suit === FSUITS[/* checked by pile */ moving._fIndex != null ? moving._fIndex : -1];
    // better: check suit of pile
    return false;
  }

  function canMoveToFoundation(card, fIndex) {
    var pile = state.foundations[fIndex];
    if (!pile.length) return card.rankN === 1 && card.suit === FSUITS[fIndex];
    var top = pile[pile.length - 1];
    return card.suit === top.suit && card.rankN === top.rankN + 1;
  }

  function getPileCards(pileId) {
    if (pileId === 'stock') return state.stock;
    if (pileId === 'waste') return state.waste;
    if (pileId.charAt(0) === 'f') return state.foundations[+pileId.slice(1)];
    if (pileId.charAt(0) === 't') return state.tableau[+pileId.slice(1)];
    return null;
  }

  function faceUpRunFrom(pileId, index) {
    var pile = getPileCards(pileId);
    if (!pile || !pile[index] || !pile[index].faceUp) return null;
    // must be a valid packed descending alt-color run to the end
    for (var i = index; i < pile.length - 1; i++) {
      var a = pile[i], b = pile[i + 1];
      if (!b.faceUp || isRed(a) === isRed(b) || a.rankN !== b.rankN + 1) return null;
    }
    return pile.slice(index);
  }

  function removeFromPile(pileId, index) {
    var pile = getPileCards(pileId);
    return pile.splice(index, pile.length - index);
  }

  function revealTop(pileId) {
    if (pileId.charAt(0) !== 't') return;
    var pile = getPileCards(pileId);
    if (pile.length) {
      var top = pile[pile.length - 1];
      if (!top.faceUp) {
        top.faceUp = true;
        var el = cardMap[top.id].el;
        DDPhysics.flipCard(el, true);
      }
    }
  }

  function checkWin() {
    var n = 0;
    for (var i = 0; i < 4; i++) n += state.foundations[i].length;
    if (n === 52) {
      state.won = true;
      stopTimer();
      var bonus = Math.max(0, Math.floor((700000 - state.elapsedMs) / 1000));
      state.score += bonus;
      updateHud();
      // TODO: persist high score / best time
      var banner = $('win-banner');
      var detail = $('win-detail');
      if (detail) {
        detail.textContent = 'Score ' + state.score + ' · time ' + formatTime(state.elapsedMs);
      }
      if (banner) banner.hidden = false;
      saveHighIfBetter();
    }
  }

  /* —— stock —— */
  function flipStock() {
    if (drag && drag.isDragging()) return;
    if (state.stock.length === 0) {
      if (!state.waste.length) return;
      // recycle
      while (state.waste.length) {
        var c = state.waste.pop();
        c.faceUp = false;
        state.stock.push(c);
      }
      state.score = Math.max(0, state.score - 2);
      layoutAll(false);
      updateHud();
      return;
    }
    var n = Math.min(state.drawCount, state.stock.length);
    var flipped = [];
    for (var i = 0; i < n; i++) {
      var card = state.stock.pop();
      card.faceUp = true;
      state.waste.push(card);
      flipped.push(card);
    }
    layoutAll(false);
    // animate top waste card flip
    var top = flipped[flipped.length - 1];
    if (top && cardMap[top.id]) {
      DDPhysics.flipCard(cardMap[top.id].el, true);
    }
    updateHud();
  }

  /* —— drag integration —— */
  function pileAtPoint(boardX, boardY) {
    var piles = document.querySelectorAll('.pile');
    var scaleRoot = $('table-scale');
    var rr = scaleRoot.getBoundingClientRect();
    var best = null, bestArea = Infinity;
    for (var i = 0; i < piles.length; i++) {
      var p = piles[i];
      var r = p.getBoundingClientRect();
      var left = (r.left - rr.left) / scale;
      var top = (r.top - rr.top) / scale;
      var w = r.width / scale;
      var h = r.height / scale;
      // expand tableau hit height based on cards
      var pid = p.getAttribute('data-pile');
      if (pid && pid.charAt(0) === 't') {
        var cards = getPileCards(pid);
        var fan = cardSize().fan;
        h = Math.max(h, cardSize().h + Math.max(0, cards.length - 1) * fan);
      }
      if (pid === 'waste') {
        w = Math.max(w, cardSize().w + 2 * cardSize().wfan);
      }
      if (boardX >= left && boardX <= left + w && boardY >= top && boardY <= top + h) {
        var area = w * h;
        if (area < bestArea) { bestArea = area; best = pid; }
      }
    }
    return best;
  }

  function setupDrag() {
    drag = DDPhysics.createDragController({
      scaleRoot: $('table-scale'),
      eventRoot: $('table-scale'),
      getScale: function () { return scale; },
      canDrag: function (el) {
        var id = el.dataset.id;
        var entry = cardMap[id];
        if (!entry) return false;
        var card = entry.card;
        if (!card.faceUp) return false;
        if (entry.pile === 'stock') return false;
        if (entry.pile && entry.pile.charAt(0) === 'f') {
          // allow dragging foundation top only
          var fp = getPileCards(entry.pile);
          return fp[fp.length - 1] === card;
        }
        if (entry.pile === 'waste') {
          return state.waste[state.waste.length - 1] === card;
        }
        if (entry.pile && entry.pile.charAt(0) === 't') {
          return !!faceUpRunFrom(entry.pile, entry.index);
        }
        return false;
      },
      onPick: function (el) {
        var entry = cardMap[el.dataset.id];
        var pileId = entry.pile;
        var run;
        if (pileId.charAt(0) === 't') {
          run = faceUpRunFrom(pileId, entry.index);
        } else {
          run = [entry.card];
        }
        if (!run) return null;
        var stackEls = run.map(function (c) { return cardMap[c.id].el; });
        return {
          stackEls: stackEls,
          cards: run,
          fromPile: pileId,
          fromIndex: entry.index
        };
      },
      onDrop: function (payload, boardX, boardY) {
        var target = pileAtPoint(boardX, boardY);
        var from = payload.home.fromPile;
        var cards = payload.home.cards;
        var moving = cards[0];

        if (!target || target === from || target === 'stock') {
          return { ok: false };
        }

        // waste is not a drop target for moves (only receives from stock)
        if (target === 'waste') return { ok: false };

        var ok = false;
        if (target.charAt(0) === 'f') {
          if (cards.length !== 1) return { ok: false };
          var fi = +target.slice(1);
          ok = canMoveToFoundation(moving, fi);
          if (ok) {
            removeFromPile(from, payload.home.fromIndex);
            state.foundations[fi].push(moving);
            if (from === 'waste' || from.charAt(0) === 't') state.score += 10;
            revealTop(from);
          }
        } else if (target.charAt(0) === 't') {
          var ti = +target.slice(1);
          var dest = state.tableau[ti];
          var top = dest.length ? dest[dest.length - 1] : null;
          ok = canStackOnTableau(moving, top);
          if (ok) {
            var moved = removeFromPile(from, payload.home.fromIndex);
            for (var m = 0; m < moved.length; m++) dest.push(moved[m]);
            if (from === 'waste') state.score += 5;
            if (from.charAt(0) === 'f') state.score = Math.max(0, state.score - 15);
            revealTop(from);
          }
        }

        if (!ok) return { ok: false };

        var positions = computePilePositions(target).slice(-cards.length);
        // layout everyone else immediately; moving stack snaps via physics
        var movingIds = {};
        for (var mi = 0; mi < cards.length; mi++) movingIds[cards[mi].id] = true;
        layoutAll(false, movingIds);
        updateHud();
        checkWin();
        setTimeout(function () { layoutAll(false); }, 320);
        return { ok: true, positions: positions };
      }
    });

    // stock tap (cards live in playfield, not inside the pile div)
    $('playfield').addEventListener('click', function (e) {
      if (drag && drag.isDragging()) return;
      var cardEl = e.target.closest && e.target.closest('.card-el');
      if (cardEl) {
        var entry = cardMap[cardEl.dataset.id];
        if (entry && entry.pile === 'stock') { flipStock(); return; }
        return; // other cards: drag handles them
      }
      var pile = e.target.closest && e.target.closest('.pile');
      if (pile && pile.getAttribute('data-pile') === 'stock') flipStock();
    });
  }

  /* —— hud / timer / stats —— */
  function formatTime(ms) {
    var s = Math.floor(ms / 1000);
    var m = Math.floor(s / 60);
    s = s % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function updateHud() {
    if (els.score) els.score.textContent = String(state.score);
    if (els.time) els.time.textContent = formatTime(state.elapsedMs);
  }

  function startTimer() {
    stopTimer();
    timerId = setInterval(function () {
      if (state.won) return;
      state.elapsedMs = Date.now() - state.startedAt;
      updateHud();
    }, 500);
  }
  function stopTimer() {
    if (timerId) { clearInterval(timerId); timerId = null; }
  }

  function bumpPlays() {
    try {
      var n = parseInt(localStorage.getItem('deal_plays') || '0', 10) + 1;
      localStorage.setItem('deal_plays', String(n));
    } catch (e) {}
    refreshStats();
  }

  function saveHighIfBetter() {
    try {
      var hi = parseInt(localStorage.getItem('deal_highScore') || '0', 10);
      if (state.score > hi) localStorage.setItem('deal_highScore', String(state.score));
      var best = parseInt(localStorage.getItem('deal_bestTimeMs') || '0', 10);
      if (!best || state.elapsedMs < best) localStorage.setItem('deal_bestTimeMs', String(state.elapsedMs));
    } catch (e) {}
    refreshStats();
  }

  function refreshStats() {
    try {
      var plays = localStorage.getItem('deal_plays') || '0';
      var hi = localStorage.getItem('deal_highScore');
      var best = localStorage.getItem('deal_bestTimeMs');
      if ($('stat-plays')) $('stat-plays').textContent = plays;
      if ($('stat-high')) $('stat-high').textContent = hi || '—';
      if ($('stat-best')) $('stat-best').textContent = best ? formatTime(+best) : '—';
    } catch (e) {}
  }

  /* —— screens —— */
  function hideAll() {
    ['screen-home', 'screen-play', 'screen-about'].forEach(function (id) {
      var s = $(id); if (s) s.hidden = true;
    });
  }
  function showHome() {
    stopTimer();
    hideAll();
    $('screen-home').hidden = false;
    refreshStats();
    // resume stub
    if ($('resume-box')) $('resume-box').hidden = true; // TODO: wire deal_save
  }
  function showPlay() {
    hideAll();
    $('screen-play').hidden = false;
    if ($('win-banner')) $('win-banner').hidden = true;
    updateScale();
  }
  function showAbout() {
    hideAll();
    $('screen-about').hidden = false;
  }

  /* —— init —— */
  function init() {
    els.score = $('hud-score');
    els.time = $('hud-time');
    els.draw1 = $('opt-draw1');

    buildPlanks();
    refreshStats();

    $('btn-new').addEventListener('click', function () { newGame(); });
    $('btn-redeal').addEventListener('click', function () { newGame(); });
    $('btn-home').addEventListener('click', showHome);
    $('btn-win-new').addEventListener('click', function () { newGame(); });
    $('btn-win-home').addEventListener('click', showHome);
    $('btn-about-back').addEventListener('click', showHome);
    $('btn-undo').addEventListener('click', function () {
      // TODO: undo last move
    });

    document.querySelectorAll('.about-link').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        showAbout();
      });
    });

    setupDrag();
    window.addEventListener('resize', function () {
      updateScale();
      layoutAll(false);
    });
    // orientation / visual viewport
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', function () {
        updateScale();
        layoutAll(false);
      });
    }

    if (location.hash === '#about') showAbout();
    else showHome();

    // deep link ?play=1
    if (/[?&]play=1/.test(location.search)) newGame();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
