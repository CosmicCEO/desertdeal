/* Desert Deal — deck model + seeded defect overlays + card DOM. */
(function (global) {
  'use strict';

  var SUITS = [
    { id: 'spades',   sym: '♠', color: 'black' },
    { id: 'hearts',   sym: '♥', color: 'red' },
    { id: 'diamonds', sym: '♦', color: 'red' },
    { id: 'clubs',    sym: '♣', color: 'black' }
  ];
  var RANKS = [
    { id: 'A', n: 1, label: 'A' },
    { id: '2', n: 2, label: '2' },
    { id: '3', n: 3, label: '3' },
    { id: '4', n: 4, label: '4' },
    { id: '5', n: 5, label: '5' },
    { id: '6', n: 6, label: '6' },
    { id: '7', n: 7, label: '7' },
    { id: '8', n: 8, label: '8' },
    { id: '9', n: 9, label: '9' },
    { id: '10', n: 10, label: '10' },
    { id: 'J', n: 11, label: 'J' },
    { id: 'Q', n: 12, label: 'Q' },
    { id: 'K', n: 13, label: 'K' }
  ];

  function hashId(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function seeded(id) {
    var h = hashId(id);
    return {
      next: function () {
        h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
        return h / 4294967296;
      }
    };
  }

  /** Deterministic defects for a card id (e.g. "AS", "10H"). */
  function defectsFor(cardId) {
    var rng = seeded('defect:' + cardId);
    var list = [];
    if (rng.next() < 0.55) {
      list.push({
        kind: 'bleach',
        style: 'left:' + (10 + rng.next() * 40).toFixed(1) + '%;top:' + (5 + rng.next() * 30).toFixed(1) + '%;'
      });
    }
    if (rng.next() < 0.42) {
      list.push({
        kind: 'coffee',
        style: 'left:' + (20 + rng.next() * 40).toFixed(1) + '%;top:' + (25 + rng.next() * 35).toFixed(1) + '%;'
      });
    }
    if (rng.next() < 0.7) {
      list.push({ kind: 'scuff', style: '' });
    }
    if (rng.next() < 0.35) {
      list.push({ kind: 'crease', style: '' });
    }
    if (rng.next() < 0.28) {
      list.push({ kind: 'dogear', style: '' });
    }
    // slight border wobble
    var wobble =
      (5 + rng.next() * 3).toFixed(1) + 'px ' +
      (6 + rng.next() * 3).toFixed(1) + 'px ' +
      (5 + rng.next() * 2).toFixed(1) + 'px ' +
      (6 + rng.next() * 2).toFixed(1) + 'px / ' +
      (6 + rng.next() * 2).toFixed(1) + 'px ' +
      (5 + rng.next() * 2).toFixed(1) + 'px ' +
      (7 + rng.next() * 2).toFixed(1) + 'px ' +
      (5 + rng.next() * 2).toFixed(1) + 'px';
    return { list: list, radius: wobble, tip: (rng.next() * 2.4 - 1.2).toFixed(2) };
  }

  function cardId(suit, rank) {
    return rank.id + suit.id.charAt(0).toUpperCase();
  }

  function createDeck() {
    var deck = [];
    for (var s = 0; s < SUITS.length; s++) {
      for (var r = 0; r < RANKS.length; r++) {
        var suit = SUITS[s], rank = RANKS[r];
        var id = cardId(suit, rank);
        deck.push({
          id: id,
          suit: suit.id,
          suitSym: suit.sym,
          color: suit.color,
          rank: rank.id,
          rankN: rank.n,
          rankLabel: rank.label,
          faceUp: false,
          defects: defectsFor(id)
        });
      }
    }
    return deck;
  }

  function shuffle(deck, seed) {
    var rng = seeded(String(seed == null ? Date.now() : seed));
    var a = deck.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng.next() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function renderDefects(def) {
    var html = '<div class="defects">';
    for (var i = 0; i < def.list.length; i++) {
      var d = def.list[i];
      html += '<div class="def-' + d.kind + '" style="' + d.style + '"></div>';
    }
    html += '</div>';
    return html;
  }

  function createCardEl(card) {
    var el = document.createElement('div');
    el.className = 'card-el ' + card.color + (card.faceUp ? ' faceup' : ' facedown');
    el.dataset.id = card.id;
    el.style.borderRadius = card.defects.radius;
    el.innerHTML =
      '<div class="face">' +
        '<div class="corner"><span class="rank">' + card.rankLabel + '</span><span class="suit">' + card.suitSym + '</span></div>' +
        '<div class="pip">' + card.suitSym + '</div>' +
        '<div class="corner br"><span class="rank">' + card.rankLabel + '</span><span class="suit">' + card.suitSym + '</span></div>' +
        renderDefects(card.defects) +
      '</div>' +
      '<div class="back">' +
        '<div class="back-tape"></div>' +
        '<div class="back-inner">DD</div>' +
        renderDefects(card.defects) +
      '</div>';
    return el;
  }

  function setFace(el, faceUp) {
    el.classList.toggle('faceup', !!faceUp);
    el.classList.toggle('facedown', !faceUp);
  }

  global.DDCards = {
    SUITS: SUITS,
    RANKS: RANKS,
    createDeck: createDeck,
    shuffle: shuffle,
    createCardEl: createCardEl,
    setFace: setFace,
    defectsFor: defectsFor,
    hashId: hashId
  };
})(typeof window !== 'undefined' ? window : this);
