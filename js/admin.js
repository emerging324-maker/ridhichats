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
      + (live ? '<button class="btn ghost sm owner-only" data-id="' + esc(o.id) + '" onclick="openCancel(this.dataset.id)">Cancel bill</button>' : "")
      + '<button class="btn danger sm owner-only" data-id="' + esc(o.id) + '" onclick="deleteBill(this.dataset.id)">🗑 Delete</button></div></div>';
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
  if(!sheetReady(confirmCancel)) return;
  enqueue({type:"cancel", id:o.id, reason});
  closeM("cancelMod"); renderHist(); renderCats();
  toast("❌ Bill #" + o.token + " cancelled");
}
// Delete removes the bill completely (from the Sheet too). Its number becomes free:
// if it was today's last bill, the next bill gets the same number.
function deleteBill(id){
  if(!needOwner()) return;
  const o = findOrder(id); if(!o) return;
  if(!confirm("Delete bill #" + o.token + " (" + fmt(o.total) + ") for ever?\n\nIt is removed from the Google Sheet and from all reports. This cannot be undone.")) return;
  if(!sheetReady(() => deleteBill(id))) return;
  enqueue({type:"orderDelete", id:o.id});
  renderHist(); renderCats();
  toast("🗑️ Bill #" + o.token + " deleted · next bill number: " + nextToken(), 4500);
}

// ── KITCHEN (always straight from the Sheet, so every device shows the same orders) ──
let kitTimer = null;
function kitchenList(){
  const t = isoToday();
  return orders.filter(o => orderISO(o) === t && isLive(o) && (o.kitchenStatus || "preparing") !== "done");
}
function setKS(id, s){
  const o = findOrder(id); if(!o) return;
  if(!sheetReady(() => setKS(id, s))) return;
  if(s === "ready") playSound("ready");
  enqueue({type:"kitchen", id:o.id, status:s});
  renderKitchen();
}
function renderKitchen(){
  const list = kitchenList();
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
  if(sheetOn && sheetState !== "down"){ tag.className = "tag green"; tag.textContent = "● LIVE · from the Sheet"; }
  else { tag.className = "tag red"; tag.textContent = sheetOn ? "● No connection" : "● Sheet not connected"; }
}
function kitchenOpen(){
  renderKitchen(); kitchenClose();
  kitchenPoll(); kitTimer = setInterval(kitchenPoll, 8000);
}
function kitchenClose(){ if(kitTimer){ clearInterval(kitTimer); kitTimer = null; } }
function kitchenRefresh(manual){
  pullSheet().then(r => { renderKitchen(); if(manual) toast(r && r.ok ? "🔄 Kitchen refreshed" : "⚠️ Could not reach the Sheet"); });
}
// Light check every 8 seconds while the Kitchen screen is open: status changes and new orders.
async function kitchenPoll(){
  if(!sheetOn || navigator.onLine === false) return;
  const seq = writeSeq;
  let data;
  try{ data = await jsonp(sheetUrl, {action:"getKitchen", d:isoToday()}); }catch(e){ return; }
  if(!data || !Array.isArray(data.kitchen) || seq !== writeSeq) return; // something was saved meanwhile → next round
  let unknown = 0, changed = false;
  data.kitchen.forEach(r => {
    if(!r || r.id == null) return;
    const o = findOrder(r.id);
    if(!o){ if(r.status !== "cancelled" && r.kitchenStatus !== "done") unknown++; return; }
    const st = r.kitchenStatus || "preparing";
    if(o.kitchenStatus !== st){ o.kitchenStatus = st; changed = true; }
    if(r.status === "cancelled" && isLive(o)){ o.status = "cancelled"; changed = true; }
  });
  if(unknown){
    await pullSheet();
    playSound("neworder"); toast("🔔 " + unknown + " new order" + (unknown > 1 ? "s" : ""));
  }
  if((changed || unknown) && curView === "kitchen") renderKitchen();
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
let expEditId = "", expNewId = "", expCatSel = "", expPMSel = "cash";
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
  expEditId = e ? e.id : ""; expNewId = "";
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
  if(!sheetReady(saveExp)) return;
  const old = expEditId ? expenses.find(e => String(e.id) === String(expEditId)) : null;
  enqueue(Object.assign({type:"expense"}, old || {id:"e" + Date.now()}, rec));
  closeM("expMod"); renderExp(); toast(old ? "✅ Expense updated" : "✅ Expense added");
}
function deleteExp(id){
  if(!needOwner()) return;
  if(!confirm("Delete this expense?")) return;
  if(!sheetReady(() => deleteExp(id))) return;
  enqueue({type:"expenseDelete", id});
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

// ── GOOGLE SHEET SYNC ──
// The Sheet is where bills and expenses live. To keep billing instant, every change is applied on
// screen at once and put in a small "to sync" list (the outbox) on the device. The outbox is pushed
// to the Sheet in the background — immediately when there is internet, otherwise as soon as it
// returns — and each item is removed from the device the moment the Sheet confirms it.
let sheetState = "idle";   // idle | ok | down
let writeSeq = 0;          // goes up on every confirmed save, so an older read can never overwrite newer data
let pulling = false, flushing = false, lastPull = null, lastPush = null, dataSig = "";
let outbox = lsGet(LS.OUTBOX, []);
if(!Array.isArray(outbox)) outbox = [];
function saveOutbox(){ lsSet(LS.OUTBOX, outbox); }
const offline = () => navigator.onLine === false || sheetState === "down";

function updateSyncUI(){
  const p = $("syncPill"); if(!p) return;
  const n = outbox.length;
  if(!sheetOn){ p.className = "pill off"; p.textContent = "Sheet off"; }
  else if(n && offline()){ p.className = "pill warn"; p.textContent = "⚠ Offline · " + n + " to sync"; }
  else if(n){ p.className = "pill warn"; p.textContent = "⏳ Syncing " + n; }
  else if(offline()){ p.className = "pill warn"; p.textContent = "⚠ No connection"; }
  else if(sheetState === "ok"){ p.className = "pill ok"; p.textContent = "Sheet ✓"; }
  else { p.className = "pill"; p.textContent = "Sheet…"; }
  if(curView === "sync") renderSync();
}
function jsonp(url, params){
  return new Promise((res, rej) => {
    const cb = "_rc_" + Date.now() + "_" + Math.floor(Math.random() * 1e6), sc = document.createElement("script");
    const done = () => { clearTimeout(t); try{ delete window[cb]; }catch(e){ window[cb] = undefined; } if(sc.parentNode) sc.parentNode.removeChild(sc); };
    const t = setTimeout(() => { done(); rej(new Error("timeout")); }, 15000);
    window[cb] = d => { done(); res(d); };
    sc.onerror = () => { done(); rej(new Error("network")); };
    sc.src = url + (url.includes("?") ? "&" : "?") + Object.entries(Object.assign({callback:cb}, params)).map(([k, v]) => k + "=" + encodeURIComponent(v)).join("&");
    document.body.appendChild(sc);
  });
}
// Send one change to the Sheet and wait for its answer.
async function sheetWrite(body){
  if(!sheetOn) return {ok:false, reason:"nolink"};
  if(navigator.onLine === false) return {ok:false, reason:"offline"};
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 25000);
  try{
    const r = await fetch(sheetUrl, {method:"POST", body:JSON.stringify(body), signal:ctl.signal});
    const j = await r.json();
    if(j && j.ok){ writeSeq++; sheetState = "ok"; return Object.assign({}, j, {ok:true}); }
    return {ok:false, reason:"script", error:String((j && j.error) || "")};
  }catch(e){ sheetState = "down"; return {ok:false, reason:"network"}; }
  finally{ clearTimeout(t); }
}

// ── Applying a change to what is on screen ──
function normExpense(x){
  const iso = toISO(x.dateISO || x.date), p = iso.split("-");
  return {id:String(x.id), desc:String(x.desc || ""), amount:r2(x.amount), dateISO:iso, date:p.length === 3 ? +p[2] + "/" + +p[1] + "/" + p[0] : "",
    category:String(x.category || "other"), paidVia:String(x.paidVia || "cash")};
}
function applyOp(b){
  const same = x => String(x.id) === String(b.id);
  if(b.type === "order"){
    const o = Object.assign({}, b); delete o.type;
    orders = orders.filter(x => !same(x)); orders.push(normOrder(o));
  } else if(b.type === "cancel"){ const o = orders.find(same); if(o){ o.status = "cancelled"; o.cancelReason = b.reason || ""; o.kitchenStatus = "done"; } }
  else if(b.type === "orderDelete") orders = orders.filter(x => !same(x));
  else if(b.type === "kitchen"){ const o = orders.find(same); if(o) o.kitchenStatus = b.status; }
  else if(b.type === "expense"){ expenses = expenses.filter(x => !same(x)); expenses.push(normExpense(b)); }
  else if(b.type === "expenseDelete") expenses = expenses.filter(x => !same(x));
}
function sortData(){
  sortOrders();
  expenses.sort((a,b) => a.dateISO < b.dateISO ? 1 : a.dateISO > b.dateISO ? -1 : (String(b.id) > String(a.id) ? 1 : -1));
}
// Is the Sheet connected at all? (No internet is fine — the change waits in the outbox.)
function sheetReady(retry){
  if(sheetOn) return true;
  showNet("nolink", retry);
  return false;
}
// Make a change: show it at once, remember it in the outbox, push it in the background.
function enqueue(body){
  const inFlight = it => flushing && outbox[0] === it;
  const mine = it => String(it.body.id) === String(body.id);
  // deleting something that never reached the Sheet → just forget it, nothing to send
  if((body.type === "orderDelete" || body.type === "expenseDelete")){
    const make = body.type === "orderDelete" ? "order" : "expense";
    if(outbox.some(it => mine(it) && it.body.type === make && !inFlight(it))){
      outbox = outbox.filter(it => !mine(it) || inFlight(it));
      applyOp(body); sortData(); rebuildIndex(); syncTokenHint(); saveOutbox(); updateSyncUI();
      return;
    }
  }
  // several kitchen taps on the same bill → only the last one needs sending
  if(body.type === "kitchen") outbox = outbox.filter(it => !(mine(it) && it.body.type === "kitchen" && !inFlight(it)));
  applyOp(body); sortData(); rebuildIndex(); syncTokenHint();
  outbox.push({k:Date.now() + "_" + Math.floor(Math.random() * 1e6), at:Date.now(), body, tries:0, err:""});
  saveOutbox(); updateSyncUI(); flushOutbox();
}
// Push the outbox to the Sheet, oldest first. Stops at the first failure and tries again later.
async function flushOutbox(){
  if(flushing || !sheetOn || !outbox.length || navigator.onLine === false){ updateSyncUI(); return; }
  flushing = true;
  let oldScript = false, tokenFix = false;
  try{
    while(outbox.length && sheetOn){
      const it = outbox[0];
      const r = await sheetWrite(it.body);
      if(!r.ok){ it.tries++; it.err = r.reason === "script" ? "The Sheet refused it: " + (r.error || "error") : "No connection"; saveOutbox(); break; }
      outbox.shift(); saveOutbox(); lastPush = new Date();
      if(it.body.type === "order" && r.token){
        const o = findOrder(it.body.id), t = String(r.token).padStart(3, "0");
        if(o && o.token !== t){ o.token = t; tokenFix = true; }
      }
      if(it.body.type === "orderDelete" && r.deleted !== true) oldScript = true;
      updateSyncUI();
    }
  }finally{ flushing = false; updateSyncUI(); }
  if(tokenFix){ syncTokenHint(); refreshView(); }
  if(oldScript){ showNet("oldscript"); pullSheet(); }
}
function syncNow(){
  if(!sheetReady(syncNow)) return;
  if(navigator.onLine === false){ toast("📡 No internet — it will sync by itself when the connection is back"); return; }
  sheetState = "idle"; updateSyncUI();
  flushOutbox().then(() => pullSheet()).then(() => toast(outbox.length ? "⚠️ " + outbox.length + " still waiting — see the Sync page" : "✅ Everything is in the Sheet"));
}
function discardOutbox(k){
  if(!needOwner()) return;
  const it = outbox.find(x => x.k === k); if(!it) return;
  if(!confirm("Remove this from the sync list?\n\nIt will NOT be sent to the Sheet. This cannot be undone.")) return;
  outbox = outbox.filter(x => x.k !== k); saveOutbox();
  pullSheet().then(r => { if(!r || !r.ok) refreshView(); });
  updateSyncUI();
}

// ── "Sheet not connected" / "update script" pop-up ──
let netRetry = null;
function showNet(reason, retry){
  netRetry = retry || null;
  let title, msg, btns;
  if(reason === "oldscript"){
    title = "⚠️ Update the Apps Script";
    msg = "Deleting a bill needs the new script. In Google Sheets open Extensions → Apps Script, paste the new <b>RidhiChats_AppScript.gs</b>, then Deploy → Manage deployments → pencil → New version → Deploy.<br><br>The bill was <b>not</b> deleted from the Sheet.";
    btns = '<button class="btn ghost" onclick="closeM(\'netMod\')">OK</button>';
  } else {
    title = "🔌 Google Sheet not connected";
    msg = "Bills are stored in the Google Sheet, and the Sheet is switched off on this device. Connect it to continue.<br><br><b>Nothing is lost</b> — everything is still on the screen.";
    btns = '<button class="btn primary" onclick="netConnect()">🔗 Connect now</button><button class="btn ghost" onclick="closeM(\'netMod\')">Close</button>';
  }
  $("netTitle").textContent = title; $("netMsg").innerHTML = msg; $("netBtns").innerHTML = btns;
  openM("netMod"); playSound("error");
}
function netConnect(){
  const f = netRetry; netRetry = null; closeM("netMod");
  sheetUrl = DEFAULT_SHEET_URL; sheetOn = true; localStorage.removeItem(LS.U); sheetState = "idle"; // back to the built-in link
  updateSyncUI(); pullSheet();
  if(f) f();
}
async function connectSheet(){
  const url = $("setUrl").value.trim();
  if(!/^https:\/\/script\.google\.com\/.+\/exec/.test(url)){ toast("⚠️ Paste the Web App URL ending in /exec"); return; }
  if(outbox.length && url !== sheetUrl && !confirm(outbox.length + " change(s) are still waiting to sync. They will be sent to the NEW Sheet link. Continue?")) return;
  sheetUrl = url; sheetOn = true; localStorage.setItem(LS.U, url); sheetState = "idle";
  updateSyncUI();
  await fetchSheet(); // load this Sheet's bills and expenses straight away
  reSettings();
}
function useDefaultSheet(){
  sheetUrl = DEFAULT_SHEET_URL; sheetOn = true; localStorage.removeItem(LS.U); sheetState = "idle"; // no saved link = built-in link
  updateSyncUI(); reSettings(); fetchSheet();
}
function disconnectSheet(){
  if(!confirm("Disconnect the Google Sheet?\n\nBilling stops until it is connected again." + (outbox.length ? "\n\n" + outbox.length + " change(s) not yet synced will stay on this device and sync when you reconnect." : ""))) return;
  sheetUrl = ""; sheetOn = false; localStorage.setItem(LS.U, ""); // "" = stay off, do not fall back to the built-in link
  orders = []; expenses = []; dataSig = ""; outbox.forEach(it => applyOp(it.body)); sortData(); rebuildIndex();
  updateSyncUI(); renderSettings(); toast("🔌 Sheet disconnected");
}
// Load ALL bills and expenses from the Sheet (replacing what was shown), then put the changes that
// are still waiting in the outbox back on top. Runs when the app opens, every minute, and on demand.
async function pullSheet(){
  if(!sheetOn){ updateSyncUI(); return null; }
  if(pulling) return null;
  pulling = true;
  const res = {ok:false, bills:0, exp:0, expSupported:false};
  try{
    for(let attempt = 0; attempt < 3; attempt++){
      const seq = writeSeq;
      const data = await jsonp(sheetUrl, {action:"getOrders"});
      if(!data || !Array.isArray(data.orders)) throw new Error("bad answer");
      let exp = null;
      try{ const e = await jsonp(sheetUrl, {action:"getExpenses"}); if(e && Array.isArray(e.expenses)) exp = e.expenses; }catch(err){}
      if(seq !== writeSeq) continue; // something was saved while we were reading → read again
      orders = data.orders.filter(r => r && r.id != null).map(normOrder);
      if(exp){ expenses = exp.filter(x => x && x.id != null && x.id !== "").map(normExpense); res.expSupported = true; }
      outbox.forEach(it => applyOp(it.body)); // not-yet-synced changes stay visible
      sortData(); rebuildIndex(); syncTokenHint();
      res.ok = true; res.bills = orders.length; res.exp = expenses.length;
      sheetState = "ok"; lastPull = new Date();
      const sig = orders.map(o => o.id + ":" + o.status + ":" + o.kitchenStatus + ":" + o.token).join("|") + "#" + expenses.map(e => e.id + ":" + e.amount).join("|");
      if(sig !== dataSig){ dataSig = sig; refreshView(); }
      break;
    }
  }catch(e){ sheetState = "down"; }
  finally{ pulling = false; updateSyncUI(); }
  if(res.ok) flushOutbox();
  return res;
}
function refreshView(){
  if(curView === "dashboard") renderDash();
  if(curView === "history") renderHist();
  if(curView === "expenses") renderExp();
  if(curView === "customers") renderCustomers();
  if(curView === "kitchen") renderKitchen();
  if(curView === "pos") renderCats();
}
async function fetchSheet(){
  if(!sheetOn){ showNet("nolink"); return; }
  busy(true, "Loading from Google Sheets...");
  let r = await pullSheet();
  if(!r){ await new Promise(x => setTimeout(x, 1500)); r = await pullSheet(); }
  busy(false);
  if(!r || !r.ok) toast("📡 Could not reach the Sheet — check the internet");
  else toast("✅ Sheet: " + r.bills + " bills · " + r.exp + " expenses", 4000);
  if(curView === "settings") reSettings();
}

// ── SYNC PAGE ──
function opLabel(b){
  const o = b.type === "order" ? b : findOrder(b.id);
  const tok = o ? "#" + o.token : "bill";
  if(b.type === "order") return {icon:"🧾", t:"New bill " + tok, d:fmt(b.total) + " · " + (b.items || []).length + " item(s) · " + (b.time || "")};
  if(b.type === "cancel") return {icon:"❌", t:"Cancel " + tok, d:b.reason || ""};
  if(b.type === "orderDelete") return {icon:"🗑️", t:"Delete a bill", d:""};
  if(b.type === "kitchen") return {icon:"👨‍🍳", t:"Kitchen: " + tok + " → " + b.status, d:""};
  if(b.type === "expense") return {icon:"💸", t:"Expense", d:fmt(b.amount) + " · " + (b.desc || "")};
  if(b.type === "expenseDelete") return {icon:"🗑️", t:"Delete an expense", d:""};
  return {icon:"•", t:b.type, d:""};
}
function renderSync(){
  const el = $("syncPage"); if(!el) return;
  const n = outbox.length, tm = d => d ? d.toLocaleTimeString("en-IN", {hour:"2-digit", minute:"2-digit"}) : "—";
  let st, cls;
  if(!sheetOn){ st = "Google Sheet is switched off"; cls = "red"; }
  else if(offline()){ st = "No connection to the Sheet"; cls = "red"; }
  else if(n){ st = "Syncing…"; cls = "gold"; }
  else { st = "Everything is in the Sheet"; cls = "green"; }
  el.innerHTML = '<div class="page-head"><h1>🔄 Sync</h1><div class="row"><button class="btn primary sm" onclick="syncNow()">Sync now</button><button class="btn ghost sm" onclick="fetchSheet()">Refresh from Sheet</button></div></div>'
    + '<div class="stats"><div class="stat' + (n ? " hero" : "") + '"><div class="si">' + (n ? "⏳" : "✅") + '</div><div class="sv">' + n + '</div><div class="sl">waiting to sync</div></div>'
    + '<div class="stat"><div class="si">📡</div><div class="sv" style="font-size:15px;"><span class="tag ' + cls + '">' + st + '</span></div><div class="sl">status</div></div>'
    + '<div class="stat"><div class="si">⬆️</div><div class="sv">' + tm(lastPush) + '</div><div class="sl">last sent to Sheet</div></div>'
    + '<div class="stat"><div class="si">⬇️</div><div class="sv">' + tm(lastPull) + '</div><div class="sl">last loaded from Sheet</div></div></div>'
    + '<div class="card" style="margin-bottom:12px;"><h3>Waiting to sync</h3>'
    + (n ? outbox.map((it, i) => { const L = opLabel(it.body);
        return '<div class="sw-row"><div style="min-width:0;"><b>' + L.icon + " " + esc(L.t) + '</b><span class="d">' + esc(L.d) + (it.err ? ' · <span style="color:var(--red)">' + esc(it.err) + (it.tries > 1 ? " (" + it.tries + " tries)" : "") + "</span>" : (i === 0 && flushing ? " · sending…" : "")) + "</span></div>"
          + '<button class="btn danger sm owner-only" data-k="' + esc(it.k) + '" onclick="discardOutbox(this.dataset.k)">Remove</button></div>';
      }).join("") : '<div class="muted small">Nothing is waiting. Every bill and expense is saved in the Google Sheet.</div>') + "</div>"
    + '<div class="card"><h3>How it works</h3><div class="muted small" style="line-height:1.6;">Bills print at once and are sent to the Google Sheet in the background — usually within a few seconds. With no internet they wait here and go by themselves when the connection is back; you can keep billing. Once the Sheet has a bill it is removed from this list and from the phone. <b>Do not clear Chrome data while something is waiting here.</b></div></div>';
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
      + (sheetUrl !== DEFAULT_SHEET_URL ? '<button class="btn ghost sm" onclick="useDefaultSheet()">Use built-in link</button>' : "")
      + (sheetOn ? '<button class="btn ghost sm" onclick="fetchSheet()">🔄 Refresh from Sheet</button><button class="btn danger sm" onclick="disconnectSheet()">Disconnect</button>' : "") + "</div>"
      + '<div class="muted small">Bills and expenses are stored in this Google Sheet. A bill prints at once and is sent to the Sheet in the background; with no internet it waits on the <a href="#" style="color:var(--gold)" onclick="sv(\'sync\');return false;">Sync page</a> and goes by itself later.' + (lastPull ? " Last loaded " + lastPull.toLocaleTimeString("en-IN", {hour:"2-digit", minute:"2-digit"}) + "." : "") + ' Deleting a bill needs the latest <b>RidhiChats_AppScript.gs</b>.</div></div>'
    + '<div class="card" style="margin-bottom:12px;"><h3>💾 Backup of this device setup</h3><div class="muted small" style="margin-bottom:10px;">Saves the menu changes, your photos and these settings (not bills — those are in the Sheet). Use it to set up a new phone quickly.</div>'
      + '<div class="row"><button class="btn green sm" onclick="backupNow()">⬇️ Download backup</button><button class="btn ghost sm" onclick="document.getElementById(\'restoreFile\').click()">⬆️ Restore from backup</button><input type="file" id="restoreFile" accept=".json,application/json" class="hide" onchange="restoreBackup(this)"/></div></div>'
    + '<div class="card"><h3>ℹ️ About</h3><div class="muted small">Ridhi Chats POS v' + APP_VERSION + " · " + orders.length + " bills and " + expenses.length + " expenses in the Sheet · " + Object.keys(IMGS).length + " own photos</div></div>";
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
  for(let i = 0; i < localStorage.length; i++){ const k = localStorage.key(i); if(k && k.startsWith("rc_")) ls[k] = localStorage.getItem(k); }
  const data = {app:"ridhi-chats-pos", version:APP_VERSION, exportedAt:new Date().toISOString(), ls, images:IMGS};
  download("ridhi_pos_setup_" + isoToday() + ".json", JSON.stringify(data), "application/json");
  toast("✅ Setup backup downloaded (menu, photos, settings)");
}
function restoreBackup(input){
  const f = input.files && input.files[0]; input.value = "";
  if(!f) return;
  const rd = new FileReader();
  rd.onload = async () => {
    let d;
    try{ d = JSON.parse(rd.result); }catch(e){ toast("❌ That file is not a valid backup"); return; }
    if(!d || d.app !== "ridhi-chats-pos" || !d.ls){ toast("❌ That file is not a Ridhi Chats POS backup"); return; }
    if(!confirm("Restore the setup backup from " + String(d.exportedAt || "").slice(0, 10) + "?\n\nThis replaces the menu changes, photos and settings on this device. Bills are not affected — they live in the Sheet.")) return;
    busy(true, "Restoring...");
    try{
      Object.keys(localStorage).filter(k => k.startsWith("rc_")).forEach(k => localStorage.removeItem(k));
      Object.entries(d.ls || {}).forEach(([k, v]) => { if(k.startsWith("rc_")) localStorage.setItem(k, v); });
      localStorage.setItem(LS.RESET, DATA_RESET_ID);
      if(DB.ok){
        await DB.clear("images");
        for(const [k, v] of Object.entries(d.images || {})) await DB.put("images", v, k);
      }
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
