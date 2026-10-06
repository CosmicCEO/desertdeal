#!/usr/bin/env python3
"""
Desert Deal end-to-end play test (Playwright, headless Chromium, real pointer input).

  python3 -m http.server 8899            # from the repo root, in another shell
  pip install playwright && playwright install chromium
  python3 dev/test_play.py               # phone (390x844, touch) + desktop (1440x900, mouse)
  python3 dev/test_play.py --find-seed   # search for a deterministic seed the greedy player wins

What it does at each size: deals a fixed seed (Draw 1), then plays a whole game with a greedy
player. Every move is sent through the real UI (tap or touch/mouse drag); after each one the
game's state (read-only window.__dd.state()) must equal a Python model of the rules. It also checks:
illegal drop bounces back, illegal tap does nothing, undo, reload + Resume, face-down flip on
uncover, King to empty column, win banner, plays / high score / best time.
"""
import argparse, asyncio, copy, json, os, sys, time

from playwright.async_api import async_playwright

BASE = os.environ.get('DD_URL', 'http://127.0.0.1:8899/')
SEED = os.environ.get('DD_SEED', '43')        # found with --find-seed: greedy player wins it at Draw 1 in 107 moves
DRAW = 1
FS = ['spades', 'hearts', 'diamonds', 'clubs']
TABS = ['t%d' % i for i in range(7)]
PILES = ['stock', 'waste', 'f0', 'f1', 'f2', 'f3'] + TABS
HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(HERE, 'screenshots')

# ------------------------------------------------------------------ rules model (mirrors assets/js/game.js)
def is_red(c): return c['color'] == 'red'
def can_found(P, c, fi):
    if FS[fi] != c['suit']: return False
    f = P['f%d' % fi]
    return (f[-1]['rank'] == c['rank'] - 1) if f else c['rank'] == 1
def can_tab(P, c, ti):
    t = P['t%d' % ti]
    if not t: return c['rank'] == 13
    top = t[-1]
    return top['up'] and is_red(top) != is_red(c) and top['rank'] == c['rank'] + 1
def run_from(P, frm, idx):
    p = P[frm]
    if idx >= len(p) or not p[idx]['up'] or frm == 'stock': return None
    if (frm == 'waste' or frm[0] == 'f') and idx != len(p) - 1: return None
    for a, b in zip(p[idx:], p[idx + 1:]):
        if not b['up'] or is_red(a) == is_red(b) or a['rank'] != b['rank'] + 1: return None
    return p[idx:]
def legal(P, run, to):
    if to[0] == 'f': return len(run) == 1 and can_found(P, run[0], int(to[1]))
    return can_tab(P, run[0], int(to[1]))
def best_target(P, frm, idx):
    run = run_from(P, frm, idx)
    if not run: return None
    if len(run) == 1 and frm[0] != 'f':
        fi = FS.index(run[0]['suit'])
        if can_found(P, run[0], fi): return 'f%d' % fi
    empty = None
    for t in range(7):
        tid = 't%d' % t
        if tid == frm: continue
        if not P[tid]:
            empty = empty or tid
            continue
        if can_tab(P, run[0], t): return tid
    if empty and run[0]['rank'] == 13 and not (frm[0] == 't' and idx == 0): return empty
    return None

def apply(S, mv):
    """Return a new model state after move mv. S = {'piles':..., 'score':int}."""
    S = copy.deepcopy(S); P = S['piles']
    if mv[0] == 'draw':
        if P['stock']:
            for _ in range(min(DRAW, len(P['stock']))):
                c = P['stock'].pop(); c['up'] = True; P['waste'].append(c)
        else:
            while P['waste']:
                c = P['waste'].pop(); c['up'] = False; P['stock'].append(c)
            S['score'] = max(0, S['score'] - 2)
        return S
    _, frm, idx, to = mv
    run = P[frm][idx:]; del P[frm][idx:]; P[to].extend(run)
    if to[0] == 'f': S['score'] += 10
    elif frm == 'waste': S['score'] += 5
    elif frm[0] == 'f': S['score'] = max(0, S['score'] - 15)
    if frm[0] == 't' and P[frm] and not P[frm][-1]['up']: P[frm][-1]['up'] = True
    return S

def policy(P):
    """Deterministic greedy player. Returns ('move', frm, idx, to) or ('draw',)."""
    for src in TABS + ['waste']:
        if P[src] and P[src][-1]['up']:
            c = P[src][-1]; fi = FS.index(c['suit'])
            if can_found(P, c, fi): return ('move', src, len(P[src]) - 1, 'f%d' % fi)
    for i, tid in enumerate(TABS):
        col = P[tid]
        k = next((n for n, c in enumerate(col) if c['up']), None)
        if k is None or k == 0: continue
        for j in range(7):
            if j != i and P[TABS[j]] and can_tab(P, col[k], j): return ('move', tid, k, TABS[j])
        if col[k]['rank'] == 13:
            for j in range(7):
                if not P[TABS[j]]: return ('move', tid, k, TABS[j])
    if P['waste']:
        c = P['waste'][-1]
        for j in range(7):
            if P[TABS[j]] and can_tab(P, c, j): return ('move', 'waste', len(P['waste']) - 1, TABS[j])
        if c['rank'] == 13:
            for j in range(7):
                if not P[TABS[j]]: return ('move', 'waste', len(P['waste']) - 1, TABS[j])
    if P['stock'] or P['waste']: return ('draw',)
    return None

def won(P): return all(len(P['f%d' % i]) == 13 for i in range(4))

def simulate(P0, limit=2000):
    """Play the greedy policy on a model. Returns (won, moves list, features)."""
    S = {'piles': copy.deepcopy(P0), 'score': 0}; moves = []; idle = 0
    feats = {'king_empty': 0, 'run': 0, 'waste_tab': 0, 'ace': 0, 'reveal': 0, 'recycle': 0}
    while len(moves) < limit and not won(S['piles']):
        P = S['piles']; mv = policy(P)
        if mv is None: break
        if mv[0] == 'draw':
            idle += 1
            if idle > len(P['stock']) + len(P['waste']) + 2: break
            if not P['stock']: feats['recycle'] += 1
        else:
            idle = 0
            _, frm, idx, to = mv
            if to[0] == 't' and not P[to]: feats['king_empty'] += 1
            if frm[0] == 't' and to[0] == 't' and len(P[frm]) - idx >= 2: feats['run'] += 1
            if frm == 'waste' and to[0] == 't': feats['waste_tab'] += 1
            if to[0] == 'f' and P[frm][idx]['rank'] == 1: feats['ace'] += 1
            if frm[0] == 't' and idx > 0 and not P[frm][idx - 1]['up']: feats['reveal'] += 1
        moves.append(mv); S = apply(S, mv)
    return won(S['piles']), moves, feats

DEAL_JS = '''(seeds) => seeds.map(seed => {
  const order = DDCards.shuffle(DDCards.createDeck(), String(seed));
  const P = {stock:[],waste:[],f0:[],f1:[],f2:[],f3:[],t0:[],t1:[],t2:[],t3:[],t4:[],t5:[],t6:[]};
  let k = 0;
  const m = (c, up) => ({id:c.id, suit:c.suit, rank:c.rankN, color:c.color, up});
  for (let col = 0; col < 7; col++) for (let n = 0; n <= col; n++) P['t'+col].push(m(order[k++], n === col));
  while (k < order.length) P.stock.push(m(order[k++], false));
  return P;
})'''

# ------------------------------------------------------------------ test harness
class Checks:
    def __init__(self, label): self.label, self.passed, self.failed = label, 0, []
    def ok(self, cond, name, detail=''):
        if cond: self.passed += 1
        else:
            self.failed.append('%s: %s' % (name, detail)); print('   FAIL [%s] %s %s' % (self.label, name, detail))
        return cond

def same(a, b): return json.dumps(a, sort_keys=True) == json.dumps(b, sort_keys=True)
def model_of(st): return {'piles': st['piles'], 'score': st['score']}

class UI:
    def __init__(self, page, touch, checks):
        self.p, self.touch, self.c = page, touch, checks
        self.cdp = None
    async def setup(self):
        if self.touch: self.cdp = await self.p.context.new_cdp_session(self.p)
    async def state(self): return await self.p.evaluate('window.__dd.state()')
    async def scale(self): return await self.p.evaluate('window.__dd.scale()')
    async def rect(self, sel):
        return await self.p.evaluate('(s)=>{const e=document.querySelector(s); if(!e) return null; const r=e.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}}', sel)
    async def wait_ready(self):
        await self.p.wait_for_function('window.__dd && window.__dd.state() && !window.__dd.state().busy', timeout=10000)
        await self.p.wait_for_timeout(250)
    async def tap(self, x, y):
        if self.touch: await self.p.touchscreen.tap(x, y)
        else: await self.p.mouse.click(x, y)
    async def drag(self, x0, y0, x1, y1, steps=14):
        if self.touch:
            T = lambda t, x, y: self.cdp.send('Input.dispatchTouchEvent', {'type': t, 'touchPoints': ([{'x': x, 'y': y}] if t != 'touchEnd' else [])})
            await T('touchStart', x0, y0)
            for i in range(1, steps + 1):
                await T('touchMove', x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps)
                await self.p.wait_for_timeout(12)
            await self.p.wait_for_timeout(60)          # hold still: a placed drop, not a fling
            await T('touchEnd', x1, y1)
        else:
            m = self.p.mouse
            await m.move(x0, y0); await m.down()
            for i in range(1, steps + 1):
                await m.move(x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps)
                await self.p.wait_for_timeout(12)
            await self.p.wait_for_timeout(60)
            await m.up()
    async def grab_point(self, st, frm, idx):
        """A visible point on card idx of pile frm (client px)."""
        if frm == 'stock' and not st['piles']['stock']:
            r = await self.rect('[data-pile="stock"]'); return r['x'] + r['w'] / 2, r['y'] + r['h'] / 2
        cid = st['piles'][frm][idx]['id']
        r = await self.rect('[data-id="%s"]' % cid)
        covered = idx < len(st['piles'][frm]) - 1
        if covered and frm[0] == 't':
            return r['x'] + r['w'] / 2, r['y'] + min(r['h'] / 2, 6 * await self.scale())
        if frm == 'waste': return r['x'] + r['w'] * 0.6, r['y'] + r['h'] / 2
        return r['x'] + r['w'] / 2, r['y'] + r['h'] / 2
    async def drop_point(self, st, to):
        """Where the moved card's centre should end up (client px)."""
        p = st['piles'][to]
        if to[0] == 't' and p:
            r = await self.rect('[data-id="%s"]' % p[-1]['id'])
            fan = 16 * await self.scale()
            return r['x'] + r['w'] / 2, r['y'] + r['h'] / 2 + fan
        r = await self.rect('[data-pile="%s"]' % to)
        return r['x'] + r['w'] / 2, r['y'] + r['h'] / 2
    async def do(self, st, mv, method):
        if mv[0] == 'draw':
            x, y = await self.grab_point(st, 'stock', len(st['piles']['stock']) - 1)
            await self.tap(x, y); return
        _, frm, idx, to = mv
        gx, gy = await self.grab_point(st, frm, idx)
        if method == 'tap':
            await self.tap(gx, gy); return
        r = await self.rect('[data-id="%s"]' % st['piles'][frm][idx]['id'])
        cx, cy = r['x'] + r['w'] / 2, r['y'] + r['h'] / 2
        tx, ty = await self.drop_point(st, to)
        await self.drag(gx, gy, gx + (tx - cx), gy + (ty - cy))
    async def wait_moves(self, before, timeout=3.0):
        t0 = time.time()
        while time.time() - t0 < timeout:
            st = await self.state()
            if st['moves'] != before: 
                await self.p.wait_for_timeout(300)        # let fly / flip animations finish
                return await self.state()
            await self.p.wait_for_timeout(40)
        return await self.state()

async def run_size(browser, label, viewport, touch):
    C = Checks(label)
    ctx = await browser.new_context(viewport=viewport, has_touch=touch, is_mobile=touch, device_scale_factor=2)
    page = await ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    ui = UI(page, touch, C); await ui.setup()
    t_start = time.time()

    await page.goto(BASE + '?play=1&seed=%s&draw=%d' % (SEED, DRAW))
    await ui.wait_ready()
    st = await ui.state()
    expected0 = (await page.evaluate(DEAL_JS, [SEED]))[0]
    C.ok(same(st['piles'], expected0), 'deterministic deal for seed')
    C.ok(await page.evaluate("localStorage.getItem('deal_plays')") == '1', 'plays count = 1 after first deal')
    # every card is hit-testable (the original bug: cards inherited pointer-events:none)
    top_id = st['piles']['t6'][-1]['id']
    r = await ui.rect('[data-id="%s"]' % top_id)
    hit = await page.evaluate('([x,y])=>{const e=document.elementFromPoint(x,y); const c=e&&e.closest(".card-el"); return c?c.dataset.id:(e?e.className:null)}', [r['x'] + r['w'] / 2, r['y'] + r['h'] / 2])
    C.ok(hit == top_id, 'card is the hit target under the finger', hit)
    C.ok(await page.evaluate("getComputedStyle(document.querySelector('.card-el')).pointerEvents") == 'auto', 'cards have pointer-events:auto')

    model = model_of(st)
    stats = {'tap': 0, 'drag': 0, 'draw': 0}
    cov = {k: 0 for k in ['waste_tab_drag', 'ace_drag', 'run_drag', 'king_empty', 'reveal_dom', 'recycle', 'illegal_drop', 'illegal_tap', 'undo', 'resume']}
    step = 0; idle = 0; shot_done = False
    while not won(model['piles']) and step < 1500:
        P = model['piles']; mv = policy(P)
        if mv is None: break
        if mv[0] == 'draw':
            idle += 1
            if idle > len(P['stock']) + len(P['waste']) + 2: break
        else: idle = 0

        # one-off checks woven into the game ------------------------------------
        if step == 4 and not cov['illegal_drop']:
            # drag the top card of a column onto a column/foundation where it is illegal
            for i in range(7):
                src = P[TABS[i]]
                if not src or not src[-1]['up']: continue
                bad = next((TABS[j] for j in range(7) if j != i and P[TABS[j]] and not can_tab(P, src[-1], j)), None)
                if not bad: continue
                before = await ui.rect('[data-id="%s"]' % src[-1]['id'])
                await ui.do(st, ('move', TABS[i], len(src) - 1, bad), 'drag')
                await page.wait_for_timeout(700)
                after_st = await ui.state()
                after = await ui.rect('[data-id="%s"]' % src[-1]['id'])
                C.ok(same(model_of(after_st), model) and after_st['moves'] == st['moves'], 'illegal drop leaves state unchanged')
                C.ok(abs(after['x'] - before['x']) < 2 and abs(after['y'] - before['y']) < 2, 'illegal drop bounces card home', '%s -> %s' % (before, after))
                cov['illegal_drop'] = 1
                break
        if step == 5 and not cov['illegal_tap']:
            for i in range(7):
                src = P[TABS[i]]
                if src and src[-1]['up'] and best_target(P, TABS[i], len(src) - 1) is None:
                    x, y = await ui.grab_point(st, TABS[i], len(src) - 1)
                    await ui.tap(x, y); await page.wait_for_timeout(500)
                    s2 = await ui.state()
                    C.ok(same(model_of(s2), model) and s2['moves'] == st['moves'], 'tap with no legal move does nothing')
                    cov['illegal_tap'] = 1
                    break

        # choose input method --------------------------------------------------
        method = 'tap'
        if mv[0] == 'move':
            _, frm, idx, to = mv
            force_drag = (frm == 'waste' and to[0] == 't' and not cov['waste_tab_drag']) or \
                         (to[0] == 'f' and P[frm][idx]['rank'] == 1 and not cov['ace_drag']) or \
                         (frm[0] == 't' and to[0] == 't' and len(P[frm]) - idx >= 2 and not cov['run_drag']) or \
                         (to[0] == 't' and not P[to] and not cov['king_empty'])
            tap_ok = best_target(P, frm, idx) == to
            method = 'drag' if (force_drag or not tap_ok or step % 2 == 1) else 'tap'
        else:
            method = 'draw'

        before_model = model
        exp = apply(model, mv)
        await ui.do(st, mv, method)
        st2 = await ui.wait_moves(st['moves'])
        if won(exp['piles']) and st2['won']:
            # the winning move adds the time bonus (docs/RULES.md): max(0, 700000 - elapsed_ms) / 1000
            bonus = max(0, (700000 - st2['elapsedMs']) // 1000)
            C.ok(st2['score'] == exp['score'] + bonus, 'win adds the time bonus', '%s vs %s + %s' % (st2['score'], exp['score'], bonus))
            exp = dict(exp, score=st2['score'])
        good = C.ok(st2['moves'] == st['moves'] + 1 and same(model_of(st2), exp), 'move %d %s via %s' % (step, mv, method),
                    'moves %s->%s' % (st['moves'], st2['moves']))
        if not good:
            await page.screenshot(path=os.path.join(SHOTS, 'fail-%s-step%d.png' % (label, step)))
            break
        stats[method] += 1
        if mv[0] == 'draw' and not P['stock']: cov['recycle'] += 1
        if mv[0] == 'move':
            _, frm, idx, to = mv
            if method == 'drag':
                if frm == 'waste' and to[0] == 't': cov['waste_tab_drag'] += 1
                if to[0] == 'f' and P[frm][idx]['rank'] == 1: cov['ace_drag'] += 1
                if frm[0] == 't' and to[0] == 't' and len(P[frm]) - idx >= 2: cov['run_drag'] += 1
            if to[0] == 't' and not P[to]: cov['king_empty'] += 1
            if frm[0] == 't' and idx > 0 and not P[frm][idx - 1]['up']:
                rid = exp['piles'][frm][-1]['id']
                cls = await page.evaluate('(id)=>document.querySelector(`[data-id="${id}"]`).className', rid)
                if C.ok('faceup' in cls, 'uncovered card is shown face up', cls): cov['reveal_dom'] += 1
        model = exp; st = st2; step += 1

        # undo: take the move back, check, then play it again ----------------------
        if not cov['undo'] and step >= 8 and mv[0] == 'move':
            await page.click('#btn-undo'); await page.wait_for_timeout(400)
            su = await ui.state()
            C.ok(same(model_of(su), before_model), 'undo restores the previous position')
            await ui.do(su, mv, 'drag'); st = await ui.wait_moves(su['moves'])
            C.ok(same(model_of(st), model), 'move replays after undo')
            cov['undo'] = 1

        # reload mid-game and resume ------------------------------------------------
        if step == 30 and not cov['resume']:
            if not shot_done:
                await page.screenshot(path=os.path.join(SHOTS, '%s-midgame.png' % label)); shot_done = True
            await page.goto(BASE)
            await page.wait_for_selector('#btn-resume', state='visible', timeout=5000)
            C.ok(await page.is_visible('#resume-box'), 'home shows Resume after reload')
            await page.click('#btn-resume'); await ui.wait_ready()
            sr = await ui.state()
            C.ok(same(model_of(sr), model) and sr['moves'] == st['moves'], 'resume restores the exact position and score')
            C.ok(await page.evaluate("localStorage.getItem('deal_plays')") == '1', 'resume does not count as a new play')
            st = sr; cov['resume'] = 1

    # end of game ---------------------------------------------------------------
    C.ok(step >= 15, 'at least 15 legal moves played', str(step))
    is_won = won(model['piles'])
    C.ok(is_won, 'game played through to a win', 'stopped at step %d' % step)
    if is_won:
        st = await ui.state()
        C.ok(st['won'], 'game reports won')
        await page.wait_for_selector('#win-banner', state='visible', timeout=3000)
        C.ok(await page.is_visible('#win-banner'), 'win banner shows')
        await page.screenshot(path=os.path.join(SHOTS, '%s-win.png' % label))
        hi = await page.evaluate("localStorage.getItem('deal_highScore')")
        best = await page.evaluate("localStorage.getItem('deal_bestTimeMs')")
        C.ok(hi is not None and int(hi) == st['score'] and int(hi) > 0, 'high score saved', str(hi))
        C.ok(best is not None and int(best) > 0, 'best time saved', str(best))
        C.ok(await page.evaluate("localStorage.getItem('deal_save')") is None, 'finished game clears the autosave')
        await page.click('#btn-win-home')
        C.ok((await page.text_content('#stat-high')).strip() == hi, 'home shows high score')
        C.ok((await page.text_content('#stat-best')).strip() not in ('', '\u2014'), 'home shows best time')
        C.ok(not await page.is_visible('#resume-box'), 'no Resume offered after a win')
    for k, v in cov.items():
        C.ok(v > 0, 'covered: %s' % k)
    C.ok(stats['tap'] >= 3 and stats['drag'] >= 3, 'both tap and drag used', str(stats))
    C.ok(not errors, 'no page errors', '; '.join(errors[:3]))
    await ctx.close()
    print('[%s] %d moves (tap %d, drag %d, draw %d) in %.0fs -> %d passed, %d failed' % (
        label, step, stats['tap'], stats['drag'], stats['draw'], time.time() - t_start, C.passed, len(C.failed)))
    return C

async def find_seed(n):
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page()
        await pg.goto(BASE); await pg.wait_for_function('window.DDCards')
        deals = await pg.evaluate(DEAL_JS, list(range(1, n + 1)))
        await b.close()
    wins = []
    for seed, P0 in enumerate(deals, 1):
        w, moves, f = simulate(P0)
        if w: wins.append((seed, len(moves), f))
    print('%d of %d seeds won by the greedy player (Draw %d)' % (len(wins), n, DRAW))
    for s, m, f in wins:
        good = all(f[k] for k in ['king_empty', 'run', 'waste_tab', 'ace', 'reveal', 'recycle'])
        print(('* ' if good else '  ') + 'seed %-5d moves %-4d %s' % (s, m, f))

async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--find-seed', type=int, nargs='?', const=300)
    ap.add_argument('--only', choices=['phone', 'desktop'])
    a = ap.parse_args()
    if a.find_seed: return await find_seed(a.find_seed)
    os.makedirs(SHOTS, exist_ok=True)
    sizes = [('phone', {'width': 390, 'height': 844}, True), ('desktop', {'width': 1440, 'height': 900}, False)]
    results = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for label, vp, touch in sizes:
            if a.only and a.only != label: continue
            results.append(await run_size(b, label, vp, touch))
        await b.close()
    print('\nSUMMARY')
    bad = 0
    for C in results:
        print('  %-8s %3d passed, %d failed' % (C.label, C.passed, len(C.failed)))
        for f in C.failed: print('      - ' + f)
        bad += len(C.failed)
    sys.exit(1 if bad else 0)

if __name__ == '__main__':
    asyncio.run(main())
