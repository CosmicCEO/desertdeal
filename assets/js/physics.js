/* Desert Deal — pointer gestures: tap vs drag, fling velocity, bounce home.
   Everything goes through pointer events (mouse + touch + pen). No 'click' reliance:
   a click can be lost when layout shifts between pointerdown and pointerup. */
(function (global) {
  'use strict';

  var reduced = false;
  try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  var DRAG_START_PX = 6;      // client px before a press becomes a drag
  var TAP_MAX_MS = 600;

  function now() { return (window.performance && performance.now) ? performance.now() : Date.now(); }

  /**
   * opts.root       element that receives pointer events (the scaled board)
   * opts.toBoard    (clientX, clientY) -> {x, y} in unscaled board px
   * opts.canDrag    (cardEl) -> bool
   * opts.onPick     (cardEl) -> { els: [cardEl...] } | null    (start of drag)
   * opts.onDrop     (pick, info) -> bool   info = {x, y, vx, vy, dx, dy}  (board px; true = accepted)
   * opts.onTap      (cardEl|null, pileEl|null)
   */
  function createController(opts) {
    var press = null;   // { id, cardEl, pileEl, sx, sy, t, drag: null | {...} }

    function velocity(samples) {
      if (samples.length < 2) return { vx: 0, vy: 0 };
      var b = samples[samples.length - 1], a = samples[0];
      for (var i = samples.length - 2; i >= 0; i--) { a = samples[i]; if (b.t - a.t > 80) break; }
      var dt = Math.max(8, b.t - a.t);
      return { vx: (b.x - a.x) / dt, vy: (b.y - a.y) / dt };   // board px per ms
    }

    function onDown(e) {
      if (press) return;                       // ignore second finger
      if (e.button != null && e.button > 0) return;
      var cardEl = e.target.closest ? e.target.closest('.card-el') : null;
      var pileEl = cardEl ? null : (e.target.closest ? e.target.closest('.pile') : null);
      if (!cardEl && !pileEl) return;
      if (cardEl) e.preventDefault();          // no text selection / ghost image
      press = { id: e.pointerId, cardEl: cardEl, pileEl: pileEl, sx: e.clientX, sy: e.clientY, t: now(), drag: null };
      try { (cardEl || pileEl).setPointerCapture(e.pointerId); } catch (err) {}
    }

    function beginDrag(e) {
      if (!press.cardEl || !opts.canDrag(press.cardEl)) return false;
      var pick = opts.onPick(press.cardEl);
      if (!pick || !pick.els || !pick.els.length) return false;
      var p = opts.toBoard(press.sx, press.sy);
      var items = pick.els.map(function (el, i) {
        var l = parseFloat(el.style.left) || 0, t = parseFloat(el.style.top) || 0;
        el.classList.add('dragging');
        el.classList.remove('bouncing');
        el.style.zIndex = String(500 + i);
        return { el: el, homeL: l, homeT: t, ox: p.x - l, oy: p.y - t };
      });
      press.drag = { pick: pick, items: items, samples: [{ x: p.x, y: p.y, t: now() }] };
      return true;
    }

    function onMove(e) {
      if (!press || e.pointerId !== press.id) return;
      if (!press.drag) {
        var d = Math.abs(e.clientX - press.sx) + Math.abs(e.clientY - press.sy);
        if (d < DRAG_START_PX) return;
        if (!beginDrag(e)) return;
      }
      e.preventDefault();
      var p = opts.toBoard(e.clientX, e.clientY);
      var s = press.drag.samples;
      s.push({ x: p.x, y: p.y, t: now() });
      if (s.length > 8) s.shift();
      press.drag.items.forEach(function (it) {
        it.el.style.left = (p.x - it.ox) + 'px';
        it.el.style.top = (p.y - it.oy) + 'px';
      });
    }

    function bounceHome(items) {
      items.forEach(function (it) {
        it.el.classList.remove('dragging');
        if (!reduced) it.el.classList.add('bouncing');
        it.el.style.left = it.homeL + 'px';
        it.el.style.top = it.homeT + 'px';
        (function (el) { setTimeout(function () { el.classList.remove('bouncing'); }, 420); })(it.el);
      });
    }

    function onUp(e) {
      if (!press || e.pointerId !== press.id) return;
      var pr = press; press = null;
      if (pr.drag) {
        var p = opts.toBoard(e.clientX, e.clientY);
        pr.drag.samples.push({ x: p.x, y: p.y, t: now() });
        var v = reduced ? { vx: 0, vy: 0 } : velocity(pr.drag.samples);
        var first = pr.drag.items[0];
        var info = { x: p.x, y: p.y, vx: v.vx, vy: v.vy,
                     cardLeft: p.x - first.ox, cardTop: p.y - first.oy };
        pr.drag.items.forEach(function (it) { it.el.classList.remove('dragging'); });
        var ok = false;
        try { ok = opts.onDrop(pr.drag.pick, info); } catch (err) { console.error(err); ok = false; }
        if (!ok) bounceHome(pr.drag.items);
        return;
      }
      if (now() - pr.t <= TAP_MAX_MS) opts.onTap(pr.cardEl, pr.pileEl);
    }

    function onCancel(e) {
      if (!press || e.pointerId !== press.id) return;
      var pr = press; press = null;
      if (pr.drag) bounceHome(pr.drag.items);
    }

    var root = opts.root;
    root.addEventListener('pointerdown', onDown);
    root.addEventListener('pointermove', onMove, { passive: false });
    root.addEventListener('pointerup', onUp);
    root.addEventListener('pointercancel', onCancel);
    root.addEventListener('dragstart', function (e) { e.preventDefault(); });

    return { isDragging: function () { return !!(press && press.drag); }, isPressed: function () { return !!press; } };
  }

  /** Short 2D flip (scale-X), swapping face halfway. */
  function flipCard(el, toFaceUp, done) {
    if (reduced) { DDCards.setFace(el, toFaceUp); if (done) done(); return; }
    el.classList.add('flipping');
    el.style.transform = 'scaleX(0.05)';
    setTimeout(function () {
      DDCards.setFace(el, toFaceUp);
      el.style.transform = '';
      setTimeout(function () { el.classList.remove('flipping'); if (done) done(); }, 130);
    }, 120);
  }

  global.DDPhysics = { createController: createController, flipCard: flipCard, reducedMotion: reduced };
})(window);
