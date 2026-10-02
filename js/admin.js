"use strict";
// ══════════════════════════════════════════════════════
//  Reports, history, kitchen, expenses, customers, settings, sync, backup
// ══════════════════════════════════════════════════════

// ── Shared ──
const inRange = (iso, from, to) => (!from || iso >= from) && (!to || iso <= to);
const sum = (arr, f) => arr.reduce((s, x) => s + num(f(x)), 0);
function download(name, text, type){
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], {type:type || "text/plain"}));
  a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
function csv(rows){ return "﻿" + rows.map(r => r.map(c => '"' + String(c == null ? "" : c).replace(/"/g, '""') + '"').join(",")).join("\r\n"); }
function splitBar(parts){
  const tot = sum(parts, p => p.v);
  if(!tot) return '<div class="muted small">No sales in this period</div>';
  return '<div class="bar">' + parts.filter(p => p.v > 0).map(p => '<div style="flex:' + p.v + ";background:" + p.c + '" title="' + esc(p.l) + '"></div>').join("") + "</div>"
    + '<div class="legend">' + parts.filter(p => p.v > 0).map(p => '<span><i style="background:' + p.c + '"></i>' + esc(p.l) + " " + fmt(p.v) + " (" + Math.round(p.v / tot * 100) + "%)</span>").join("") + "</div>";
}
function itemStats(list){
  const m = {};
  list.forEach(o => o.items.forEach(i => { const k = i.name; (m[k] = m[k] || {name:k, qty:0, amt:0}); m[k].qty += num(i.qty); m[k].amt += num(i.price) * num(i.qty); }));
  return Object.values(m);
}

// ── DASHBOARD ──
let dashRange = "today";
const RANGES = [["today","Today"],["yest","Yesterday"],["7d","Last 7 days"],["30d","Last 30 days"],["custom","Custom"]];
function setRange(r){ dashRange = r; renderDash(); }
function rangeBounds(){
  const t = isoToday();
  if(dashRange === "yest") return [isoShift(t, -1), isoShift(t, -1)];
  if(dashRange === "7d") return [isoShift(t, -6), t];
  if(dashRange === "30d") return [isoShift(t, -29), t];
  if(dashRange === "custom") return [$("dFrom").value, $("dTo").value];
  return [t, t];
}
function renderDash(){
  $("rangeChips").innerHTML = RANGES.map(r => '<button class="chip' + (r[0] === dashRange ? " active" : "") + '" onclick="setRange(\'' + r[0] + '\')">' + r[1] + "</button>").join("");
  $("rangeCustom").classList.toggle("hide", dashRange !== "custom");
  $("fetchBtn").classList.toggle("hide", !sheetOn);
  const [from, to] = rangeBounds();
  const all = orders.filter(o => inRange(orderISO(o), from, to)), live = all.filter(isLive), canc = all.filter(o => !isLive(o));
  const exps = expenses.filter(e => inRange(expISO(e), from, to));
  const rev = sum(live, o => o.total), expT = sum(exps, e => e.amount);
  const pay = m => sum(live.filter(o => o.paymentMethod === m), o => o.total);
  const st = (icon, val, lbl, cls, color) => '<div class="stat ' + (cls || "") + '"><div class="si">' + icon + '</div><div class="sv"' + (color ? ' style="color:' + color + '"' : "") + ">" + val + '</div><div class="sl">' + lbl + "</div></div>";
  $("statsGrid").innerHTML = st("💰", fmt(rev), "Sales", "hero") + st("🧾", live.length, "Bills") + st("📈", fmt(live.length ? rev / live.length : 0), "Average bill")
    + st("💸", fmt(expT), "Expenses", "", "var(--red)") + st("✅", fmt(rev - expT), "Profit (sales − expenses)", "", "var(--green)")
    + st("🏷️", fmt(sum(live, o => o.discount)), "Discounts given")
    + st("❌", canc.length + " · " + fmt(sum(canc, o => o.total)), "Cancelled bills", "", canc.length ? "var(--red)" : "");
  $("paySplit").innerHTML = splitBar([{l:"Cash", v:pay("cash"), c:"#34d399"},{l:"UPI", v:pay("upi"), c:"#818cf8"},{l:"Card", v:pay("card"), c:"#f472b6"}]);
  const tc = ["#f6b93b","#60a5fa","#fb923c","#f87171"];
  $("typeSplit").innerHTML = splitBar(ORDER_TYPES.map((t, i) => ({l:t.label, c:tc[i], v:sum(live.filter(o => (o.orderType || "dinein") === t.id), o => o.total)})));
  // hours
  const hrs = {}; live.forEach(o => { const ts = orderTs(o); if(ts){ const h = new Date(ts).getHours(); hrs[h] = (hrs[h] || 0) + o.total; } });
  const hk = Object.keys(hrs).map(Number);
  if(hk.length){
    const lo = Math.min(...hk), hi = Math.max(...hk), mx = Math.max(...Object.values(hrs));
    let h = "";
    for(let x = lo; x <= hi; x++){ const v = hrs[x] || 0; h += '<div class="hb"><em>' + (v ? Math.round(v) : "") + '</em><i style="height:' + Math.max(2, Math.round(v / mx * 100)) + '%"></i><span>' + ((x % 12) || 12) + (x < 12 ? "a" : "p") + "</span></div>"; }
    $("hourChart").innerHTML = '<div class="hours">' + h + "</div>";
  } else $("hourChart").innerHTML = '<div class="muted small">No sales in this period</div>';
  // items
  const items = itemStats(live);
  const top = items.slice().sort((a,b) => b.qty - a.qty).slice(0, 8), mq = top.length ? top[0].qty : 1;
  $("topList").innerHTML = top.length ? top.map((t, i) => '<div class="rank"><div class="rn">' + (i + 1) + '</div><div class="rb">' + esc(t.name) + '<div style="width:' + Math.round(t.qty / mq * 100) + '%"></div></div><span class="tag gold">' + t.qty + "×</span></div>").join("") : '<div class="muted small">No sales in this period</div>';
  $("itemTable").innerHTML = items.length ? '<table class="tbl"><tr><th>Item</th><th class="n">Qty</th><th class="n">Amount</th></tr>' + items.sort((a,b) => b.amt - a.amt).map(t => "<tr><td>" + esc(t.name) + '</td><td class="n">' + t.qty + '</td><td class="n">' + fmt(t.amt) + "</td></tr>").join("") + "</table>" : '<div class="muted small">No sales in this period</div>';
}
function csvOrders(){
  const [from, to] = rangeBounds();
  const rows = [["Token","Date","Time","Status","Type","Customer","Phone","Items","Subtotal","Discount","GST","Total","Payment","Cancel reason"]];
  orders.filter(o => inRange(orderISO(o), from, to)).forEach(o => rows.push([o.token, isoNice(orderISO(o)), o.time, isLive(o) ? "Paid" : "Cancelled", typeLabel(o.orderType), o.customerName, o.customerPhone,
    o.items.map(i => i.name + " x" + i.qty).join("; "), o.subtotal, o.discount, o.gst, o.total, o.paymentMethod, o.cancelReason || ""]));
  download("ridhi_bills_" + (from || "all") + "_to_" + (to || "all") + ".csv", csv(rows), "text/csv");
}
function csvItems(){
  const [from, to] = rangeBounds();
  const rows = [["Item","Qty sold","Amount"]];
  itemStats(orders.filter(o => isLive(o) && inRange(orderISO(o), from, to))).sort((a,b) => b.amt - a.amt).forEach(t => rows.push([t.name, t.qty, r2(t.amt)]));
  download("ridhi_items_" + (from || "all") + "_to_" + (to || "all") + ".csv", csv(rows), "text/csv");
}

// ── DAY-END REPORT ──
function dayEndData(){
  const iso = $("dayDate").value || isoToday(), opening = num($("dayOpen").value);
  const all = orders.filter(o => orderISO(o) === iso), live = all.filter(isLive), canc = all.filter(o => !isLive(o));
  const exps = expenses.filter(e => expISO(e) === iso);
  const pay = m => sum(live.filter(o => o.paymentMethod === m), o => o.total);
  const cash = pay("cash"), expCash = sum(exps.filter(e => (e.paidVia || "cash") === "cash"), e => e.amount);
  return {iso, opening, bills:live.length, cancelled:canc.length, cancelledAmt:sum(canc, o => o.total),
    gross:sum(live, o => o.subtotal), discount:sum(live, o => o.discount), net:sum(live, o => o.total),
    cash, upi:pay("upi"), card:pay("card"),
    types:ORDER_TYPES.map(t => { const l = live.filter(o => (o.orderType || "dinein") === t.id); return {label:t.label, n:l.length, amt:sum(l, o => o.total)}; }).filter(t => t.n),
    expCash, expOther:sum(exps, e => e.amount) - expCash, drawer:opening + cash - expCash,
    top:itemStats(live).sort((a,b) => b.qty - a.qty).slice(0, 5)};
}
function openDayEnd(){
  if(!needOwner()) return;
  $("dayDate").value = isoToday(); $("dayOpen").value = S.openingCash || "";
  renderDayEnd(); openM("dayMod");
}
function renderDayEnd(){
  S.openingCash = num($("dayOpen").value); saveSettings();
  $("dayContent").innerHTML = linesHTML(dayEndLayout(dayEndData()));
}

// ── HISTORY ──
function histToday(){ $("hFrom").value = $("hTo").value = isoToday(); renderHist(); }
function histAll(){ $("hFrom").value = $("hTo").value = ""; renderHist(); }
function renderHist(){
  const from = $("hFrom").value, to = $("hTo").value, q = $("hSearch").value.trim().toLowerCase();
  let f = orders.filter(o => inRange(orderISO(o), from, to));
  if(q) f = f.filter(o => ("#" + o.token + " " + (o.customerName || "") + " " + (o.customerPhone || "")).toLowerCase().includes(q));
  const more = f.length > 200; f = f.slice(0, 200);
  $("histList").innerHTML = f.length ? f.map(o => {
    const live = isLive(o);
    return '<div class="hc' + (live ? "" : " cancelled") + '"><div class="h1"><div><div class="tok">#' + esc(o.token) + " "
      + (live ? "" : '<span class="tag red">CANCELLED</span> ') + '<span class="tag">' + esc(typeLabel(o.orderType)) + '</span> <span class="tag blue">' + esc(o.paymentMethod.toUpperCase()) + "</span>"
      + (o.customerName ? ' <span class="tag green">👤 ' + esc(o.customerName) + "</span>" : "") + "</div>"
      + '<div class="muted small" style="margin-top:3px;">' + esc(isoNice(orderISO(o))) + " · " + esc(o.time) + " · " + sum(o.items, i => i.qty) + (sum(o.items, i => i.qty) === 1 ? " item" : " items") + (o.cancelReason ? " · " + esc(o.cancelReason) : "") + "</div></div>"
      + '<div class="amt">' + fmt(o.total) + "</div></div>"
      + '<div class="items">' + o.items.map(i => '<span class="tag">' + esc(i.name) + " ×" + esc(i.qty) + "</span>").join("") + "</div>"
      + '<div class="row"><button class="btn ghost sm" data-id="' + esc(o.id) + '" onclick="viewOrder(this.dataset.id)">View / reprint</button>'
      + (live ? '<button class="btn danger sm owner-only" data-id="' + esc(o.id) + '" onclick="openCancel(this.dataset.id)">Cancel bill</button>' : "") + "</div></div>";
  }).join("") + (more ? '<div class="muted small" style="text-align:center;padding:10px;">Showing the latest 200 bills — narrow the dates to see older ones</div>' : "")
    : '<div class="empty"><div>📋</div>No bills found</div>';
}
const findOrder = id => orders.find(o => String(o.id) === String(id));
function viewOrder(id){ const o = findOrder(id); if(o) showReceipt(o); }
let cancelId = null;
function openCancel(id){
  if(!needOwner()) return;
  const o = findOrder(id); if(!o || !isLive(o)) return;
  cancelId = o.id;
  $("cancelTitle").textContent = "Cancel bill #" + o.token + " (" + fmt(o.total) + ")";
  $("cancelReason").value = "";
  $("cancelQuick").innerHTML = ["Wrong item billed","Customer left","Billed twice","Test bill"].map(r => '<button class="chip" onclick="document.getElementById(\'cancelReason\').value=this.textContent">' + r + "</button>").join("");
  openM("cancelMod");
}
function confirmCancel(){
  const o = findOrder(cancelId); if(!o) return closeM("cancelMod");
  const reason = $("cancelReason").value.trim();
  if(!reason){ toast("⚠️ Enter a reason"); return; }
  o.status = "cancelled"; o.cancelReason = reason; o.cancelledAt = Date.now();
  saveOrder(o);
  const k = kitchen.find(x => String(x.id) === String(o.id)); if(k){ k.kitchenStatus = "done"; k.changedAt = Date.now(); saveKitchen(); }
  queueSync({type:"cancel", id:o.id, reason});
  rebuildIndex(); closeM("cancelMod"); renderHist(); renderCats();
  toast("❌ Bill #" + o.token + " cancelled");
}

// ── KITCHEN (this device + other devices through the Google Sheet) ──
let kitchen = [], kitTimer = null, kitRemote = null; // kitRemote: null unknown, true syncing, false script too old
function loadKitchen(){ const k = lsGet(LS.KIT, null); kitchen = k && k.date === isoToday() && Array.isArray(k.list) ? k.list : []; }
function saveKitchen(){ lsSet(LS.KIT, {date:isoToday(), list:kitchen.slice(0, 60)}); }
function kitchenAdd(o){
  kitchen.unshift({id:o.id, token:o.token, time:o.time, customerName:o.customerName, orderType:o.orderType,
    items:o.items.map(i => ({name:i.name, qty:i.qty, note:i.note || "", includes:i.includes || ""})), kitchenStatus:"preparing", changedAt:Date.now()});
  saveKitchen();
}
function setKS(id, s){
  const k = kitchen.find(x => String(x.id) === String(id)); if(!k) return;
  k.kitchenStatus = s; k.changedAt = Date.now(); saveKitchen();
  if(s === "ready") playSound("ready");
  queueSync({type:"kitchen", id:k.id, status:s});
  renderKitchen();
}
function renderKitchen(){
  const list = kitchen.filter(k => k.kitchenStatus !== "done");
  $("kEmpty").classList.toggle("hide", list.length > 0);
  $("kGrid").innerHTML = list.map(o => '<div class="kc ' + (o.kitchenStatus === "ready" ? "rdy" : "") + '">'
    + '<div class="row" style="justify-content:space-between;margin-bottom:8px;"><span class="kt">#' + esc(o.token) + '</span><span><span class="tag">' + esc(typeLabel(o.orderType)) + '</span> <span class="muted small">' + esc(o.time) + "</span></span></div>"
    + (o.customerName ? '<div class="muted small" style="margin-bottom:6px;">👤 ' + esc(o.customerName) + "</div>" : "")
    + (o.items || []).map(i => '<div class="ki"><span>' + esc(i.name) + "</span><b>×" + esc(i.qty) + "</b></div>" + (i.includes ? '<div class="kn" style="color:var(--muted)">(' + esc(i.includes) + ")</div>" : "") + (i.note ? '<div class="kn">📝 ' + esc(i.note) + "</div>" : "")).join("")
    + '<div class="row" style="margin-top:12px;flex-wrap:nowrap;">'
    + (o.kitchenStatus === "ready" ? '<button class="btn ghost sm" style="flex:1" data-id="' + esc(o.id) + '" onclick="setKS(this.dataset.id,\'preparing\')">Back to preparing</button>'
                                   : '<button class="btn green sm" style="flex:1" data-id="' + esc(o.id) + '" onclick="setKS(this.dataset.id,\'ready\')">✓ Ready</button>')
    + '<button class="btn ghost sm" data-id="' + esc(o.id) + '" onclick="setKS(this.dataset.id,\'done\')">Served</button></div></div>').join("");
  const tag = $("kitLive");
  if(sheetOn && S.kitchenSync && kitRemote !== false){ tag.className = "tag green"; tag.textContent = "● LIVE · all devices"; }
  else { tag.className = "tag"; tag.textContent = kitRemote === false ? "● This device only — update Apps Script" : "● This device only"; }
}
function kitchenOpen(){
  renderKitchen(); kitchenClose();
  if(sheetOn && S.kitchenSync){ kitchenPoll(); kitTimer = setInterval(kitchenPoll, 8000); }
}
function kitchenClose(){ if(kitTimer){ clearInterval(kitTimer); kitTimer = null; } }
function kitchenRefresh(manual){
  if(sheetOn && S.kitchenSync) kitchenPoll().then(() => { if(manual) toast("🔄 Kitchen refreshed"); });
  else { renderKitchen(); if(manual) toast("This device only — connect the Sheet in Settings to share orders"); }
}
async function kitchenPoll(){
  if(navigator.onLine === false) return;
  let data;
  try{ data = await jsonp(sheetUrl, {action:"getKitchen", d:isoToday()}); }catch(e){ return; }
  if(!data || !Array.isArray(data.kitchen)){ kitRemote = false; renderKitchen(); return; }
  kitRemote = true;
  let fresh = 0;
  data.kitchen.forEach(r => {
    if(!r || r.id == null) return;
    const st = r.status === "cancelled" ? "done" : (r.kitchenStatus || "preparing");
    const k = kitchen.find(x => String(x.id) === String(r.id));
    if(!k){
      if(st === "done") return;
      let items = r.items; if(typeof items === "string"){ try{ items = JSON.parse(items); }catch(e){ items = []; } }
      kitchen.push({id:r.id, token:String(r.token || "").padStart(3, "0"), time:r.time || "", customerName:r.customerName || "", orderType:r.orderType || "dinein",
        items:(items || []).map(i => ({name:i.name, qty:i.qty, note:i.note || "", includes:i.includes || ""})), kitchenStatus:st, changedAt:0});
      fresh++;
    } else if(Date.now() - (k.changedAt || 0) > 15000 && k.kitchenStatus !== st) k.kitchenStatus = st; // our own recent taps win
  });
  kitchen.sort((a,b) => num(b.id) - num(a.id));
  saveKitchen();
  if(fresh){ playSound("neworder"); toast("🔔 " + fresh + " new order" + (fresh > 1 ? "s" : "")); }
  if(curView === "kitchen") renderKitchen();
}

// ── EXPENSES ──
const EXP_CATS = [
  {id:"ingredients", label:"Ingredients", icon:"🧅", color:"#f59e0b"},{id:"gas", label:"Gas/Fuel", icon:"🔥", color:"#ef4444"},
  {id:"oil", label:"Oil", icon:"🫙", color:"#f97316"},{id:"packaging", label:"Packaging", icon:"📦", color:"#8b5cf6"},
  {id:"salary", label:"Salary", icon:"👷", color:"#10b981"},{id:"rent", label:"Rent", icon:"🏠", color:"#06b6d4"},
  {id:"electricity", label:"Electricity", icon:"⚡", color:"#fbbf24"},{id:"cleaning", label:"Cleaning", icon:"🧹", color:"#34d399"},
  {id:"transport", label:"Transport", icon:"🚗", color:"#818cf8"},{id:"maintenance", label:"Repairs", icon:"🔧", color:"#fb923c"},
  {id:"marketing", label:"Marketing", icon:"📢", color:"#f43f5e"},{id:"other", label:"Other", icon:"💼", color:"#9ca3af"}];
const expCat = id => EXP_CATS.find(c => c.id === id) || {id:id || "other", label:String(id || "Other").replace(/_/g, " "), icon:"💼", color:"#9ca3af"};
const expISO = e => e.dateISO || (e.dateISO = toISO(e.date));
let expEditId = "", expCatSel = "", expPMSel = "cash";
function expToday(){ $("expFrom").value = $("expTo").value = isoToday(); renderExp(); }
function expAll(){ $("expFrom").value = $("expTo").value = ""; renderExp(); }
function renderExp(){
  const from = $("expFrom").value, to = $("expTo").value, t = isoToday();
  const f = expenses.filter(e => inRange(expISO(e), from, to)).sort((a,b) => expISO(b) > expISO(a) ? 1 : expISO(b) < expISO(a) ? -1 : 0);
  const todayE = sum(expenses.filter(e => expISO(e) === t), e => e.amount);
  const weekE = sum(expenses.filter(e => expISO(e) >= isoShift(t, -6) && expISO(e) <= t), e => e.amount);
  const todayS = sum(orders.filter(o => isLive(o) && orderISO(o) === t), o => o.total);
  const st = (icon, val, lbl, color) => '<div class="stat"><div class="si">' + icon + '</div><div class="sv" style="color:' + color + '">' + val + '</div><div class="sl">' + lbl + "</div></div>";
  $("expStats").innerHTML = st("📅", fmt(todayE), "Today's expenses", "var(--red)") + st("📆", fmt(weekE), "Last 7 days", "#fb923c")
    + st("💰", fmt(sum(f, e => e.amount)), from || to ? "Selected period" : "All time", "var(--gold)") + st("📈", fmt(todayS - todayE), "Today's profit", "var(--green)");
  const cats = {}; f.forEach(e => { const k = e.category || "other"; cats[k] = (cats[k] || 0) + num(e.amount); });
  const sorted = Object.entries(cats).sort((a,b) => b[1] - a[1]), mx = sorted.length ? sorted[0][1] : 1;
  $("expBreak").classList.toggle("hide", !sorted.length);
  $("expCats").innerHTML = sorted.map(([k, v]) => { const c = expCat(k); return '<div class="rank"><span style="width:22px;text-align:center;">' + c.icon + '</span><div class="rb">' + esc(c.label) + '<div style="width:' + Math.round(v / mx * 100) + "%;background:" + c.color + '"></div></div><b style="color:var(--red)">' + fmt(v) + "</b></div>"; }).join("");
  $("expList").innerHTML = f.length ? f.map(e => { const c = expCat(e.category);
    return '<div class="hc exp"><div class="ei" style="background:' + c.color + '22">' + c.icon + '</div><div class="eb"><div class="ed">' + esc(e.desc || c.label) + '</div><div class="muted small">' + esc(isoNice(expISO(e))) + " · " + esc(c.label) + " · " + esc((e.paidVia || "cash").toUpperCase()) + "</div></div>"
      + '<div class="ea">−' + fmt(e.amount) + '</div><button class="icon-btn" data-id="' + esc(e.id) + '" onclick="openExp(this.dataset.id)">✏️</button><button class="icon-btn" data-id="' + esc(e.id) + '" onclick="deleteExp(this.dataset.id)">🗑️</button></div>';
  }).join("") : '<div class="empty"><div>💸</div>No expenses in this period</div>';
}
function drawExpForm(){
  $("expCatGrid").innerHTML = EXP_CATS.map(c => '<button class="' + (c.id === expCatSel ? "active" : "") + '" onclick="selExpCat(\'' + c.id + '\')"><div>' + c.icon + "</div>" + c.label + "</button>").join("");
  $("expPM").innerHTML = [["cash","💵 Cash"],["upi","📱 UPI"],["credit","🤝 Credit"]].map(p => '<button class="' + (p[0] === expPMSel ? "active" : "") + '" onclick="expPMSel=\'' + p[0] + '\';drawExpForm()">' + p[1] + "</button>").join("");
}
function selExpCat(id){ expCatSel = id; if(id) $("expCustom").value = ""; drawExpForm(); }
function openExp(id){
  if(!needOwner()) return;
  const e = id ? expenses.find(x => String(x.id) === String(id)) : null;
  expEditId = e ? e.id : "";
  $("expTitle").textContent = e ? "Edit expense" : "Add expense";
  $("expDesc").value = e ? (e.desc || "") : ""; $("expAmt").value = e ? e.amount : "";
  $("expDate").value = e ? expISO(e) : isoToday();
  const known = e && EXP_CATS.some(c => c.id === e.category);
  expCatSel = e ? (known ? e.category : "") : ""; $("expCustom").value = e && !known ? expCat(e.category).label : "";
  expPMSel = e ? (e.paidVia || "cash") : "cash";
  drawExpForm(); openM("expMod");
}
function saveExp(){
  const desc = $("expDesc").value.trim(), amount = r2($("expAmt").value), dateISO = $("expDate").value, custom = $("expCustom").value.trim();
  const category = custom ? custom.toLowerCase().replace(/\s+/g, "_") : (expCatSel || "other");
  if(!desc){ toast("⚠️ Enter a description"); return; }
  if(!(amount > 0)){ toast("⚠️ Enter a valid amount"); return; }
  if(!dateISO){ toast("⚠️ Choose a date"); return; }
  const p = dateISO.split("-"), rec = {desc, amount, dateISO, date:+p[2] + "/" + +p[1] + "/" + p[0], category, paidVia:expPMSel};
  let saved;
  if(expEditId){ expenses = expenses.map(e => String(e.id) === String(expEditId) ? (saved = Object.assign({}, e, rec)) : e); }
  else { saved = Object.assign({id:"e" + Date.now()}, rec); expenses.unshift(saved); }
  lsSet(LS.EXP, expenses);
  if(saved) queueSync(Object.assign({type:"expense"}, saved));
  closeM("expMod"); renderExp(); toast(expEditId ? "✅ Expense updated" : "✅ Expense added");
}
function deleteExp(id){
  if(!needOwner() || !confirm("Delete this expense?")) return;
  expenses = expenses.filter(e => String(e.id) !== String(id)); lsSet(LS.EXP, expenses);
  queueSync({type:"expenseDelete", id});
  renderExp(); toast("🗑️ Expense deleted");
}
function csvExpenses(){
  const from = $("expFrom").value, to = $("expTo").value, rows = [["Date","Category","Description","Amount","Paid via"]];
  expenses.filter(e => inRange(expISO(e), from, to)).forEach(e => rows.push([isoNice(expISO(e)), expCat(e.category).label, e.desc, e.amount, e.paidVia || "cash"]));
  download("ridhi_expenses_" + (from || "all") + "_to_" + (to || "all") + ".csv", csv(rows), "text/csv");
}

// ── CUSTOMERS ──
function renderCustomers(){
  const q = $("cSearch").value.trim().toLowerCase();
  let list = [...customers.values()].sort((a,b) => b.visits - a.visits || b.total - a.total);
  $("custCount").textContent = list.length + " customers with a phone number";
  if(q) list = list.filter(c => (c.name + " " + c.phone).toLowerCase().includes(q));
  $("custList").innerHTML = list.length ? list.slice(0, 300).map(c => '<div class="hc" style="cursor:pointer;" data-ph="' + esc(c.phone) + '" onclick="openCustomer(this.dataset.ph)"><div class="h1"><div><div class="tok">' + esc(c.name || "Customer") + '</div><div class="muted small">📞 ' + esc(c.phone) + " · last visit " + esc(isoNice(c.last)) + '</div></div><div style="text-align:right;"><div class="amt">' + fmt(c.total) + '</div><span class="tag gold">' + c.visits + (c.visits === 1 ? " visit" : " visits") + "</span></div></div></div>").join("")
    : '<div class="empty"><div>👥</div>' + (q ? "No customer found" : "Customers appear here when you enter a phone number on a bill") + "</div>";
}
function openCustomer(ph){
  const c = customers.get(ph); if(!c) return;
  $("custModTitle").textContent = c.name || "Customer";
  const list = orders.filter(o => isLive(o) && o.customerPhone === ph).slice(0, 20);
  let loy = "";
  if(S.loyaltyN > 1){ const k = (S.loyaltyN - ((c.visits + 1) % S.loyaltyN)) % S.loyaltyN; loy = '<div class="cust-hint' + (k ? "" : " reward") + '" style="margin-bottom:10px;">' + (k ? "Reward after " + k + " more visit" + (k > 1 ? "s" : "") : "🎉 Next visit earns: " + esc(S.loyaltyReward || "Free item")) + "</div>"; }
  $("custModBody").innerHTML = '<div class="stats" style="grid-template-columns:1fr 1fr 1fr;"><div class="stat"><div class="sv">' + c.visits + '</div><div class="sl">Visits</div></div><div class="stat"><div class="sv">' + fmt(c.total) + '</div><div class="sl">Total spent</div></div><div class="stat"><div class="sv">' + fmt(c.total / c.visits) + '</div><div class="sl">Avg bill</div></div></div>'
    + loy + '<a class="btn green block sm" style="margin-bottom:12px;text-decoration:none;" target="_blank" rel="noopener" href="https://wa.me/91' + esc(ph) + '">💬 WhatsApp ' + esc(ph) + "</a>"
    + '<div class="lbl">Recent bills</div>' + list.map(o => '<div class="sw-row"><div><b>#' + esc(o.token) + " · " + esc(isoNice(orderISO(o))) + '</b><span class="d">' + esc(o.items.map(i => i.name + " ×" + i.qty).join(", ")) + '</span></div><b style="color:var(--gold);white-space:nowrap;">' + fmt(o.total) + "</b></div>").join("");
  openM("custMod");
}

// ── GOOGLE SHEET SYNC (with retry queue) ──
let queue = lsGet(LS.QUEUE, []), flushing = false;
if(!Array.isArray(queue)) queue = [];
function saveQueue(){ lsSet(LS.QUEUE, queue.slice(-500)); }
function queueSync(body){
  if(!sheetOn) return;
  queue.push(body); saveQueue(); updateSyncUI(); flushQueue();
}
async function flushQueue(){
  if(flushing || !sheetOn || !queue.length || navigator.onLine === false){ updateSyncUI(); return; }
  flushing = true;
  try{
    while(queue.length){
      // no-cors: the request reaches Apps Script; a network failure throws and the item stays queued
      await fetch(sheetUrl, {method:"POST", mode:"no-cors", body:JSON.stringify(queue[0])});
      queue.shift(); saveQueue();
    }
  }catch(e){}
  flushing = false; updateSyncUI();
}
function updateSyncUI(){
  const p = $("syncPill"); if(!p) return;
  if(!sheetOn){ p.className = "pill off owner-only"; p.textContent = "Sheet off"; }
  else if(queue.length){ p.className = "pill warn owner-only"; p.textContent = "⏳ " + queue.length + " waiting"; }
  else { p.className = "pill ok owner-only"; p.textContent = "Sheet ✓"; }
}
function jsonp(url, params){
  return new Promise((res, rej) => {
    const cb = "_rc_" + Date.now() + "_" + Math.floor(Math.random() * 1e6), sc = document.createElement("script");
    const done = () => { clearTimeout(t); try{ delete window[cb]; }catch(e){ window[cb] = undefined; } if(sc.parentNode) sc.parentNode.removeChild(sc); };
    const t = setTimeout(() => { done(); rej(new Error("timeout")); }, 12000);
    window[cb] = d => { done(); res(d); };
    sc.onerror = () => { done(); rej(new Error("network")); };
    sc.src = url + (url.includes("?") ? "&" : "?") + Object.entries(Object.assign({callback:cb}, params)).map(([k, v]) => k + "=" + encodeURIComponent(v)).join("&");
    document.body.appendChild(sc);
  });
}
async function connectSheet(){
  const url = $("setUrl").value.trim();
  if(!/^https:\/\/script\.google\.com\/.+\/exec/.test(url)){ toast("⚠️ Paste the Web App URL ending in /exec"); return; }
  busy(true, "Testing the Sheet link...");
  try{
    await fetch(url, {method:"GET", mode:"no-cors"});
    sheetUrl = url; sheetOn = true; localStorage.setItem(LS.U, url); kitRemote = null;
    toast("✅ Sheet connected");
  }catch(e){ toast("❌ Could not reach that link — check internet and the deployment"); }
  busy(false); updateSyncUI(); reSettings();
}
function disconnectSheet(){
  if(!confirm("Disconnect the Google Sheet? Bills stay on this device.")) return;
  sheetUrl = ""; sheetOn = false; localStorage.removeItem(LS.U); queue = []; saveQueue();
  updateSyncUI(); renderSettings(); toast("🔌 Sheet disconnected");
}
// Upload every bill and expense on this device (used once after installing the new Apps Script).
function pushAllToSheet(){
  if(!sheetOn || !confirm("Send all " + orders.length + " bills and " + expenses.length + " expenses on this device to the Sheet?")) return;
  const items = orders.map(o => Object.assign({type:"order", kitchenStatus:"done"}, o)).concat(expenses.map(e => Object.assign({type:"expense"}, e)));
  for(let i = 0; i < items.length; i += 40) queue.push({type:"batch", items:items.slice(i, i + 40)});
  saveQueue(); updateSyncUI(); flushQueue(); reSettings();
  toast("⬆️ Uploading " + items.length + " records in the background");
}
async function fetchSheet(){
  if(!sheetOn){ toast("⚠️ Connect the Sheet first"); return; }
  busy(true, "Fetching bills from Google Sheets...");
  try{
    const data = await jsonp(sheetUrl, {action:"getOrders"});
    if(data && Array.isArray(data.orders)){
      let added = 0;
      data.orders.forEach(r => {
        if(!r || r.id == null) return;
        const ex = findOrder(r.id);
        if(!ex){ orders.push(normOrder(r)); added++; }
        else if(r.status === "cancelled" && isLive(ex)){ ex.status = "cancelled"; ex.cancelReason = r.cancelReason || ""; }
      });
      sortOrders(); await saveAllOrders(); rebuildIndex();
      toast("✅ Sheet has " + data.orders.length + " bills · " + added + " new on this device");
    } else toast("📋 No bills in the Sheet yet");
  }catch(e){ toast("⚠️ Fetch failed — check internet / Apps Script deployment"); }
  busy(false);
  if(curView === "dashboard") renderDash();
  if(curView === "settings") reSettings();
}

// ── SETTINGS ──
function renderSettings(){
  if(!isOwner()) return;
  const v = k => esc(S[k] == null ? "" : S[k]);
  const field = (lbl, id, key, ph, extra) => '<div class="field"><div class="lbl">' + lbl + '</div><input class="inp" id="' + id + '" value="' + v(key) + '" placeholder="' + (ph || "") + '" ' + (extra || "") + "/></div>";
  const sw = (title, desc, key) => '<div class="sw-row"><div><b>' + title + '</b><span class="d">' + desc + '</span></div><label class="tog"><input type="checkbox" ' + (S[key] ? "checked" : "") + ' onchange="S.' + key + '=this.checked;saveSettings()"/><span></span></label></div>';
  const prn = lsGet(LS.PRN, null);
  $("settingsPage").innerHTML = '<div class="page-head"><h1>⚙️ Settings</h1><button class="btn primary sm" onclick="saveSet()">Save changes</button></div>'
    + '<div class="card" style="margin-bottom:12px;"><h3>🏪 Shop details (printed on every bill)</h3><div class="grid2" style="gap:0 10px;">'
      + field("Shop name", "setName", "shopName", "", 'maxlength="32"') + field("Tagline", "setTag", "tagline", "", 'maxlength="28"')
      + field("Address line", "setAddr", "address", "", 'maxlength="60"') + field("Phone", "setPhone", "phone", "optional", 'maxlength="24"')
      + field("GSTIN", "setGstin", "gstin", "optional", 'maxlength="15"') + field("Bill footer", "setFoot", "footer", "", 'maxlength="60"') + "</div></div>"
    + '<div class="card" style="margin-bottom:12px;"><h3>📱 UPI payments</h3><div class="grid2" style="gap:0 10px;">'
      + field("Your UPI ID", "setUpi", "upiId", "e.g. ridhichats@okaxis", 'maxlength="60" autocapitalize="off"') + field("Name shown to the customer", "setUpiName", "upiName", "", 'maxlength="40"')
      + '</div><div class="muted small">The payment screen shows a QR with the bill amount already filled in. Check the UPI ID carefully — money goes to this ID.</div></div>'
    + '<div class="card" style="margin-bottom:12px;"><h3>🖨️ Printing</h3>'
      + sw("Print the bill automatically", "As soon as payment is confirmed", "autoPrint") + sw("Print a kitchen slip automatically", "A second slip without prices, for the cook", "autoKOT")
      + '<div class="sw-row"><div><b>Auto-print through</b><span class="d">RawBT is only for printers that do not show in the Bluetooth list</span></div><div class="seg" style="min-width:190px;"><button class="' + (S.printRoute !== "rawbt" ? "active" : "") + '" onclick="S.printRoute=\'bt\';saveSettings();reSettings()">Bluetooth</button><button class="' + (S.printRoute === "rawbt" ? "active" : "") + '" onclick="S.printRoute=\'rawbt\';saveSettings();reSettings()">RawBT app</button></div></div>'
      + '<div class="sw-row"><div><b>Printer</b><span class="d">' + (btChar ? "Connected: " + esc(btDevice.name || "Printer") : prn ? "Saved: " + esc(prn.name || "Printer") : "Not connected yet") + '</span></div><div class="row"><button class="btn blue sm" onclick="connectBT().then(reSettings)">Connect</button><button class="btn ghost sm" onclick="testPrint()">Test print</button></div></div></div>'
    + '<div class="card" style="margin-bottom:12px;"><h3>🎁 Loyalty reward</h3><div class="grid2" style="gap:0 10px;">'
      + field("Reward every N visits (0 = off)", "setLoyN", "loyaltyN", "e.g. 10", 'type="number" min="0" inputmode="numeric"') + field("Reward", "setLoyR", "loyaltyReward", "e.g. Free Veg Samosa", 'maxlength="40"')
      + '</div><div class="muted small">Visits are counted by the customer phone number entered on the bill.</div></div>'
    + '<div class="card" style="margin-bottom:12px;"><h3>🔐 Logins</h3><div class="grid2" style="gap:0 10px;">'
      + '<div class="field"><div class="lbl">New owner password</div><input class="inp" id="setOwnerPw" type="password" placeholder="leave empty to keep" autocomplete="new-password"/></div>'
      + '<div class="field"><div class="lbl">Staff PIN ' + (S.staffHash ? '<span class="tag green">set</span>' : '<span class="tag">not set</span>') + '</div><input class="inp" id="setStaffPin" type="password" inputmode="numeric" placeholder="' + (S.staffHash ? "type a new PIN to change" : "e.g. 4 digits") + '" autocomplete="new-password"/></div></div>'
      + '<div class="muted small">Staff can bill, print, use Kitchen and view History. Reports, expenses, cancelling bills, menu editing and Settings need the owner password.'
      + (S.staffHash ? ' <a href="#" style="color:var(--red)" onclick="removeStaffPin();return false;">Remove staff PIN</a>' : "") + "</div></div>"
    + '<div class="card" style="margin-bottom:12px;"><h3>📊 Google Sheet ' + (sheetOn ? '<span class="tag green">connected</span>' : '<span class="tag">not connected</span>') + "</h3>"
      + '<div class="field"><div class="lbl">Apps Script Web App URL</div><textarea class="inp" id="setUrl" rows="2" placeholder="https://script.google.com/macros/s/.../exec" style="font-family:monospace;font-size:12px;">' + esc(sheetUrl) + "</textarea></div>"
      + '<div class="row" style="margin-bottom:8px;"><button class="btn primary sm" onclick="connectSheet()">' + (sheetOn ? "Update link" : "Connect") + "</button>"
      + (sheetOn ? '<button class="btn ghost sm" onclick="fetchSheet()">Fetch bills from Sheet</button><button class="btn ghost sm" onclick="pushAllToSheet()">Send all bills to Sheet</button><button class="btn danger sm" onclick="disconnectSheet()">Disconnect</button>' : "") + "</div>"
      + (sheetOn ? sw("Share Kitchen orders between devices", "Counter phone and kitchen tablet show the same live orders", "kitchenSync") : "")
      + '<div class="muted small">' + (queue.length ? "⏳ " + queue.length + " item(s) waiting to upload — they go automatically when the internet is back. " : "") + 'Two-device kitchen sync and cancel sync need the new script in <b>RidhiChats_AppScript.gs</b> (see the user manual).</div></div>'
    + '<div class="card" style="margin-bottom:12px;"><h3>💾 Backup</h3><div class="muted small" style="margin-bottom:10px;">Everything is stored on this device. Download a backup file regularly and keep it in Google Drive or WhatsApp it to yourself.</div>'
      + '<div class="row"><button class="btn green sm" onclick="backupNow()">⬇️ Download backup</button><button class="btn ghost sm" onclick="document.getElementById(\'restoreFile\').click()">⬆️ Restore from backup</button><input type="file" id="restoreFile" accept=".json,application/json" class="hide" onchange="restoreBackup(this)"/></div></div>'
    + '<div class="card"><h3>ℹ️ About</h3><div class="muted small">Ridhi Chats POS v' + APP_VERSION + " · " + orders.length + " bills · " + expenses.length + " expenses · " + Object.keys(IMGS).length + " own photos · storage: " + (DB.ok ? "device database" : "browser storage") + "</div></div>";
}
// Read the typed fields into S (kept in memory until "Save changes" is tapped)
function stashSet(){
  if(!$("setName")) return;
  const g = id => $(id).value.trim();
  Object.assign(S, {shopName:g("setName") || "Ridhi Chats", tagline:g("setTag"), address:g("setAddr"), phone:g("setPhone"), gstin:g("setGstin").toUpperCase(), footer:g("setFoot"),
    upiId:g("setUpi").replace(/\s/g, ""), upiName:g("setUpiName"), loyaltyN:Math.max(0, parseInt(g("setLoyN")) || 0), loyaltyReward:g("setLoyR")});
}
// Redraw Settings without losing what was typed
function reSettings(){ stashSet(); renderSettings(); }
function saveSet(){
  stashSet();
  if(S.upiId && !/^[\w.\-]{2,}@[\w.\-]{2,}$/.test(S.upiId)){ toast("⚠️ UPI ID looks wrong — it should look like name@bank"); return; }
  const pw = $("setOwnerPw").value, pin = $("setStaffPin").value.trim();
  if(pw){ if(pw.length < 4){ toast("⚠️ Owner password needs at least 4 characters"); return; } S.ownerHash = passHash(pw.trim()); }
  if(pin){
    if(pin.length < 4){ toast("⚠️ Staff PIN needs at least 4 characters"); return; }
    if(passHash(pin) === (S.ownerHash || OWNER_DEFAULT_HASH)){ toast("⚠️ Staff PIN must be different from the owner password"); return; }
    S.staffHash = passHash(pin);
  }
  saveSettings(); applyShopName(); renderSettings(); toast("✅ Settings saved");
}
function removeStaffPin(){ S.staffHash = ""; saveSettings(); renderSettings(); toast("Staff PIN removed"); }
async function testPrint(){
  if(prnWorking || prnBusy) return;
  if(!navigator.bluetooth){ toast("⚠️ " + prnNoBleReason()); return; }
  prnWorking = true;
  try{
    if(!(await prnEnsureBT())) return;
    const P = prnPage(); P.head(); P.add("PRINTER TEST", "c", true); P.rule("-");
    P.add("12345678901234567890123456789012"); P.add("If this line fits, all is OK."); P.add("Tall bold", "l", true, 1); P.add("DOUBLE", "c", true, 2); P.rule("-");
    await prnSendBLE(linesToBytes(P.L)); toast("✅ Test slip printed");
  }catch(e){ toast("❌ Test print failed"); }
  finally{ prnWorking = false; if(curView === "settings") reSettings(); }
}

// ── BACKUP / RESTORE ──
function backupNow(){
  const ls = {};
  for(let i = 0; i < localStorage.length; i++){ const k = localStorage.key(i); if(k && k.startsWith("rc_") && k !== LS.O) ls[k] = localStorage.getItem(k); }
  const data = {app:"ridhi-chats-pos", version:APP_VERSION, exportedAt:new Date().toISOString(), ls, orders, images:IMGS};
  download("ridhi_pos_backup_" + isoToday() + ".json", JSON.stringify(data), "application/json");
  toast("✅ Backup downloaded — keep it somewhere safe");
}
function restoreBackup(input){
  const f = input.files && input.files[0]; input.value = "";
  if(!f) return;
  const rd = new FileReader();
  rd.onload = async () => {
    let d;
    try{ d = JSON.parse(rd.result); }catch(e){ toast("❌ That file is not a valid backup"); return; }
    if(!d || d.app !== "ridhi-chats-pos" || !Array.isArray(d.orders)){ toast("❌ That file is not a Ridhi Chats POS backup"); return; }
    if(!confirm("Restore backup from " + String(d.exportedAt || "").slice(0, 10) + " with " + d.orders.length + " bills?\n\nThis REPLACES everything on this device.")) return;
    busy(true, "Restoring...");
    try{
      Object.keys(localStorage).filter(k => k.startsWith("rc_")).forEach(k => localStorage.removeItem(k));
      Object.entries(d.ls || {}).forEach(([k, v]) => { if(k.startsWith("rc_")) localStorage.setItem(k, v); });
      const os = d.orders.map(normOrder);
      if(DB.ok){
        await DB.clear("orders"); await DB.bulk("orders", os);
        await DB.clear("images");
        for(const [k, v] of Object.entries(d.images || {})) await DB.put("images", v, k);
      } else localStorage.setItem(LS.O, JSON.stringify(os));
      location.reload();
    }catch(e){ busy(false); toast("❌ Restore failed: " + (e && e.message || e)); }
  };
  rd.readAsText(f);
}

// ── PWA: offline + install ──
let deferredInstall = null;
function pwaInit(){
  const secure = location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1";
  if("serviceWorker" in navigator && secure){
    navigator.serviceWorker.register("sw.js").then(reg => {
      reg.addEventListener("updatefound", () => {
        const nw = reg.installing;
        if(nw) nw.addEventListener("statechange", () => { if(nw.state === "installed" && navigator.serviceWorker.controller) $("updateBanner").classList.add("show"); });
      });
    }).catch(() => {});
  }
  window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferredInstall = e; setTimeout(() => $("installBanner").classList.add("show"), 2500); });
  window.addEventListener("appinstalled", () => { deferredInstall = null; $("installBanner").classList.remove("show"); toast("✅ App installed"); });
}
function doInstall(){
  $("installBanner").classList.remove("show");
  if(!deferredInstall){ toast("Use the browser menu → Add to Home screen"); return; }
  deferredInstall.prompt(); deferredInstall = null;
}
