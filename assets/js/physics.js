/* Desert Deal — pointer drag, fling inertia, snap / bounce. No Matter.js. */
(function (global) {
  'use strict';

  var reduced = false;
  try {
    reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) {}

  function now() { return performance.now ? performance.now() : Date.now(); }

  /**
   * @param {Object} opts
   * @param {HTMLElement} opts.layer - drag layer (absolute over playfield)
   * @param {HTMLElement} opts.scaleRoot - element with transform scale
   * @param {function} opts.getScale - () => number
   * @param {function} opts.canDrag - (el) => bool
   * @param {function} opts.onPick - (el, clientX, clientY) => { stackEls, homeRects } | null
   * @param {function} opts.onDrop - (payload, clientX, clientY, velocity) => { ok, targetLeft, targetTop } | { ok:false, bounce:true }
   */
  function createDragController(opts) {
    var active = null;
    var samples = [];

    function boardPoint(clientX, clientY) {
      var root = opts.scaleRoot;
      var r = root.getBoundingClientRect();
      var s = opts.getScale();
      return {
        x: (clientX - r.left) / s,
        y: (clientY - r.top) / s
      };
    }

    function pushSample(x, y, t) {
      samples.push({ x: x, y: y, t: t });
      while (samples.length > 6) samples.shift();
    }

    function velocity() {
      if (samples.length < 2) return { vx: 0, vy: 0 };
      var a = samples[0], b = samples[samples.length - 1];
      var dt = Math.max(16, b.t - a.t);
      return { vx: (b.x - a.x) / dt * 16, vy: (b.y - a.y) / dt * 16 };
    }

    function onPointerDown(e) {
      if (e.button != null && e.button !== 0) return;
      var el = e.target.closest && e.target.closest('.card-el');
      if (!el || !opts.canDrag(el)) return;
      var pick = opts.onPick(el, e.clientX, e.clientY);
      if (!pick || !pick.stackEls || !pick.stackEls.length) return;
      e.preventDefault();
      try { el.setPointerCapture(e.pointerId); } catch (err) {}

      var pt = boardPoint(e.clientX, e.clientY);
      var stack = pick.stackEls;
      var offsets = [];
      for (var i = 0; i < stack.length; i++) {
        var c = stack[i];
        var left = parseFloat(c.style.left) || 0;
        var top = parseFloat(c.style.top) || 0;
        offsets.push({ el: c, ox: pt.x - left, oy: pt.y - top, homeL: left, homeT: top });
        c.classList.add('dragging');
        c.classList.remove('snapping', 'bouncing', 'deal-in');
        // move into drag layer visually by raising z
        c.style.zIndex = String(200 + i);
      }
      samples = [];
      pushSample(pt.x, pt.y, now());
      active = {
        pointerId: e.pointerId,
        offsets: offsets,
        home: pick,
        grabEl: el
      };
    }

    function onPointerMove(e) {
      if (!active || e.pointerId !== active.pointerId) return;
      e.preventDefault();
      var pt = boardPoint(e.clientX, e.clientY);
      pushSample(pt.x, pt.y, now());
      for (var i = 0; i < active.offsets.length; i++) {
        var o = active.offsets[i];
        o.el.style.left = (pt.x - o.ox) + 'px';
        o.el.style.top = (pt.y - o.oy) + 'px';
      }
    }

    function finish(e, cancelled) {
      if (!active || (e && e.pointerId !== active.pointerId)) return;
      var vel = velocity();
      var pt = e ? boardPoint(e.clientX, e.clientY) : null;
      var offsets = active.offsets;
      var home = active.home;
      active = null;

      for (var i = 0; i < offsets.length; i++) {
        offsets[i].el.classList.remove('dragging');
      }

      if (cancelled || !pt) {
        bounceHome(offsets);
        return;
      }

      // optional fling prediction: project a bit ahead
      var dropX = pt.x, dropY = pt.y;
      if (!reduced && (Math.abs(vel.vx) > 2 || Math.abs(vel.vy) > 2)) {
        dropX += vel.vx * 8;
        dropY += vel.vy * 8;
      }

      var result = opts.onDrop({
        stackEls: offsets.map(function (o) { return o.el; }),
        home: home,
        offsets: offsets
      }, dropX, dropY, vel);

      if (result && result.ok) {
        snapTo(offsets, result.positions);
      } else {
        bounceHome(offsets);
      }
    }

    function snapTo(offsets, positions) {
      for (var i = 0; i < offsets.length; i++) {
        var o = offsets[i];
        var p = positions[i];
        o.el.classList.add(reduced ? '' : 'snapping');
        o.el.style.left = p.left + 'px';
        o.el.style.top = p.top + 'px';
        o.el.style.zIndex = String(p.z || 2 + i);
        (function (el) {
          setTimeout(function () { el.classList.remove('snapping'); }, reduced ? 0 : 320);
        })(o.el);
      }
    }

    function bounceHome(offsets) {
      for (var i = 0; i < offsets.length; i++) {
        var o = offsets[i];
        o.el.classList.add(reduced ? '' : 'bouncing');
        o.el.style.left = o.homeL + 'px';
        o.el.style.top = o.homeT + 'px';
        (function (el) {
          setTimeout(function () { el.classList.remove('bouncing'); }, reduced ? 0 : 380);
        })(o.el);
      }
    }

    function onPointerUp(e) { finish(e, false); }
    function onPointerCancel(e) { finish(e, true); }

    var root = opts.eventRoot || document;
    root.addEventListener('pointerdown', onPointerDown, { passive: false });
    root.addEventListener('pointermove', onPointerMove, { passive: false });
    root.addEventListener('pointerup', onPointerUp);
    root.addEventListener('pointercancel', onPointerCancel);

    return {
      destroy: function () {
        root.removeEventListener('pointerdown', onPointerDown);
        root.removeEventListener('pointermove', onPointerMove);
        root.removeEventListener('pointerup', onPointerUp);
        root.removeEventListener('pointercancel', onPointerCancel);
      },
      isDragging: function () { return !!active; },
      reduced: reduced
    };
  }

  /** Animate stock flip: brief rotateY via class. */
  function flipCard(el, toFaceUp, done) {
    if (reduced) {
      DDCards.setFace(el, toFaceUp);
      if (done) done();
      return;
    }
    el.classList.add('flipping');
    el.style.transition = 'transform .14s ease';
    el.style.transform = 'scaleX(0.05)';
    setTimeout(function () {
      DDCards.setFace(el, toFaceUp);
      el.style.transform = 'scaleX(1)';
      setTimeout(function () {
        el.classList.remove('flipping');
        el.style.transition = '';
        el.style.transform = '';
        if (done) done();
      }, 150);
    }, 140);
  }

  global.DDPhysics = {
    createDragController: createDragController,
    flipCard: flipCard,
    reducedMotion: reduced
  };
})(typeof window !== 'undefined' ? window : this);
