"use strict";
// ══════════════════════════════════════════════════════
//  Billing screen: menu, cart, payment, receipt
// ══════════════════════════════════════════════════════

// ── CATEGORIES ──
function catList(){ return (favIds.length ? [FAV] : []).concat(Object.keys(MENU)); }
function catInfo(c){ return c === FAV ? {icon:"⭐", count:favIds.length} : {icon:MENU[c].icon, count:MENU[c].items.length}; }
function renderCats(){
  const cats = catList();
  if(!cats.includes(activeCat)) activeCat = cats[0];
  const custom = c => isOwner() && menuMode === "edit" && c !== FAV && !MENU[c].builtin;
  $("catRail").innerHTML = '<div class="lbl" style="padding:2px 8px 8px;">Categories</div>' + cats.map(c => {
    const i = catInfo(c);
    return '<button class="cat' + (c === activeCat ? " active" : "") + '" data-cat="' + esc(c) + '" onclick="selCat(this.dataset.cat)"><span class="ci">' + esc(i.icon) + '</span><span class="cn">' + esc(c.replace("⭐ ","")) + '</span>'
      + (custom(c) ? '<span class="cc" data-cat="' + esc(c) + '" onclick="event.stopPropagation();openCat(this.dataset.cat)">✏️</span>' : '<span class="cc">' + i.count + "</span>") + "</button>";
  }).join("") + '<button class="cat add owner-only" onclick="openCat()"><span class="ci">+</span><span class="cn">New category</span></button>';
  $("catChips").innerHTML = cats.map(c => {
    const i = catInfo(c);
    return '<button class="chip' + (c === activeCat ? " active" : "") + '" data-cat="' + esc(c) + '" onclick="selCat(this.dataset.cat)">' + esc(i.icon) + " " + esc(c.replace("⭐ ","")) + "</button>";
  }).join("") + '<button class="chip owner-only" onclick="openCat()">+ New</button>';
}
function selCat(c){
  activeCat = c;
  $("srch").value = ""; $("srchX").classList.add("hide");
  renderCats(); renderMenu();
  $("menuScroll").scrollTop = 0;
  const chip = document.querySelector("#catChips .chip.active");
  if(chip && chip.scrollIntoView) chip.scrollIntoView({inline:"center", block:"nearest"});
}

// ── MENU GRID ──
const qtyInCart = id => cart.reduce((s, l) => s + (l.id === id ? l.qty : 0), 0);
function itemsOf(cat){ return cat === FAV ? favIds.map(itemById).filter(Boolean) : (MENU[cat] ? MENU[cat].items : []); }
function renderMenu(){
  const q = $("srch").value.trim().toLowerCase();
  const list = q ? ALL.filter(i => i.name.toLowerCase().includes(q)) : itemsOf(activeCat);
  $("catTitle").textContent = q ? "Search results" : activeCat.replace("⭐ ","");
  $("catCount").textContent = list.length + (list.length === 1 ? " item" : " items");
  $("stockBtn").classList.toggle("on", menuMode === "stock");
  $("editBtn").classList.toggle("on", menuMode === "edit");
  const note = $("modeNote");
  note.classList.toggle("hide", !menuMode);
  note.textContent = menuMode === "stock" ? "Stock mode: tap an item to mark it SOLD OUT for today (tap again to bring it back). Tap Stock to finish."
    : menuMode === "edit" ? "Edit mode: tap an item to change its name, price or photo. Tap Edit to finish." : "";
  let html = list.map(item => {
    const n = qtyInCart(item.id), out = oos.has(item.id);
    const foot = menuMode ? "" : out ? "" : n
      ? '<div class="step" onclick="event.stopPropagation()"><button data-id="' + esc(item.id) + '" onclick="decItem(this.dataset.id)">−</button><span>' + n + '</span><button data-id="' + esc(item.id) + '" onclick="addToCart(this.dataset.id)">+</button></div>'
      : '<span class="plus">+</span>';
    return '<div class="item' + (out ? " oos" : "") + (n && !menuMode && !out ? " in-cart" : "") + (item.id === justAdded ? " pop" : "") + '" data-id="' + esc(item.id) + '" onclick="tapItem(this.dataset.id)">'
      + (out ? '<span class="sold">SOLD OUT</span>' : "")
      + (menuMode === "edit" ? '<span class="edit-badge">✏️ Edit</span>' : "")
      + (n && !menuMode ? '<span class="qty">' + n + "</span>" : "")
      + '<div class="ph">' + thumbHTML(item) + "</div>"
      + '<div class="bd"><div class="nm">' + esc(item.name) + "</div>"
      + (item.includes ? '<div class="inc">' + esc(item.includes) + "</div>" : "")
      + '<div class="ft"><span class="pr">' + fmt(item.price) + "</span>" + foot + "</div></div></div>";
  }).join("");
  justAdded = null;
  if(menuMode === "edit" && !q && activeCat !== FAV) html += '<div class="item addcard" onclick="openItem(null)"><span>+</span>Add item</div>';
  if(!html) html = '<div class="empty" style="grid-column:1/-1;"><div>🔍</div>Nothing found</div>';
  $("menuGrid").innerHTML = html;
}
function doSearch(v){ $("srchX").classList.toggle("hide", !v); renderMenu(); }
function clearSearch(){ $("srch").value = ""; $("srchX").classList.add("hide"); renderMenu(); }
function toggleMode(m){
  if(m === "edit" && !needOwner()) return;
  menuMode = menuMode === m ? "" : m;
  renderCats(); renderMenu();
}
function tapItem(id){
  if(menuMode === "stock"){ oos.has(id) ? oos.delete(id) : oos.add(id); saveOOS(); renderMenu(); return; }
  if(menuMode === "edit"){ openItem(id); return; }
  if(oos.has(id)){ toast("🚫 Sold out today — use Stock to bring it back"); return; }
  addToCart(id);
}

// ── CART ──
let lineSeq = 0, justAdded = null; // justAdded: the dish that just went into the bill (blooms once)
const getSub = () => cart.reduce((s, l) => s + l.price * l.qty, 0);
const getDA = () => Math.min(getSub(), discType === "percent" ? getSub() * Math.min(disc, 100) / 100 : disc);
const getTotal = () => r2(Math.max(0, getSub() - getDA()));
const getGST = () => gstOn ? r2(getTotal() - getTotal() / 1.05) : 0; // 5% GST is already inside the prices
const getIC = () => cart.reduce((s, l) => s + l.qty, 0);
function addToCart(id, qty){
  const item = itemById(id); if(!item) return;
  const plain = cart.find(l => l.id === id && !l.note && l.price === item.price);
  if(plain) plain.qty += qty || 1;
  else cart.push({lid:"l" + (++lineSeq), id:item.id, name:item.name, price:item.price, qty:qty || 1, icon:item.icon, note:"", includes:item.includes || "", combo:!!item.combo});
  playSound("add"); justAdded = id; renderMenu(); renderCart();
  try{ FX.burstAt(document.querySelector('.item[data-id="' + CSS.escape(id) + '"]')); }catch(e){}
}
function decItem(id){
  for(let i = cart.length - 1; i >= 0; i--) if(cart[i].id === id){ cart[i].qty--; if(cart[i].qty <= 0) cart.splice(i, 1); break; }
  renderMenu(); renderCart();
}
function updQ(lid, d){
  const l = cart.find(x => x.lid === lid); if(!l) return;
  l.qty += d; if(l.qty <= 0) cart = cart.filter(x => x.lid !== lid);
  renderMenu(); renderCart();
}
function resetOrderState(){
  cart = []; disc = 0; discType = "flat"; gstOn = false; cust = {name:"", phone:""}; orderType = "dinein";
  $("discVal").value = ""; $("discType").value = "flat"; $("gstTog").checked = false;
  $("custN").value = ""; $("custP").value = ""; $("custHint").classList.add("hide");
  renderTypeSeg();
}
function clearCart(ask){
  if(ask && cart.length && !confirm("Clear this order?")) return;
  resetOrderState(); renderMenu(); renderCart();
}
function renderTypeSeg(){
  $("typeSeg").innerHTML = ORDER_TYPES.map(t => '<button class="' + (t.id === orderType ? "active" : "") + '" onclick="orderType=\'' + t.id + '\';renderTypeSeg()">' + t.label + "</button>").join("");
}
function renderCart(){
  const has = cart.length > 0;
  $("cartCount").textContent = getIC();
  $("clearBtn").classList.toggle("hide", !has);
  $("orderFoot").classList.toggle("hide", !has);
  const hb = $("heldBtn"); hb.classList.toggle("hide", !held.length); hb.textContent = "⏸ Held (" + held.length + ")";
  $("cartList").innerHTML = !has ? '<div class="cart-empty"><div>🛒</div>Tap items to start a bill</div>' : cart.map(l => {
    const it = itemById(l.id) || l;
    return '<div class="line"><div class="th">' + thumbHTML(it) + '</div><div style="min-width:0;"><div class="ln">' + esc(l.name) + '</div><div class="lp">' + fmt(l.price) + " each</div>"
      + (l.note ? '<div class="note">📝 ' + esc(l.note) + "</div>" : "")
      + '<button class="note-btn" data-lid="' + l.lid + '" onclick="openNote(this.dataset.lid)">' + (l.note ? "Edit note" : "+ Add note") + (l.combo ? " / price" : "") + "</button></div>"
      + '<div class="rt"><span class="amt">' + fmt(l.price * l.qty) + '</span><div class="stepper"><button class="m" data-lid="' + l.lid + '" onclick="updQ(this.dataset.lid,-1)">−</button><span>' + l.qty + '</span><button class="p" data-lid="' + l.lid + '" onclick="updQ(this.dataset.lid,1)">+</button></div></div></div>';
  }).join("");
  renderTotals();
}
function renderTotals(){
  const sub = getSub(), da = getDA(), gst = getGST(), tot = getTotal();
  $("totals").innerHTML = '<div class="tr"><span>Subtotal</span><span>' + fmt(sub) + "</span></div>"
    + (da > 0 ? '<div class="tr g"><span>Discount</span><span>−' + fmt(da) + "</span></div>" : "")
    + (gstOn ? '<div class="tr"><span>CGST 2.5% (incl.)</span><span>' + fmt(gst / 2) + '</span></div><div class="tr"><span>SGST 2.5% (incl.)</span><span>' + fmt(gst / 2) + "</span></div>" : "")
    + '<div class="tr big"><span>Total</span><span>' + fmt(tot) + "</span></div>";
  $("payBtn").textContent = "Pay " + fmt(tot) + " →";
  const n = getIC();
  $("cbCount").textContent = n + (n === 1 ? " item" : " items");
  $("cbTotal").textContent = fmt(tot);
  $("cartBar").classList.toggle("show", n > 0 || held.length > 0);
}
function toggleOrder(show){
  const p = $("orderPanel"); if(!p) return;
  p.classList.toggle("show", !!show);
  $("orderBackdrop").classList.toggle("show", !!show && window.innerWidth < 900);
}

// ── ITEM NOTES ──
let noteLid = null;
const NOTE_QUICK = ["Less spicy","Extra spicy","No sev","Extra cheese","Extra chutney","Parcel"];
function openNote(lid){
  const l = cart.find(x => x.lid === lid); if(!l) return;
  noteLid = lid;
  $("noteTitle").textContent = l.name;
  $("noteIn").value = l.note || "";
  $("noteQuick").innerHTML = NOTE_QUICK.map(q => '<button class="chip" onclick="document.getElementById(\'noteIn\').value=this.textContent">' + q + "</button>").join("");
  $("notePriceWrap").classList.toggle("hide", !l.combo);
  $("notePrice").value = l.price;
  openM("noteMod");
}
function saveNote(){
  const l = cart.find(x => x.lid === noteLid); if(!l) return closeM("noteMod");
  l.note = $("noteIn").value.trim();
  if(l.combo){ const p = num($("notePrice").value); if(p >= 1) l.price = r2(p); }
  closeM("noteMod"); renderCart();
}

// ── HOLD / RESUME ──
function saveHeld(){ lsSet(LS.HELD, held); }
function holdBill(){
  if(!cart.length) return;
  held.unshift({id:Date.now(), time:nowT(), cart, disc, discType, gstOn, cust, orderType});
  saveHeld(); resetOrderState(); renderMenu(); renderCart(); toggleOrder(false);
  toast("⏸ Bill on hold — tap Held to bring it back");
}
function openHeld(){
  $("heldList").innerHTML = held.length ? held.map(h => {
    const tot = h.cart.reduce((s, l) => s + l.price * l.qty, 0), n = h.cart.reduce((s, l) => s + l.qty, 0);
    return '<div class="hc"><div class="h1"><div><div class="tok">' + esc(h.cust && h.cust.name || "Held bill") + ' <span class="tag">' + esc(h.time) + '</span></div><div class="muted small">' + n + " items · " + esc(h.cart.map(l => l.name).slice(0, 3).join(", ")) + (h.cart.length > 3 ? "…" : "") + '</div></div><div class="amt">' + fmt(tot) + "</div></div>"
      + '<div class="row" style="margin-top:10px;"><button class="btn primary sm" onclick="resumeHeld(' + h.id + ')">Resume</button><button class="btn danger sm" onclick="dropHeld(' + h.id + ')">Delete</button></div></div>';
  }).join("") : '<div class="empty"><div>⏸</div>No held bills</div>';
  openM("heldMod");
}
function resumeHeld(id){
  const h = held.find(x => x.id === id); if(!h) return;
  held = held.filter(x => x.id !== id);
  if(cart.length) held.unshift({id:Date.now(), time:nowT(), cart, disc, discType, gstOn, cust, orderType}); // swap with the current bill
  cart = h.cart; disc = num(h.disc); discType = h.discType || "flat"; gstOn = !!h.gstOn; cust = h.cust || {name:"", phone:""}; orderType = h.orderType || "dinein";
  cart.forEach(l => { l.lid = "l" + (++lineSeq); });
  $("discVal").value = disc || ""; $("discType").value = discType; $("gstTog").checked = gstOn;
  $("custN").value = cust.name || ""; $("custP").value = cust.phone || "";
  saveHeld(); closeM("heldMod"); renderTypeSeg(); showCustHint(); renderMenu(); renderCart(); toggleOrder(true);
}
function dropHeld(id){
  if(!confirm("Delete this held bill?")) return;
  held = held.filter(x => x.id !== id); saveHeld(); openHeld(); renderCart();
}

// ── CUSTOMER LOOKUP + LOYALTY ──
function onCustPhone(el){
  el.value = el.value.replace(/\D/g,"").slice(0, 10);
  cust.phone = el.value;
  if(el.value.length === 10){
    const c = customers.get(el.value);
    if(c && c.name && !cust.name){ cust.name = c.name; $("custN").value = c.name; }
  }
  showCustHint();
}
function loyaltyFor(phone){
  if(!(S.loyaltyN > 1) || String(phone).length !== 10) return "";
  const c = customers.get(phone), visit = (c ? c.visits : 0) + 1;
  return visit % S.loyaltyN === 0 ? "Visit #" + visit + " reward: " + (S.loyaltyReward || "Free item") : "";
}
function showCustHint(){
  const el = $("custHint"), c = customers.get(cust.phone);
  const rew = loyaltyFor(cust.phone);
  if(rew){ el.className = "cust-hint reward"; el.textContent = "🎉 " + rew; return; }
  if(cust.phone.length === 10 && c){
    el.className = "cust-hint";
    let t = "Regular: " + c.visits + (c.visits === 1 ? " visit" : " visits") + " · spent " + fmt(c.total) + " · last " + isoNice(c.last);
    if(S.loyaltyN > 1){ const k = (S.loyaltyN - ((c.visits + 1) % S.loyaltyN)) % S.loyaltyN; if(k) t += " · reward after " + k + " more"; }
    el.textContent = t; return;
  }
  el.className = "cust-hint hide";
}

// ── PAYMENT ──
function openPay(){
  if(!cart.length) return;
  const sub = getSub(), da = getDA(), tot = getTotal();
  $("paySummary").innerHTML = '<div class="tr"><span>' + getIC() + " items · " + esc(typeLabel(orderType)) + "</span><span>" + fmt(sub) + "</span></div>"
    + (da > 0 ? '<div class="tr g"><span>Discount</span><span>−' + fmt(da) + "</span></div>" : "")
    + '<div class="tr big" style="margin-top:4px;"><span>To pay</span><span>' + fmt(tot) + "</span></div>";
  $("cashIn").value = "";
  const opts = [...new Set([tot, Math.ceil(tot / 50) * 50, Math.ceil(tot / 100) * 100, Math.ceil(tot / 500) * 500, 500, 2000].filter(v => v >= tot))].slice(0, 5);
  $("cashQuick").innerHTML = opts.map((v, i) => '<button class="chip" onclick="document.getElementById(\'cashIn\').value=' + v + ';renderChange()">' + (i === 0 ? "Exact" : fmt(v)) + "</button>").join("");
  selPM(pm);
  openM("payMod");
}
function selPM(m){
  pm = m;
  ["cash","upi","card"].forEach(x => $("pm-" + x).classList.toggle("active", x === m));
  $("cashBox").classList.toggle("hide", m !== "cash");
  $("upiBox").classList.toggle("hide", m !== "upi");
  if(m === "upi") renderUPI();
  renderChange();
}
function renderChange(){
  const tot = getTotal(), given = num($("cashIn").value), box = $("changeBox");
  $("payConf").textContent = "✓ Confirm " + fmt(tot) + " · " + pm.toUpperCase();
  if(pm !== "cash" || !given){ box.classList.add("hide"); return; }
  box.classList.remove("hide");
  if(given < tot){ box.className = "change short"; box.innerHTML = "<span>Short by</span><span>" + fmt(tot - given) + "</span>"; }
  else { box.className = "change"; box.innerHTML = "<span>Return change</span><span>" + fmt(given - tot) + "</span>"; }
}
function upiLink(amount){
  return "upi://pay?pa=" + encodeURIComponent(S.upiId) + "&pn=" + encodeURIComponent(S.upiName || S.shopName) + "&am=" + r2(amount).toFixed(2) + "&cu=INR&tn=" + encodeURIComponent((S.shopName || "Shop") + " bill");
}
function qrSVG(text){
  const q = qrcode(0, "M"); q.addData(text); q.make();
  const n = q.getModuleCount(), m = 2; let d = "";
  for(let r = 0; r < n; r++) for(let c = 0; c < n; c++) if(q.isDark(r, c)) d += "M" + (c + m) + " " + (r + m) + "h1v1h-1z";
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + (n + m * 2) + " " + (n + m * 2) + '" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
}
function renderUPI(){
  const box = $("upiBox"), tot = getTotal();
  if(!S.upiId){ box.innerHTML = '<div style="font-weight:700;color:var(--gold);">UPI ID not set</div><div class="muted small" style="margin-top:4px;">Owner: add your UPI ID in Settings to show a scan-to-pay QR with the bill amount.</div>'; return; }
  let svg = "";
  try{ svg = qrSVG(upiLink(tot)); }catch(e){ svg = ""; }
  box.innerHTML = '<div class="lbl" style="text-align:center;">Scan to pay ' + fmt(tot) + "</div>" + (svg ? '<div class="qr">' + svg + "</div>" : "")
    + '<div style="font-family:monospace;font-weight:700;">' + esc(S.upiId) + '</div><div class="muted small" style="margin-top:4px;">Amount is filled in automatically. Confirm only after the customer shows "Paid".</div>';
}

// ── PLACE ORDER ──
// Instant: the bill gets its number, the receipt opens and it prints straight away. In the background
// it goes into the "to sync" list and is pushed to the Google Sheet (at once if there is internet,
// otherwise when it returns — see the Sync page). Only if the Sheet is switched off does a pop-up ask
// to connect first.
let placing = false;
async function placeOrder(){
  if(!cart.length || placing) return;
  const tot = getTotal(), given = num($("cashIn").value);
  if(pm === "cash" && given && given < tot){ toast("⚠️ Cash received is less than the bill"); playSound("error"); return; }
  if(!sheetReady(placeOrder)) return;
  placing = true;
  try{
    const now = Date.now();
    const order = {id:now, ts:now, token:nextToken(), date:today(), dateISO:isoToday(), time:nowT(),
      customerName:(cust.name || "").trim(), customerPhone:cust.phone.length === 10 ? cust.phone : "", orderType,
      items:cart.map(l => ({id:l.id, name:l.name, price:l.price, qty:l.qty, icon:l.icon, note:l.note || "", includes:l.includes || ""})),
      subtotal:r2(getSub()), discount:r2(getDA()), gst:getGST(), total:tot, paymentMethod:pm,
      cashGiven:pm === "cash" && given ? given : 0, change:pm === "cash" && given ? r2(given - tot) : 0,
      loyalty:loyaltyFor(cust.phone), status:"paid", by:role || "", kitchenStatus:"preparing"};
    enqueue(Object.assign({type:"order"}, order));
    closeM("payMod"); toggleOrder(false);
    resetOrderState(); renderCats(); renderMenu(); renderCart();
    playSound("payment");
    showReceipt(findOrder(order.id) || order);
    if(S.autoPrint || S.autoKOT) autoPrint(order); // runs inside the Confirm tap, so Bluetooth is allowed
  }finally{ placing = false; }
}

// ── RECEIPT WINDOW ──
function showReceipt(o){
  curReceipt = o;
  $("rcptTitle").textContent = "Bill #" + o.token + (isLive(o) ? "" : " — CANCELLED");
  $("rcptContent").innerHTML = linesHTML(receiptLayout(o));
  openM("rcptMod");
  prnRefreshStatus();
}
function doWA(){
  const o = curReceipt; if(!o) return;
  const lines = o.items.map(i => i.name + " x" + i.qty + " = ₹" + r2(i.price * i.qty) + (i.note ? " (" + i.note + ")" : "")).join("\n");
  const msg = "🍽 *" + S.shopName + "*\n" + [S.tagline, S.address].filter(Boolean).join(" - ") + "\n\n🎫 Token: #" + o.token + "\n📅 " + o.date + " " + o.time + "\n\n" + lines
    + "\n\nSubtotal: ₹" + r2(o.subtotal) + "\n" + (o.discount ? "Discount: -₹" + r2(o.discount) + "\n" : "") + "*Total: ₹" + r2(o.total) + "*\nPayment: " + o.paymentMethod.toUpperCase()
    + (o.loyalty ? "\n🎉 " + o.loyalty : "") + "\n\n🙏 " + (S.footer || "Thank you!");
  window.open("https://wa.me/" + (o.customerPhone ? "91" + o.customerPhone : "") + "?text=" + encodeURIComponent(msg), "_blank");
}

// ── VOICE ORDER ──
let recognition = null, listening = false;
function toggleVoice(){
  if(listening){ try{ recognition && recognition.stop(); }catch(e){} return; }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){ toast("⚠️ Voice needs Chrome"); return; }
  recognition = new SR(); recognition.lang = "en-IN"; recognition.continuous = false; recognition.interimResults = false;
  const btn = $("voiceBtn");
  const done = () => { listening = false; btn.classList.remove("rec"); };
  recognition.onresult = e => voiceOrder(e.results[0][0].transcript);
  recognition.onerror = e => { done(); toast(e.error === "not-allowed" ? "⚠️ Microphone permission denied" : e.error === "no-speech" ? "🎤 Did not hear anything" : "⚠️ Voice error: " + e.error); };
  recognition.onend = done;
  try{ recognition.start(); listening = true; btn.classList.add("rec"); playSound("voice"); toast('🎤 Say: "two veg samosa one cold coffee"'); }
  catch(e){ done(); toast("⚠️ Could not start voice"); }
}
function voiceOrder(text){
  const words = {one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10};
  let t = " " + String(text).toLowerCase().replace(/[,.!?]/g," ") + " ";
  Object.entries(words).forEach(([w, n]) => { t = t.split(" " + w + " ").join(" " + n + " "); });
  t = t.replace(/\s+/g," ").trim();
  const added = [], pool = ALL.filter(i => !i.combo && !oos.has(i.id));
  t.split(/(?=\b\d+\s)/).forEach(part => {
    const m = part.trim().match(/^(\d+)\s+(.+)$/);
    const qty = m ? Math.min(50, parseInt(m[1])) : 1, phrase = (m ? m[2] : part).trim();
    if(!phrase) return;
    let best = null, bestScore = 0;
    pool.forEach(item => {
      const name = item.name.toLowerCase(); let score = 0;
      if(name === phrase) score = 100;
      else if(phrase.includes(name)) score = 90;
      else if(name.includes(phrase) && phrase.length > 3) score = 80;
      else {
        const pw = phrase.split(" ").filter(w => w.length > 2), nw = name.split(" ");
        const hit = pw.filter(p => nw.some(n => n.includes(p) || p.includes(n)));
        if(pw.length && hit.length === pw.length) score = 70;
      }
      if(score > bestScore){ bestScore = score; best = item; }
    });
    if(best && bestScore >= 70 && qty > 0){ addToCart(best.id, qty); added.push(qty + "× " + best.name); }
  });
  if(added.length) toast("✅ Added: " + added.join(", "));
  else { playSound("error"); toast('❌ Not found: "' + text + '"'); }
}

// ── ITEM EDITOR (owner) ──
const ITEM_EMOJIS = ["🥟","🍔","🥪","🍕","🥗","🍟","🌯","🥤","📦","🎁","🍱","⭐","🔥","🍛","🥘","🧆","🥙","🍜","🧀","🍨","🧃","☕"];
let editItemId = null, editItemEmoji = "⭐", editItemPhoto = undefined; // undefined = unchanged, "" = remove, dataURL = new
function openItem(id){
  if(!needOwner()) return;
  const it = id ? itemById(id) : null;
  if(!id && (!MENU[activeCat])) return;
  editItemId = id; editItemPhoto = undefined;
  const cat = it ? it.category : activeCat;
  $("itemTitle").textContent = it ? "Edit item" : "Add item to " + cat;
  $("itemName").value = it ? it.name : "";
  $("itemPrice").value = it ? it.price : "";
  $("itemInc").value = it ? (it.includes || "") : "";
  $("itemIncWrap").classList.toggle("hide", cat !== "Combos");
  editItemEmoji = it ? it.icon : MENU[cat].icon;
  $("itemEmojis").innerHTML = ITEM_EMOJIS.map(e => '<button class="' + (e === editItemEmoji ? "active" : "") + '" onclick="editItemEmoji=this.textContent;this.parentNode.querySelectorAll(\'button\').forEach(b=>b.classList.remove(\'active\'));this.classList.add(\'active\');itemPreview()">' + e + "</button>").join("");
  $("itemDel").classList.toggle("hide", !it);
  itemPreview();
  openM("itemMod");
  if(!it) setTimeout(() => $("itemName").focus(), 150);
}
function itemPreview(){
  const it = editItemId ? itemById(editItemId) : null;
  const stock = ITEM_IMG[it ? it.id : ""] || CAT_IMG[it ? it.category : activeCat];   // bundled photo, if any
  const stockSrc = stock ? "img/" + stock + ".jpg" : "";
  const src = editItemPhoto ? editItemPhoto : editItemPhoto === "" ? stockSrc : (it ? imgFor(it) : stockSrc);
  $("itemPv").innerHTML = src ? '<img src="' + esc(src) + '" alt=""/>' : esc(editItemEmoji);
  const hasOwn = editItemPhoto ? true : editItemPhoto === "" ? false : !!(it && IMGS[it.id]);
  $("itemPhotoRm").classList.toggle("hide", !hasOwn);
}
function pickItemPhoto(input){
  const f = input.files && input.files[0]; input.value = "";
  if(!f) return;
  const img = new Image(), url = URL.createObjectURL(f);
  img.onload = () => {
    const W = 480, H = 360, c = document.createElement("canvas"); c.width = W; c.height = H;
    const s = Math.max(W / img.width, H / img.height), w = img.width * s, h = img.height * s;
    c.getContext("2d").drawImage(img, (W - w) / 2, (H - h) / 2, w, h); // centre-crop to 4:3
    editItemPhoto = c.toDataURL("image/jpeg", .82);
    URL.revokeObjectURL(url); itemPreview();
  };
  img.onerror = () => { URL.revokeObjectURL(url); toast("⚠️ Could not read that photo"); };
  img.src = url;
}
function removeItemPhoto(){ editItemPhoto = ""; itemPreview(); }
function saveItem(){
  const name = $("itemName").value.trim(), price = r2($("itemPrice").value), inc = $("itemInc").value.trim();
  if(!name){ toast("⚠️ Enter the item name"); return; }
  if(!(price >= 1)){ toast("⚠️ Enter a valid price"); return; }
  let id = editItemId;
  if(id){
    const it = itemById(id);
    if(it.builtin) itemOver[id] = Object.assign({}, itemOver[id], {name, price, icon:editItemEmoji, includes:inc});
    else if(id.startsWith("cc_")) customCombos = customCombos.map(c => c.id === id ? Object.assign({}, c, {name, price, emoji:editItemEmoji, includes:inc}) : c);
    else {
      const upd = i => i.id === id ? Object.assign({}, i, {name, price, icon:editItemEmoji}) : i;
      customCategories.forEach(c => { c.items = (c.items || []).map(upd); });
      Object.keys(customItems).forEach(k => { customItems[k] = customItems[k].map(upd); });
    }
  } else {
    const cat = activeCat;
    if(cat === "Combos"){ id = "cc_" + Date.now(); customCombos.push({id, name, price, emoji:editItemEmoji, includes:inc}); }
    else {
      id = "ci_" + Date.now();
      const item = {id, name, price, icon:editItemEmoji};
      const cc = customCategories.find(c => c.name === cat);
      if(cc) (cc.items = cc.items || []).push(item); else (customItems[cat] = customItems[cat] || []).push(item);
    }
  }
  if(editItemPhoto){ IMGS[id] = editItemPhoto; if(DB.ok) DB.put("images", editItemPhoto, id).catch(() => {}); }
  else if(editItemPhoto === ""){ delete IMGS[id]; if(DB.ok) DB.del("images", id).catch(() => {}); }
  saveMenuStores(); buildMenu(); rebuildIndex(); closeM("itemMod"); renderCats(); renderMenu(); renderCart();
  toast("✅ Item saved");
}
function deleteItem(){
  const id = editItemId, it = id && itemById(id); if(!it) return;
  if(!confirm('Remove "' + it.name + '" from the menu? Old bills are not changed.')) return;
  if(it.builtin) itemOver[id] = Object.assign({}, itemOver[id], {hidden:true});
  else if(id.startsWith("cc_")) customCombos = customCombos.filter(c => c.id !== id);
  else {
    customCategories.forEach(c => { c.items = (c.items || []).filter(i => i.id !== id); });
    Object.keys(customItems).forEach(k => { customItems[k] = customItems[k].filter(i => i.id !== id); });
  }
  cart = cart.filter(l => l.id !== id);
  saveMenuStores(); buildMenu(); rebuildIndex(); closeM("itemMod"); renderCats(); renderMenu(); renderCart();
  toast("🗑️ Item removed");
}

// ── CATEGORY EDITOR (owner) ──
const CAT_EMOJIS = ["🍨","🥛","🧃","🍹","🫖","🍰","🧁","🍩","🍪","🌮","🥞","🧇","🍱","🥘","🍲","🥗","🍛","🥡","🎯","☕"];
const CAT_COLORS = ["#f59e0b","#ef4444","#8b5cf6","#f97316","#10b981","#fbbf24","#06b6d4","#3b82f6","#e879f9","#f43f5e","#34d399","#818cf8"];
let editCat = "", catEmoji = "🍱", catColor = "#f59e0b";
function openCat(name){
  if(!needOwner()) return;
  const ex = name ? customCategories.find(c => c.name === name) : null;
  editCat = ex ? name : "";
  $("catModTitle").textContent = ex ? "Edit category" : "New category";
  $("catName").value = ex ? ex.name : "";
  catEmoji = ex ? ex.icon : "🍱"; catColor = ex ? ex.color : "#f59e0b";
  $("catDel").classList.toggle("hide", !ex);
  drawCatPickers(); openM("catMod");
  if(!ex) setTimeout(() => $("catName").focus(), 150);
}
function drawCatPickers(){
  $("catEmojis").innerHTML = CAT_EMOJIS.map(e => '<button class="' + (e === catEmoji ? "active" : "") + '" onclick="catEmoji=this.textContent;drawCatPickers()">' + e + "</button>").join("");
  $("catColors").innerHTML = CAT_COLORS.map(c => '<button class="' + (c === catColor ? "active" : "") + '" style="background:' + c + '" onclick="catColor=\'' + c + '\';drawCatPickers()"></button>').join("");
}
function saveCategory(){
  const name = $("catName").value.trim();
  if(!name){ toast("⚠️ Enter a category name"); return; }
  if(name !== editCat && (MENU[name] || name === FAV)){ toast("⚠️ That category already exists"); return; }
  if(editCat){ const c = customCategories.find(x => x.name === editCat); if(c){ c.name = name; c.icon = catEmoji; c.color = catColor; } }
  else customCategories.push({name, icon:catEmoji, color:catColor, items:[]});
  saveMenuStores(); buildMenu(); rebuildIndex(); closeM("catMod"); activeCat = name; renderCats(); renderMenu();
  toast("✅ Category saved");
}
function deleteCategory(){
  const c = customCategories.find(x => x.name === editCat); if(!c) return;
  if(!confirm('Delete category "' + c.name + '" and its ' + (c.items || []).length + " items?")) return;
  customCategories = customCategories.filter(x => x.name !== editCat);
  saveMenuStores(); buildMenu(); rebuildIndex(); closeM("catMod"); activeCat = Object.keys(MENU)[0]; renderCats(); renderMenu(); renderCart();
}
