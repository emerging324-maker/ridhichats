"use strict";
// ══════════════════════════════════════════════════════
//  Living background: drifting glow orbs (CSS), floating embers (canvas) that move away from
//  the finger / mouse, a soft spotlight that follows it, and a spark burst when a dish is added.
//  Light on the phone: few particles, capped resolution, pauses when the app is hidden,
//  and stays still for people who switched off animations in the phone settings.
// ══════════════════════════════════════════════════════
const FX = (() => {
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const root = document.documentElement;
  let cv, ctx, W = 0, H = 0, dpr = 1, raf = 0, last = 0;
  const motes = [], sparks = [], fish = [];
  const ptr = {x:-9999, y:-9999, on:false};
  const COLORS = ["246,185,59", "252,122,42", "255,214,140", "239,68,68"];

  function size(){
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + "px"; cv.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const want = Math.round(Math.min(60, Math.max(22, W * H / 26000)));
    while(motes.length < want) motes.push(newMote(true));
    motes.length = want;
    const nf = Math.round(Math.min(7, Math.max(3, W * H / 250000)));
    while(fish.length < nf) fish.push(newFish());
    fish.length = nf;
    fish.forEach(f => { f.x = Math.min(Math.max(f.x, 40), W - 40); f.y = Math.min(Math.max(f.y, 40), H - 40); });
  }

  // ── Koi fish ──
  // Each fish is a head that steers (wander + stay on screen + flee the finger) and a "spine"
  // of points that follows it like a rope, so the body bends and the tail swings naturally.
  const KOI = [
    {body:["rgba(255,196,92,.95)", "rgba(252,106,26,.85)", "rgba(239,68,68,.25)"], fin:"rgba(255,170,60,.55)", spots:null},
    {body:["rgba(255,245,230,.92)", "rgba(255,226,190,.8)", "rgba(255,200,150,.2)"], fin:"rgba(255,230,200,.5)", spots:"rgba(252,106,26,.9)"},
    {body:["rgba(255,220,130,.95)", "rgba(246,185,59,.85)", "rgba(246,185,59,.2)"], fin:"rgba(255,214,140,.55)", spots:"rgba(239,68,68,.75)"}];
  const SEGS = 10;
  function newFish(){
    const s = (.9 + Math.random() * .6) * (W > 900 ? 1.45 : 1.1), a = Math.random() * 6.2832;
    const f = {x:60 + Math.random() * Math.max(1, W - 120), y:60 + Math.random() * Math.max(1, H - 120), a, v:.32 + Math.random() * .22, boost:0,
      s, seg:5.2 * s, wt:Math.random() * 6.2832, kind:Math.floor(Math.random() * KOI.length), spine:[]};
    for(let i = 0; i < SEGS; i++) f.spine.push({x:f.x - Math.cos(a) * f.seg * i, y:f.y - Math.sin(a) * f.seg * i});
    return f;
  }
  const wrapA = d => { while(d > Math.PI) d -= 6.2832; while(d < -Math.PI) d += 6.2832; return d; };
  function steer(f, target, rate){ const d = wrapA(target - f.a); f.a += Math.max(-rate, Math.min(rate, d)); }
  function moveFish(f, dt){
    const k = dt * .06;
    f.wt += dt * .004;
    f.a += ((Math.random() - .5) * .05 + Math.sin(f.wt) * .014) * k;          // lazy wandering + swimming wiggle
    const m = 80; let tx = 0, ty = 0;                                          // turn back before the edge
    if(f.x < m) tx = 1; else if(f.x > W - m) tx = -1;
    if(f.y < m) ty = 1; else if(f.y > H - m) ty = -1;
    if(tx || ty) steer(f, Math.atan2(ty, tx), .035 * k);
    if(ptr.on){                                                                // dart away from the finger / mouse
      const dx = f.x - ptr.x, dy = f.y - ptr.y, d = Math.hypot(dx, dy);
      if(d < 180){ steer(f, Math.atan2(dy, dx), .12 * k); f.boost = Math.max(f.boost, 2.2 * (1 - d / 180)); }
    }
    f.boost *= Math.pow(.97, k);
    const sp = (f.v + f.boost) * k;
    f.x += Math.cos(f.a) * sp; f.y += Math.sin(f.a) * sp;
    const P = f.spine; P[0].x = f.x; P[0].y = f.y;
    for(let i = 1; i < P.length; i++){
      const dx = P[i - 1].x - P[i].x, dy = P[i - 1].y - P[i].y, d = Math.hypot(dx, dy) || 1;
      if(d > f.seg){ P[i].x = P[i - 1].x - dx / d * f.seg; P[i].y = P[i - 1].y - dy / d * f.seg; }
    }
  }
  function drawFish(f){
    const P = f.spine, n = P.length, C = KOI[f.kind], L = [], R = [];
    const ang = i => i === 0 ? Math.atan2(P[0].y - P[1].y, P[0].x - P[1].x) : Math.atan2(P[i - 1].y - P[i].y, P[i - 1].x - P[i].x);
    for(let i = 0; i < n; i++){
      const t = i / (n - 1), w = f.s * 7.5 * (t < .22 ? .5 + t * 2.3 : (1 - t) * 1.25 + .06), a = ang(i) + Math.PI / 2;
      L.push({x:P[i].x + Math.cos(a) * w, y:P[i].y + Math.sin(a) * w}); R.push({x:P[i].x - Math.cos(a) * w, y:P[i].y - Math.sin(a) * w});
    }
    const ha = ang(0), tail = P[n - 1], ta = ang(n - 1), sway = Math.sin(f.wt * 3.2) * .45;
    // tail fin (two soft lobes that swing)
    ctx.fillStyle = C.fin;
    for(const side of [-1, 1]){
      const fa = ta + Math.PI + side * .55 + sway, len = 15 * f.s;
      ctx.beginPath(); ctx.moveTo(tail.x, tail.y);
      ctx.quadraticCurveTo(tail.x + Math.cos(fa - side * .5) * len * .7, tail.y + Math.sin(fa - side * .5) * len * .7, tail.x + Math.cos(fa) * len, tail.y + Math.sin(fa) * len);
      ctx.quadraticCurveTo(tail.x + Math.cos(ta + Math.PI + sway) * len * .55, tail.y + Math.sin(ta + Math.PI + sway) * len * .55, tail.x, tail.y);
      ctx.fill();
    }
    // side fins
    const fp = P[2], fa2 = ang(2);
    for(const side of [-1, 1]){
      ctx.save(); ctx.translate(fp.x, fp.y); ctx.rotate(fa2 + side * 2.1 + Math.sin(f.wt * 2) * .25 * side);
      ctx.beginPath(); ctx.ellipse(6 * f.s, 0, 7 * f.s, 2.6 * f.s, 0, 0, 6.2832); ctx.fill(); ctx.restore();
    }
    // body
    const g = ctx.createLinearGradient(P[0].x, P[0].y, tail.x, tail.y);
    g.addColorStop(0, C.body[0]); g.addColorStop(.6, C.body[1]); g.addColorStop(1, C.body[2]);
    ctx.fillStyle = g; ctx.beginPath();
    ctx.moveTo(P[0].x + Math.cos(ha) * 5 * f.s, P[0].y + Math.sin(ha) * 5 * f.s);
    for(let i = 0; i < n; i++) ctx.lineTo(L[i].x, L[i].y);
    for(let i = n - 1; i >= 0; i--) ctx.lineTo(R[i].x, R[i].y);
    ctx.closePath(); ctx.fill();
    if(C.spots){
      ctx.fillStyle = C.spots;
      [[2, 3.2], [5, 2.6]].forEach(([i, r]) => { ctx.beginPath(); ctx.arc(P[i].x, P[i].y, r * f.s, 0, 6.2832); ctx.fill(); });
    }
    // eyes
    ctx.fillStyle = "rgba(20,10,5,.75)";
    for(const side of [-1, 1]){ const ea = ha + side * 1.1; ctx.beginPath(); ctx.arc(P[0].x + Math.cos(ea) * 3.4 * f.s, P[0].y + Math.sin(ea) * 3.4 * f.s, 1.1 * f.s, 0, 6.2832); ctx.fill(); }
  }
  // the fish under the finger / a spark burst get startled and swim off fast
  function startle(x, y, r){
    for(const f of fish){ const d = Math.hypot(f.x - x, f.y - y); if(d < r){ f.a = Math.atan2(f.y - y, f.x - x); f.boost = Math.max(f.boost, 3 * (1 - d / r) + .6); } }
  }
  function newMote(anywhere){
    return {x:Math.random() * W, y:anywhere ? Math.random() * H : H + 10, r:0.6 + Math.random() * 1.8,
      vx:(Math.random() - .5) * .12, vy:-(0.08 + Math.random() * .25), a:.15 + Math.random() * .45,
      tw:Math.random() * Math.PI * 2, c:COLORS[Math.floor(Math.random() * 3)]};
  }
  function draw(t){
    const dt = Math.min(50, t - (last || t)); last = t;
    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = .5;                                    // fish stay soft so the menu is never hard to read
    for(const f of fish){ if(dt) moveFish(f, dt); drawFish(f); }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "lighter";
    for(const m of motes){
      // drift up, wobble, and slide away from the finger
      m.tw += dt * .002;
      let ax = 0, ay = 0;
      if(ptr.on){
        const dx = m.x - ptr.x, dy = m.y - ptr.y, d2 = dx * dx + dy * dy;
        if(d2 < 160 * 160 && d2 > 1){ const d = Math.sqrt(d2), f = (1 - d / 160) * .06; ax = dx / d * f; ay = dy / d * f; }
      }
      m.vx = (m.vx + ax) * .985; m.vy = (m.vy + ay) * .985 - .002;
      m.x += (m.vx + Math.sin(m.tw) * .05) * dt * .06; m.y += m.vy * dt * .06;
      if(m.y < -10 || m.x < -20 || m.x > W + 20) Object.assign(m, newMote(false));
      const a = m.a * (.6 + .4 * Math.sin(m.tw * 1.7));
      const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r * 4);
      g.addColorStop(0, "rgba(" + m.c + "," + a + ")"); g.addColorStop(1, "rgba(" + m.c + ",0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(m.x, m.y, m.r * 4, 0, 6.2832); ctx.fill();
    }
    for(let i = sparks.length - 1; i >= 0; i--){
      const s = sparks[i];
      s.life -= dt; if(s.life <= 0){ sparks.splice(i, 1); continue; }
      s.vx *= .96; s.vy = s.vy * .96 + .02;
      s.x += s.vx * dt * .06; s.y += s.vy * dt * .06;
      const k = s.life / s.max;
      ctx.fillStyle = "rgba(" + s.c + "," + (k * .9) + ")";
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r * (0.4 + k * .6), 0, 6.2832); ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
    raf = requestAnimationFrame(draw);
  }
  function start(){ if(!raf && !reduce && !document.hidden){ last = 0; raf = requestAnimationFrame(draw); } }
  function stop(){ if(raf){ cancelAnimationFrame(raf); raf = 0; } }

  // spotlight + orb parallax follow the finger / mouse (one update per frame at most)
  let pend = false;
  function onMove(e){
    const p = e.touches ? e.touches[0] : e; if(!p) return;
    ptr.x = p.clientX; ptr.y = p.clientY; ptr.on = true;
    if(pend) return; pend = true;
    requestAnimationFrame(() => {
      pend = false;
      root.style.setProperty("--px", ptr.x + "px"); root.style.setProperty("--py", ptr.y + "px");
      root.style.setProperty("--mx", (ptr.x / (W || 1) - .5).toFixed(3)); root.style.setProperty("--my", (ptr.y / (H || 1) - .5).toFixed(3));
    });
  }

  function init(){
    if(document.getElementById("bgFx")) return;
    const wrap = document.createElement("div");
    wrap.id = "bgFx"; wrap.className = "bg-fx"; wrap.setAttribute("aria-hidden", "true");
    wrap.innerHTML = '<div class="orbs"><i class="o1"></i><i class="o2"></i><i class="o3"></i><i class="o4"></i></div><div class="spot"></div><canvas></canvas><div class="grain"></div>';
    document.body.prepend(wrap);
    cv = wrap.querySelector("canvas"); ctx = cv.getContext("2d");
    size();
    window.addEventListener("resize", size);
    window.addEventListener("pointermove", onMove, {passive:true});
    window.addEventListener("touchmove", onMove, {passive:true});
    window.addEventListener("pointerdown", e => { onMove(e); startle(e.clientX, e.clientY, 220); }, {passive:true});
    document.addEventListener("pointerleave", () => { ptr.on = false; });
    // a finger lifted from the screen should not keep the fish away from that spot
    const lift = e => { if(!e.pointerType || e.pointerType !== "mouse") setTimeout(() => { ptr.on = false; }, 700); };
    window.addEventListener("pointerup", lift, {passive:true});
    window.addEventListener("touchend", lift, {passive:true});
    document.addEventListener("visibilitychange", () => document.hidden ? stop() : start());
    if(reduce) draw(0), stop(); else start();
  }

  // little burst of sparks, e.g. when a dish is added to the bill
  function burst(x, y, n){
    if(reduce || !ctx) return;
    n = n || 18;
    for(let i = 0; i < n; i++){
      const a = Math.random() * 6.2832, v = 1.5 + Math.random() * 3.5, life = 500 + Math.random() * 450;
      sparks.push({x, y, vx:Math.cos(a) * v, vy:Math.sin(a) * v - 1, r:1.2 + Math.random() * 2, life, max:life, c:COLORS[Math.floor(Math.random() * COLORS.length)]});
    }
    if(sparks.length > 160) sparks.splice(0, sparks.length - 160);
    startle(x, y, 260);
    start();
  }
  function burstAt(el){
    if(!el) return;
    const r = el.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height * .4, 20);
  }
  return {init, burst, burstAt};
})();
