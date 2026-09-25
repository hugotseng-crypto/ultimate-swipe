const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const GOAL = 5;
const STALL_MAX = 10;
const R = 16;
const S = { mode: 'menu', us: 0, them: 0, offense: 'us', stall: 0, drag: null, msg: '按住屏幕向外滑', flash: 0, W: 0, H: 0, field: null };
let players = [];
let disc = null;
let last = 0;
function $(id) { return document.getElementById(id); }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function lerp(a, b, t) { return a + (b - a) * t; }
function dbg(t) { const el = $('dbg'); if (el) el.textContent = t; }
function resize() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  S.W = innerWidth; S.H = innerHeight;
  canvas.width = S.W * dpr; canvas.height = S.H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const padX = 18, padY = 58;
  S.field = { x: padX, y: padY, w: S.W - padX * 2, h: S.H - padY - 70 };
  S.field.end = S.field.h * 0.16;
}
addEventListener('resize', resize);
function fieldPoint(fx, fy) { return { x: S.field.x + fx * S.field.w, y: S.field.y + fy * S.field.h }; }
function inField(p, extra) {
  const e = extra || 0;
  return p.x >= S.field.x - e && p.x <= S.field.x + S.field.w + e && p.y >= S.field.y - e && p.y <= S.field.y + S.field.h + e;
}
function inEndzone(p, team) {
  if (team === 'us') return p.y <= S.field.y + S.field.end;
  return p.y >= S.field.y + S.field.h - S.field.end;
}
function makePlayer(team, name, fx, fy) {
  const p = fieldPoint(fx, fy);
  return { team, name, x: p.x, y: p.y, vx: 0, vy: 0, cut: null, cooldown: 0 };
}
function resetPoint(giveTo) {
  S.offense = giveTo; S.stall = 0; S.drag = null;
  const us = giveTo === 'us';
  players = us ? [
    makePlayer('us', 'H', 0.50, 0.72), makePlayer('us', 'C1', 0.28, 0.58), makePlayer('us', 'C2', 0.72, 0.54),
    makePlayer('them', 'M', 0.50, 0.62), makePlayer('them', 'D1', 0.30, 0.46), makePlayer('them', 'D2', 0.70, 0.42)
  ] : [
    makePlayer('them', 'H', 0.50, 0.28), makePlayer('them', 'C1', 0.28, 0.40), makePlayer('them', 'C2', 0.72, 0.44),
    makePlayer('us', 'M', 0.50, 0.38), makePlayer('us', 'D1', 0.30, 0.52), makePlayer('us', 'D2', 0.70, 0.56)
  ];
  const h0 = players.find(p => p.team === giveTo && p.name === 'H') || players.find(p => p.team === giveTo);
  disc = { x: h0.x, y: h0.y, vx: 0, vy: 0, spin: 0, owner: h0, flying: false, target: null };
  S.msg = giveTo === 'us' ? '按住屏幕向外滑，或点短传' : '防守：点我方球员';
  $('phase').textContent = giveTo === 'us' ? '进攻' : '防守';
}
function teamOf(side) { return players.filter(p => p.team === side); }
function others(side) { return players.filter(p => p.team !== side); }
function holder() { return disc && disc.owner; }
function canThrow() {
  const h = holder();
  return S.mode === 'play' && disc && !disc.flying && h && h.team === 'us';
}
function ptFrom(e) {
  if (e.changedTouches && e.changedTouches.length) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
  if (e.touches && e.touches.length) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  if (typeof e.clientX === 'number') return { x: e.clientX, y: e.clientY };
  return null;
}
function aimStart(pt) {
  if (!pt || S.mode !== 'play') return;
  if (pt.y > innerHeight - 70) return;
  if (!canThrow()) {
    const mine = teamOf('us').sort((a, b) => dist(a, pt) - dist(b, pt))[0];
    if (mine) mine.cut = { x: pt.x, y: pt.y, chase: true };
    dbg('防守点选');
    return;
  }
  S.drag = { x0: pt.x, y0: pt.y, x1: pt.x, y1: pt.y, t0: performance.now() };
  dbg('按住了，向外滑');
}
function aimMove(pt) {
  if (!S.drag || !pt) return;
  S.drag.x1 = pt.x; S.drag.y1 = pt.y;
  dbg('滑动 ' + Math.round(Math.hypot(pt.x - S.drag.x0, pt.y - S.drag.y0)) + 'px');
}
function aimEnd(pt) {
  if (!S.drag) return;
  if (pt) { S.drag.x1 = pt.x; S.drag.y1 = pt.y; }
  const d = S.drag; S.drag = null;
  const len = Math.hypot(d.x1 - d.x0, d.y1 - d.y0);
  const dt = Math.max(16, performance.now() - d.t0);
  if (len < 16) { S.msg = '再滑远一点'; dbg('太短 ' + Math.round(len)); return; }
  dbg('出盘 ' + Math.round(len) + 'px');
  throwDisc(d.x1 - d.x0, d.y1 - d.y0, len, dt);
}
function onTouch(fn) {
  return function (e) {
    if (S.mode !== 'play') return;
    if (e.target && (e.target.id === 'passBtn' || e.target.id === 'startBtn' || e.target.id === 'howBtn')) return;
    e.preventDefault();
    fn(ptFrom(e));
  };
}
window.addEventListener('touchstart', onTouch(aimStart), { passive: false });
window.addEventListener('touchmove', onTouch(aimMove), { passive: false });
window.addEventListener('touchend', onTouch(aimEnd), { passive: false });
window.addEventListener('touchcancel', onTouch(aimEnd), { passive: false });
window.addEventListener('mousedown', function (e) {
  if (e.button !== 0 || S.mode !== 'play') return;
  if (e.target && (e.target.id === 'passBtn' || e.target.id === 'startBtn')) return;
  aimStart({ x: e.clientX, y: e.clientY });
});
window.addEventListener('mousemove', function (e) { if (e.buttons === 1) aimMove({ x: e.clientX, y: e.clientY }); });
window.addEventListener('mouseup', function (e) { aimEnd({ x: e.clientX, y: e.clientY }); });
function nearestTeammate(pt, team) {
  return teamOf(team).filter(p => p !== holder()).sort((a, b) => dist(a, pt) - dist(b, pt))[0];
}
function dumpToNearest() {
  if (!canThrow()) { dbg('现在不能传'); return; }
  const h = holder();
  const t = nearestTeammate(h, 'us');
  if (!t) return;
  throwDisc(t.x - h.x, t.y - h.y, Math.max(90, dist(h, t)), 200);
  dbg('短传');
}
function throwDisc(dx, dy, len, dt) {
  const h = holder();
  if (!h || disc.flying) return;
  const speed = clamp(len * 3.2 + (len / dt) * 420, 220, 620);
  const n = Math.hypot(dx, dy) || 1;
  const aimX = h.x + dx, aimY = h.y + dy;
  const target = nearestTeammate({ x: aimX, y: aimY }, h.team);
  const mix = target && dist(target, { x: aimX, y: aimY }) < 80 ? 0.55 : 0.12;
  const tx = target ? target.x : aimX, ty = target ? target.y : aimY;
  const dirx = lerp(dx / n, (tx - h.x) / (Math.hypot(tx - h.x, ty - h.y) || 1), mix);
  const diry = lerp(dy / n, (ty - h.y) / (Math.hypot(tx - h.x, ty - h.y) || 1), mix);
  const nn = Math.hypot(dirx, diry) || 1;
  disc.owner = null; disc.flying = true; disc.x = h.x; disc.y = h.y;
  disc.vx = dirx / nn * speed; disc.vy = diry / nn * speed;
  disc.spin = (dx / n) * 38; disc.target = target || null; S.stall = 0;
}
function catchDisc(p) {
  disc.flying = false; disc.vx = disc.vy = disc.spin = 0;
  disc.owner = p; disc.x = p.x; disc.y = p.y; disc.target = null; S.stall = 0;
  if (inEndzone(p, p.team)) { score(p.team); return; }
  S.offense = p.team;
  S.msg = p.team === 'us' ? '接住了，再传' : '对方持盘';
  $('phase').textContent = p.team === 'us' ? '进攻' : '防守';
}
function turnover(reason, x, y) {
  const at = { x: clamp(x, S.field.x + 20, S.field.x + S.field.w - 20), y: clamp(y, S.field.y + 20, S.field.y + S.field.h - 20) };
  const next = S.offense === 'us' ? 'them' : 'us';
  const recv = teamOf(next).sort((a, b) => dist(a, at) - dist(b, at))[0];
  recv.x = at.x; recv.y = at.y;
  disc.flying = false; disc.vx = disc.vy = 0; disc.spin = 0;
  disc.owner = recv; disc.x = recv.x; disc.y = recv.y; disc.target = null;
  S.offense = next; S.stall = 0; S.flash = 0.35;
  S.msg = reason + (next === 'us' ? ' · 我方持盘' : ' · 对方持盘');
  $('phase').textContent = next === 'us' ? '进攻' : '防守';
}
function score(team) {
  if (team === 'us') S.us += 1; else S.them += 1;
  $('scoreUs').textContent = S.us; $('scoreThem').textContent = S.them; S.flash = 0.5;
  if (S.us >= GOAL || S.them >= GOAL) {
    S.mode = 'over';
    $('overlay').classList.remove('hide');
    $('overlay').querySelector('h1').textContent = S.us > S.them ? '我方胜' : '对方胜';
    $('overlay').querySelector('p').textContent = S.us + ' : ' + S.them + '　再来一局？';
    $('startBtn').textContent = '再打';
    return;
  }
  S.mode = 'score';
  S.msg = (team === 'us' ? '达阵！' : '对方达阵') + ' 准备开下分';
  setTimeout(() => { if (S.mode !== 'score') return; S.mode = 'play'; resetPoint(team === 'us' ? 'them' : 'us'); }, 900);
}
function moveToward(p, tx, ty, speed, dt) {
  const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
  if (d < 3) { p.vx = p.vy = 0; return; }
  const s = Math.min(speed, d / dt);
  p.vx = dx / d * s; p.vy = dy / d * s;
  p.x += p.vx * dt; p.y += p.vy * dt;
}
function keepIn(p) {
  p.x = clamp(p.x, S.field.x + R, S.field.x + S.field.w - R);
  p.y = clamp(p.y, S.field.y + R, S.field.y + S.field.h - R);
}
function aiCuts(dt) {
  const off = S.offense, defs = others(off), offs = teamOf(off), h = holder();
  offs.forEach((p, i) => {
    if (p === h) { p.vx = p.vy = 0; return; }
    p.cooldown -= dt;
    if (!p.cut || p.cooldown <= 0) {
      const attackFar = off === 'us';
      const deep = Math.random() < 0.45;
      const side = i % 2 === 0 ? 0.22 : 0.78;
      const fy = attackFar ? (deep ? 0.12 + Math.random() * 0.16 : 0.36 + Math.random() * 0.18) : (deep ? 0.72 + Math.random() * 0.16 : 0.46 + Math.random() * 0.18);
      p.cut = fieldPoint(side + (Math.random() - 0.5) * 0.12, fy);
      p.cooldown = 1.1 + Math.random() * 0.9;
    }
    moveToward(p, p.cut.x, p.cut.y, 165, dt); keepIn(p);
  });
  defs.forEach((p, i) => {
    if (p.cut && p.cut.chase && p.team === 'us') {
      if (disc.flying) moveToward(p, disc.x + disc.vx * 0.12, disc.y + disc.vy * 0.12, 190, dt);
      else if (h) moveToward(p, h.x + 28, h.y - 10, 170, dt);
      keepIn(p); return;
    }
    if (i === 0 && h) moveToward(p, h.x, h.y + (off === 'us' ? -26 : 26), 150, dt);
    else {
      const mark = offs.filter(o => o !== h)[i % Math.max(1, offs.length - 1)];
      if (mark) moveToward(p, mark.x, mark.y + (off === 'us' ? -22 : 22), 155, dt);
    }
    keepIn(p);
  });
}
function aiThrow(dt) {
  if (S.offense !== 'them' || !disc || disc.flying || !holder() || holder().team !== 'them') return;
  S._aiThink = (S._aiThink || 0) + dt;
  if (S._aiThink < 0.7 && S.stall < 8) return;
  S._aiThink = 0;
  const h = holder();
  const opts = teamOf('them').filter(p => p !== h);
  const target = opts[0];
  if (!target) return;
  throwDisc(target.x - h.x, target.y - h.y, Math.hypot(target.x - h.x, target.y - h.y), 180);
}
function stepDisc(dt) {
  if (!disc.flying) { if (disc.owner) { disc.x = disc.owner.x; disc.y = disc.owner.y; } return; }
  disc.vx += -disc.vy * disc.spin * 0.0009 * dt * 60;
  disc.vy += disc.vx * disc.spin * 0.0009 * dt * 60;
  disc.vx *= Math.pow(0.86, dt); disc.vy *= Math.pow(0.86, dt);
  disc.x += disc.vx * dt; disc.y += disc.vy * dt; disc.spin *= Math.pow(0.92, dt);
  const speed = Math.hypot(disc.vx, disc.vy);
  if (!inField(disc, 8)) { turnover('出界', disc.x, disc.y); return; }
  let best = null, bestD = 22;
  for (const p of players) {
    const d = dist(p, disc);
    const reach = p.team === S.offense ? 20 : 18;
    if (d < reach && d < bestD) { best = p; bestD = d; }
  }
  if (best) { catchDisc(best); return; }
  if (speed < 28) turnover('盘落地', disc.x, disc.y);
}
function stepStall(dt) {
  if (disc.flying || !holder()) return;
  S.stall += dt;
  if (S.stall >= STALL_MAX) turnover('Stall 超时', holder().x, holder().y);
}
function hud() {
  $('stall').textContent = Math.min(STALL_MAX, Math.floor(S.stall));
  $('stall').className = S.stall >= 8 ? 'hot' : S.stall >= 6 ? 'warn' : '';
  $('hint').textContent = S.msg;
}
function drawField() {
  const f = S.field;
  ctx.fillStyle = '#0b1c10'; ctx.fillRect(0, 0, S.W, S.H);
  ctx.fillStyle = '#1c8d42'; ctx.fillRect(f.x, f.y, f.w, f.h);
  ctx.fillStyle = '#157a38';
  ctx.fillRect(f.x, f.y, f.w, f.end);
  ctx.fillRect(f.x, f.y + f.h - f.end, f.w, f.end);
  ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2; ctx.strokeRect(f.x, f.y, f.w, f.h);
  ctx.beginPath();
  ctx.moveTo(f.x, f.y + f.end); ctx.lineTo(f.x + f.w, f.y + f.end);
  ctx.moveTo(f.x, f.y + f.h - f.end); ctx.lineTo(f.x + f.w, f.y + f.h - f.end);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.font = '700 12px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('达阵区', f.x + f.w / 2, f.y + 16);
  ctx.fillText('达阵区', f.x + f.w / 2, f.y + f.h - 8);
}
function drawPlayers() {
  for (const p of players) {
    ctx.beginPath(); ctx.fillStyle = p.team === 'us' ? '#0a84ff' : '#ff9f0a';
    ctx.arc(p.x, p.y, R, 0, Math.PI * 2); ctx.fill();
    if (disc.owner === p) {
      const pulse = 26 + Math.sin(performance.now() / 180) * 5;
      ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 3; ctx.stroke();
      ctx.beginPath(); ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 2;
      ctx.arc(p.x, p.y, pulse, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.fillStyle = '#fff'; ctx.font = '800 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(p.name, p.x, p.y);
  }
}
function drawDisc() {
  ctx.beginPath(); ctx.fillStyle = '#f4f4f0'; ctx.arc(disc.x, disc.y, 8, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.strokeStyle = '#c9c4b8'; ctx.lineWidth = 2; ctx.arc(disc.x, disc.y, 5, 0, Math.PI * 2); ctx.stroke();
}
function drawDrag() {
  if (!S.drag || !holder()) return;
  const d = S.drag, h = holder(), dx = d.x1 - d.x0, dy = d.y1 - d.y0;
  ctx.beginPath(); ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 4; ctx.setLineDash([8, 6]);
  ctx.moveTo(h.x, h.y); ctx.lineTo(h.x + dx, h.y + dy); ctx.stroke(); ctx.setLineDash([]);
}
function loop(t) {
  const dt = Math.min(0.033, (t - last) / 1000 || 0.016); last = t;
  if (S.mode === 'play') { aiCuts(dt); aiThrow(dt); stepDisc(dt); stepStall(dt); S.flash = Math.max(0, S.flash - dt); }
  drawField();
  if (players.length) { drawPlayers(); drawDisc(); drawDrag(); }
  if (S.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + (S.flash * 0.25) + ')'; ctx.fillRect(0, 0, S.W, S.H); }
  hud(); requestAnimationFrame(loop);
}
function startGame() {
  S.mode = 'play'; S.us = 0; S.them = 0;
  $('scoreUs').textContent = '0'; $('scoreThem').textContent = '0';
  $('overlay').classList.add('hide'); resetPoint('us');
  dbg('已开始，向外滑或点短传');
}
$('startBtn').onclick = startGame;
$('startBtn').ontouchend = function (e) { e.preventDefault(); startGame(); };
$('passBtn').onclick = dumpToNearest;
$('passBtn').ontouchend = function (e) { e.preventDefault(); dumpToNearest(); };
$('howBtn').onclick = function () {
  $('overlay').querySelector('p').textContent = '点开打后按住屏幕向外滑。不行就点绿色短传。';
};
resize(); requestAnimationFrame(loop);
