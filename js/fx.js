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
  const motes = [], sparks = [];
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
  }
  function newMote(anywhere){
    return {x:Math.random() * W, y:anywhere ? Math.random() * H : H + 10, r:0.6 + Math.random() * 1.8,
      vx:(Math.random() - .5) * .12, vy:-(0.08 + Math.random() * .25), a:.15 + Math.random() * .45,
      tw:Math.random() * Math.PI * 2, c:COLORS[Math.floor(Math.random() * 3)]};
  }
  function draw(t){
    const dt = Math.min(50, t - (last || t)); last = t;
    ctx.clearRect(0, 0, W, H);
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
    window.addEventListener("pointerdown", onMove, {passive:true});
    document.addEventListener("pointerleave", () => { ptr.on = false; });
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
    start();
  }
  function burstAt(el){
    if(!el) return;
    const r = el.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height * .4, 20);
  }
  return {init, burst, burstAt};
})();
