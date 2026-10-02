"use strict";
// ══════════════════════════════════════════════════════
//  THERMAL PRINTER — POSiFLOW PSF210 (58mm, ESC/POS)
//  Route "bt":     Bluetooth BLE  → Chrome on Android / Windows / Mac
//  Route "rawbt":  RawBT app      → Android, for Classic-Bluetooth printers
//  Route "serial": USB / COM port → Chrome / Edge on PC
//  Prints: customer bill, kitchen slip (KOT), day-end report
// ══════════════════════════════════════════════════════
const PRN_COLS = 32; // 58mm paper, Font A = 32 characters per line
const PRN_UA = navigator.userAgent || "";
const PRN_IS_ANDROID = /android/i.test(PRN_UA);
const PRN_IS_IOS = /iphone|ipad|ipod/i.test(PRN_UA) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
let btDevice = null, btChar = null, prnWorking = false, prnBusy = false, serialPort = null;

// Known BLE print channels (service → write characteristic).
const PRN_BLE = [
  {s:"000018f0-0000-1000-8000-00805f9b34fb", c:"00002af1-0000-1000-8000-00805f9b34fb"},
  {s:"e7810a71-73ae-499d-8c15-faa9aef0c3f2", c:"bef8d6c9-9c21-4c9e-b632-bd58c1009f9f"},
  {s:"49535343-fe7d-4ae5-8fa9-9fafd205e455", c:"49535343-8841-43f4-a8d4-ecbe34729bb3"},
  {s:"0000ff00-0000-1000-8000-00805f9b34fb", c:"0000ff02-0000-1000-8000-00805f9b34fb"},
  {s:"0000fff0-0000-1000-8000-00805f9b34fb", c:"0000fff2-0000-1000-8000-00805f9b34fb"},
  {s:"0000ffe0-0000-1000-8000-00805f9b34fb", c:"0000ffe1-0000-1000-8000-00805f9b34fb"},
  {s:"0000ae30-0000-1000-8000-00805f9b34fb", c:"0000ae01-0000-1000-8000-00805f9b34fb"},
  {s:"6e400001-b5a3-f393-e0a9-e50e24dcca9e", c:"6e400002-b5a3-f393-e0a9-e50e24dcca9e"},
];
const ESC = 0x1B, GS = 0x1D;
const prnSleep = ms => new Promise(r => setTimeout(r, ms));

// ── Text helpers (the printer only knows plain ASCII) ──
function prnSafe(s){
  return String(s == null ? "" : s)
    .replace(/₹/g, "Rs.")
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .replace(/[–—−]/g, "-").replace(/×/g, "x")
    .replace(/\s+/g, " ")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/ +/g, " ").trim();
}
function prnNum(n){ const v = Math.round((parseFloat(n) || 0) * 100) / 100; return v % 1 === 0 ? v.toFixed(0) : v.toFixed(2); }
function prnRs(n){ return "Rs." + prnNum(n); }
function prnDate(d){
  const p = String(d || "").split("/");
  return p.length === 3 ? p[0].padStart(2, "0") + "/" + p[1].padStart(2, "0") + "/" + p[2] : prnSafe(d);
}
function prnWrap(s, w){
  const out = []; let line = "";
  String(s).split(" ").forEach(word => {
    while(word.length > w){ if(line){ out.push(line); line = ""; } out.push(word.slice(0, w)); word = word.slice(w); }
    if(!word) return;
    if(!line) line = word;
    else if(line.length + 1 + word.length <= w) line += " " + word;
    else { out.push(line); line = word; }
  });
  if(line) out.push(line);
  return out.length ? out : [""];
}
// Line builder. Line = {t:text, a:"l"|"c", b:bold, s:0 normal | 1 tall | 2 double (max 16 chars)}
// Only commands proven on the PSF210 are ever used: reset, align, bold, size, feed. Never a cut command.
function prnPage(){
  const W = PRN_COLS, L = [];
  const add = (t, a, b, s) => { L.push({t:String(t).slice(0, s === 2 ? W / 2 : W), a:a || "l", b:!!b, s:s || 0}); };
  const row2 = (l, r) => {
    r = String(r).slice(0, W - 2);
    l = String(l).slice(0, W - r.length - 1);
    return l + " ".repeat(W - l.length - r.length) + r;
  };
  return {W, L, add, row2,
    rule: ch => add(ch.repeat(W)),
    center: (txt, b) => prnWrap(prnSafe(txt), W).forEach(l => add(l, "c", b)),
    head(){
      const shop = (prnSafe(S.shopName) || "SHOP").toUpperCase();
      add(shop, "c", true, shop.length <= W / 2 ? 2 : 1);
    }};
}

// ── Customer bill ──
function receiptLayout(o){
  const P = prnPage(), {W, add, row2, rule, center} = P;
  const NAME_W = 15, nums = (q, r, a) => String(q).padStart(3) + String(r).padStart(6) + String(a).padStart(8);
  P.head();
  if(prnSafe(S.tagline)) center("* " + S.tagline + " *");
  if(prnSafe(S.address)) center(S.address);
  if(prnSafe(S.phone)) center("Ph: " + S.phone);
  if(prnSafe(S.gstin)) center("GSTIN: " + S.gstin);
  rule("=");
  if(o.status === "cancelled"){ add("** CANCELLED BILL **", "c", true, 1); rule("="); }
  add(row2("Token: #" + prnSafe(o.token), prnDate(o.date)));
  add(row2("Time: " + prnSafe(o.time).toUpperCase(), "Pay: " + prnSafe(String(o.paymentMethod || "cash").toUpperCase())));
  if(o.orderType) add("Type: " + prnSafe(typeLabel(o.orderType)));
  if(o.customerName) prnWrap(prnSafe("Customer: " + o.customerName), W).forEach(l => add(l));
  if(o.customerPhone) add(prnSafe("Phone: " + o.customerPhone));
  rule("-");
  add("ITEM".padEnd(NAME_W) + nums("QTY", "RATE", "AMOUNT"), "l", true);
  rule("-");
  let totQty = 0;
  const items = o.items || [];
  items.forEach(i => {
    const qty = parseInt(i.qty) || 0, price = parseFloat(i.price) || 0;
    totQty += qty;
    const name = prnSafe(i.name) || "Item";
    const n = nums(qty, prnNum(price), prnNum(price * qty));
    if(name.length <= NAME_W && String(qty).length <= 2 && n.length <= W - NAME_W) add(name.padEnd(NAME_W) + n);
    else { prnWrap(name, W).forEach(l => add(l)); add(n.padStart(W)); }
    if(prnSafe(i.includes)) prnWrap("(" + prnSafe(i.includes) + ")", W - 2).forEach(l => add("  " + l));
    if(prnSafe(i.note)) prnWrap("> " + prnSafe(i.note), W - 2).forEach(l => add("  " + l));
  });
  rule("-");
  add(row2("Items: " + items.length, "Qty: " + totQty));
  add(row2("Subtotal", prnNum(o.subtotal)));
  if(parseFloat(o.discount) > 0) add(row2("Discount", "-" + prnNum(o.discount)));
  if(parseFloat(o.gst) > 0){
    add(row2("CGST @2.5% (incl.)", prnNum(o.gst / 2)));
    add(row2("SGST @2.5% (incl.)", prnNum(o.gst / 2)));
  }
  rule("=");
  add(row2("TOTAL", prnRs(o.total)), "l", true, 1);
  rule("=");
  if(parseFloat(o.cashGiven) > 0){
    add(row2("Cash received", prnNum(o.cashGiven)));
    add(row2("Change returned", prnNum(o.change)));
  }
  if(parseFloat(o.discount) > 0) add("You saved " + prnRs(o.discount) + "!", "c", true);
  if(prnSafe(o.loyalty)) center(o.loyalty, true);
  add("");
  add("YOUR TOKEN", "c", true);
  add("#" + prnSafe(o.token), "c", true, 2);
  add("");
  if(prnSafe(S.footer)) center(S.footer);
  rule("-");
  return P.L;
}

// ── Kitchen slip (no prices, big letters) ──
function kotLayout(o){
  const P = prnPage(), {W, add, row2, rule} = P;
  add("KITCHEN ORDER", "c", true);
  add("#" + prnSafe(o.token), "c", true, 2);
  add(row2(prnSafe(typeLabel(o.orderType || "dinein")).toUpperCase(), prnSafe(o.time).toUpperCase()), "l", true);
  if(o.customerName) add(prnSafe("For: " + o.customerName));
  rule("=");
  let totQty = 0;
  (o.items || []).forEach(i => {
    const qty = parseInt(i.qty) || 0; totQty += qty;
    prnWrap(qty + " x " + (prnSafe(i.name) || "Item"), W).forEach(l => add(l, "l", true, 1));
    if(prnSafe(i.includes)) prnWrap("(" + prnSafe(i.includes) + ")", W - 3).forEach(l => add("   " + l));
    if(prnSafe(i.note)) prnWrap(">> " + prnSafe(i.note), W - 3).forEach(l => add("   " + l, "l", true));
  });
  rule("=");
  add(row2("Items: " + (o.items || []).length, "Total qty: " + totQty));
  return P.L;
}

// ── Day-end report (d comes from dayEndData in admin.js) ──
function dayEndLayout(d){
  const P = prnPage(), {add, row2, rule} = P;
  P.head();
  add("DAY-END REPORT", "c", true);
  add(row2("Date: " + isoNice(d.iso), prnSafe(nowT()).toUpperCase()));
  rule("=");
  add(row2("Bills", d.bills));
  if(d.cancelled) add(row2("Cancelled bills (" + d.cancelled + ")", prnNum(d.cancelledAmt)));
  add(row2("Gross sales", prnNum(d.gross)));
  if(d.discount > 0) add(row2("Discounts", "-" + prnNum(d.discount)));
  add(row2("NET SALES", prnRs(d.net)), "l", true, 1);
  rule("-");
  add("PAYMENT", "l", true);
  add(row2("Cash", prnNum(d.cash)));
  add(row2("UPI", prnNum(d.upi)));
  add(row2("Card", prnNum(d.card)));
  rule("-");
  add("ORDER TYPE", "l", true);
  d.types.forEach(t => add(row2(prnSafe(t.label) + " (" + t.n + ")", prnNum(t.amt))));
  rule("-");
  add(row2("Expenses - cash", "-" + prnNum(d.expCash)));
  add(row2("Expenses - other", "-" + prnNum(d.expOther)));
  add(row2("PROFIT (sales - exp.)", prnNum(d.net - d.expCash - d.expOther)), "l", true);
  rule("-");
  add("CASH DRAWER", "l", true);
  add(row2("Opening cash", prnNum(d.opening)));
  add(row2("+ Cash sales", prnNum(d.cash)));
  add(row2("- Cash expenses", prnNum(d.expCash)));
  add(row2("CASH IN DRAWER", prnRs(d.drawer)), "l", true, 1);
  if(d.top.length){
    rule("-");
    add("TOP ITEMS", "l", true);
    d.top.forEach(t => add(row2(prnSafe(t.name), "x" + t.qty)));
  }
  rule("=");
  return P.L;
}

// ── Lines → printer bytes (commands only sent when the style changes) ──
function linesToBytes(lines){
  const b = [];
  let a = "l", bo = false, s = 0;
  b.push(ESC, 0x40); // reset — also clears anything left from an earlier print
  lines.forEach(ln => {
    if(ln.a !== a){ b.push(ESC, 0x61, ln.a === "c" ? 1 : 0); a = ln.a; }
    if(ln.b !== bo){ b.push(ESC, 0x45, ln.b ? 1 : 0); bo = ln.b; }
    if(ln.s !== s){ b.push(GS, 0x21, ln.s === 2 ? 0x11 : ln.s === 1 ? 0x01 : 0x00); s = ln.s; }
    for(let i = 0; i < ln.t.length; i++){ const c = ln.t.charCodeAt(i); b.push(c < 128 ? c : 63); }
    b.push(0x0A);
  });
  b.push(GS, 0x21, 0x00, ESC, 0x45, 0x00, ESC, 0x61, 0x00);
  b.push(ESC, 0x64, 4); // feed 4 lines to clear the tear bar
  return new Uint8Array(b);
}
// ── Lines → HTML (screen preview and browser print: identical to the paper) ──
function linesHTML(lines){
  return '<div class="rc-paper">' + lines.map(ln =>
    '<div class="rc-ln' + (ln.a === "c" ? " rc-c" : "") + (ln.b ? " rc-b" : "") + " rc-s" + ln.s + '">' + (esc(ln.t) || "&nbsp;") + "</div>"
  ).join("") + "</div>";
}
const RC_CSS = ".rc-paper{background:#fff;color:#111;font-family:'Courier New',Courier,monospace;width:max-content;margin:0 auto;}"
  + ".rc-ln{white-space:pre;width:32ch;line-height:1.35;overflow:hidden;text-align:left;}"
  + ".rc-c{text-align:center;}.rc-b{font-weight:700;}"
  + ".rc-s2{font-size:2em;width:16ch;line-height:1.15;margin:0 auto;}"
  + ".rc-s1{transform:scaleY(1.9);margin:.45em 0;}";

// ── Status bar in the receipt window ──
function prnUI(text, color, btnText, cls, busyFlag){
  const st = $("btStatusTxt"), cb = $("btConnBtn");
  if(st){ st.textContent = text; st.style.color = color; }
  if(cb){ cb.textContent = btnText; cb.className = "btn sm " + cls; cb.disabled = !!busyFlag; }
}
function prnNoBleReason(){
  if(PRN_IS_IOS) return "iPhone/iPad: use Other printer";
  if(!window.isSecureContext) return "Bluetooth needs the https:// link";
  if(PRN_IS_ANDROID) return "Open in Chrome, or use RawBT";
  return "Use Chrome or Edge for Bluetooth";
}
function prnRefreshStatus(){
  const name = (btDevice && btDevice.name) || "Printer";
  if(btChar && btDevice && btDevice.gatt.connected) prnUI("🟢 " + name + " ready", "var(--green)", "✓ " + name, "green", false);
  else if(btDevice) prnUI("Saved: " + name + " — tap Print bill", "var(--muted)", "Change", "blue", false);
  else if(!navigator.bluetooth) prnUI(prnNoBleReason(), "var(--muted)", "Connect", "blue", false);
  else prnUI("No printer connected", "var(--muted)", "Connect", "blue", false);
  const rb = $("rawbtBtn"), sb = $("serialBtn");
  if(rb) rb.classList.toggle("hide", !PRN_IS_ANDROID);
  if(sb) sb.classList.toggle("hide", !navigator.serial || PRN_IS_ANDROID);
}

// ── Bluetooth (BLE) ──
async function prnFindChar(server){
  const writable = c => c.properties.write || c.properties.writeWithoutResponse;
  for(const p of PRN_BLE){
    let svc;
    try{ svc = await server.getPrimaryService(p.s); }catch(e){ continue; }
    try{ const c = await svc.getCharacteristic(p.c); if(writable(c)) return c; }catch(e){}
    try{ for(const c of await svc.getCharacteristics()) if(writable(c)) return c; }catch(e){}
  }
  try{
    for(const svc of await server.getPrimaryServices()){
      try{ for(const c of await svc.getCharacteristics()) if(writable(c)) return c; }catch(e){}
    }
  }catch(e){}
  return null;
}
async function prnAttach(dev){
  if(btDevice && btDevice !== dev) btDevice.removeEventListener("gattserverdisconnected", onBTDisconnect);
  btDevice = dev; btChar = null;
  dev.removeEventListener("gattserverdisconnected", onBTDisconnect);
  dev.addEventListener("gattserverdisconnected", onBTDisconnect);
  prnUI("Connecting to " + (dev.name || "printer") + "...", "var(--gold)", "Connecting...", "blue", true);
  let server = null;
  for(let a = 0; a < 3 && !server; a++){
    try{ server = dev.gatt.connected ? dev.gatt : await dev.gatt.connect(); }
    catch(e){ await prnSleep(500); }
  }
  if(!server) throw new Error("Printer not reachable — switch it ON");
  const ch = await prnFindChar(server);
  if(!ch){
    try{ dev.gatt.disconnect(); }catch(e){}
    throw new Error("No print channel — pick the printer, not another device");
  }
  btChar = ch;
  prnRefreshStatus();
}
// Opens the Bluetooth device picker. Must run straight from a button tap.
async function prnPickAndConnect(){
  if(!navigator.bluetooth){ prnRefreshStatus(); toast("⚠️ " + prnNoBleReason()); return false; }
  prnBusy = true;
  prnUI("Choose your printer (PSF210)...", "var(--gold)", "Scanning...", "blue", true);
  let dev;
  try{
    dev = await navigator.bluetooth.requestDevice({acceptAllDevices:true, optionalServices:PRN_BLE.map(p => p.s)});
  }catch(e){
    prnBusy = false;
    prnRefreshStatus();
    const m = String((e && e.message) || e);
    if(/adapter/i.test(m)) toast("⚠️ Turn ON Bluetooth and try again");
    else if(e && e.name === "NotFoundError") toast("No printer selected");
    else if(e && e.name === "SecurityError") toast("⚠️ Tap Connect to choose the printer");
    else toast("❌ " + m.slice(0, 60));
    return false;
  }
  try{
    await prnAttach(dev);
    lsSet(LS.PRN, {id:dev.id, name:dev.name || ""});
    toast("✅ " + (dev.name || "Printer") + " connected & ready!");
    return true;
  }catch(e){
    if(btDevice === dev){ dev.removeEventListener("gattserverdisconnected", onBTDisconnect); btDevice = null; }
    btChar = null;
    const m = String((e && e.message) || e);
    prnUI("❌ " + m.slice(0, 45), "var(--red)", "Retry", "blue", false);
    toast("❌ " + m.slice(0, 60));
    return false;
  }finally{ prnBusy = false; }
}
async function connectBT(){
  if(prnWorking || prnBusy) return false;
  return prnPickAndConnect();
}
function onBTDisconnect(){
  const wasReady = !!btChar;
  btChar = null;
  prnRefreshStatus();
  if(wasReady && !prnWorking) toast("🔌 Printer sleeping — it reconnects on the next print");
}
// Make sure the BLE printer is connected. Returns true when ready.
async function prnEnsureBT(){
  if(btChar && btDevice && btDevice.gatt.connected) return true;
  if(!btDevice) return prnPickAndConnect();
  try{ await prnAttach(btDevice); return true; }
  catch(e){
    prnUI("Printer not reachable — switch ON, tap Connect", "var(--red)", "Connect", "blue", false);
    toast("⚠️ Printer not reachable — switch it ON");
    return false;
  }
}
// Send in 20-byte packets (the smallest BLE packet — big packets are what garbled old bills),
// paced slower than the printer prints so its small buffer can never overflow.
// A packet is only retried when the browser says it never started ("in progress"),
// so a retry can never print a line twice.
async function prnSendBLE(data){
  const withResp = !!btChar.properties.write;
  let n = 0;
  for(let i = 0; i < data.length; i += 20){
    const chunk = data.slice(i, i + 20);
    for(let a = 0; ; a++){
      try{
        if(withResp) await (btChar.writeValueWithResponse ? btChar.writeValueWithResponse(chunk) : btChar.writeValue(chunk));
        else await btChar.writeValueWithoutResponse(chunk);
        break;
      }catch(e){
        if(a >= 4 || !/in progress/i.test(String(e && e.message)) || !btDevice || !btDevice.gatt.connected) throw e;
        await prnSleep(150);
      }
    }
    await prnSleep(25);
    if(++n % 10 === 0) await prnSleep(120); // let the print head catch up every ~200 bytes
  }
}
function prnRawBT(bytes){
  let bin = "";
  for(let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  window.location.href = "intent:base64," + btoa(bin) + "#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;";
}
async function prnSerial(bytes){
  if(!serialPort) serialPort = await navigator.serial.requestPort();
  if(!serialPort.writable) await serialPort.open({baudRate:9600});
  const w = serialPort.writable.getWriter();
  try{ await w.write(bytes); } finally { w.releaseLock(); }
}

// ── Print jobs ──
// Stop accidental duplicate slips: a second print of the same thing needs a "yes".
const prnPrinted = new Set();
function prnLines(kind){
  if(kind === "day") return {lines:dayEndLayout(dayEndData()), key:"", what:"Day-end report"};
  if(!curReceipt) return null;
  return kind === "kot" ? {lines:kotLayout(curReceipt), key:"kot:" + curReceipt.id, what:"Kitchen slip #" + curReceipt.token}
                        : {lines:receiptLayout(curReceipt), key:"bill:" + curReceipt.id, what:"Bill #" + curReceipt.token};
}
async function printJob(kind, route){
  if(prnWorking || prnBusy) return;
  const job = prnLines(kind);
  if(!job){ toast("Nothing to print"); return; }
  route = route || "bt";
  if(route === "bt" && !navigator.bluetooth){ prnRefreshStatus(); toast("⚠️ " + prnNoBleReason()); return; }
  if(route === "serial" && !navigator.serial){ toast("⚠️ USB/COM printing needs Chrome or Edge on a PC"); return; }
  if(job.key && prnPrinted.has(job.key) && !confirm(job.what + " is already printed.\nPrint one more copy?")) return;
  const bytes = linesToBytes(job.lines);
  if(route === "rawbt"){ if(job.key) prnPrinted.add(job.key); prnRawBT(bytes); return; }
  const btn = $("btPrintBtn"), label = btn ? btn.innerHTML : "";
  prnWorking = true;
  if(btn && kind === "bill" && route === "bt"){ btn.textContent = "Printing..."; btn.disabled = true; }
  try{
    if(route === "bt"){ if(!(await prnEnsureBT())) return; await prnSendBLE(bytes); }
    else await prnSerial(bytes);
    if(job.key) prnPrinted.add(job.key);
    toast("✅ " + job.what + " printed");
    await prnSleep(1500); // keep buttons locked while the paper finishes coming out
  }catch(e){
    if(e && e.name === "NotFoundError") toast("Nothing selected");
    else { toast("❌ Print failed — try again"); console.log("print error:", e); }
    if(route === "serial"){ try{ if(serialPort) await serialPort.close(); }catch(_){ } serialPort = null; }
  }finally{
    prnWorking = false;
    if(btn && label){ btn.innerHTML = label; btn.disabled = false; }
    prnRefreshStatus();
  }
}
// Called from placeOrder (inside the Confirm tap) when auto-print is switched on.
async function autoPrint(order){
  if(prnWorking || prnBusy) return;
  const jobs = [];
  if(S.autoPrint) jobs.push({lines:receiptLayout(order), key:"bill:" + order.id});
  if(S.autoKOT) jobs.push({lines:kotLayout(order), key:"kot:" + order.id});
  if(!jobs.length) return;
  if(S.printRoute === "rawbt" && PRN_IS_ANDROID){
    const parts = jobs.map(j => linesToBytes(j.lines)), all = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
    let off = 0; parts.forEach(p => { all.set(p, off); off += p.length; });
    jobs.forEach(j => prnPrinted.add(j.key));
    prnRawBT(all); return;
  }
  if(!navigator.bluetooth) return; // status bar already explains why
  prnWorking = true;
  try{
    if(!(await prnEnsureBT())) return;
    for(let i = 0; i < jobs.length; i++){
      if(i) await prnSleep(2500); // time to tear off the bill before the kitchen slip starts
      await prnSendBLE(linesToBytes(jobs[i].lines));
      prnPrinted.add(jobs[i].key);
    }
    toast("✅ Printed");
    await prnSleep(1200);
  }catch(e){ toast("❌ Auto-print failed — tap Print bill"); console.log("auto print error:", e); }
  finally{ prnWorking = false; prnRefreshStatus(); }
}
// Any normal printer, through the phone's / PC's own print window.
function browserPrint(kind){
  const job = prnLines(kind);
  if(!job){ toast("Nothing to print"); return; }
  const w = window.open("", "_blank", "width=420,height=700");
  if(!w){ toast("⚠️ Allow pop-ups to print"); return; }
  w.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + esc(job.what) + "</title><style>" + RC_CSS
    + "@page{size:58mm auto;margin:0}body{margin:0}.rc-paper{font-size:2.7mm;padding:2mm 1.5mm;}"
    + "</style></head><body>" + linesHTML(job.lines)
    + "<scr" + "ipt>window.onload=function(){window.print();setTimeout(function(){window.close();},500);}<" + "/scr" + "ipt></body></html>");
  w.document.close();
}
// Remember the last Bluetooth printer (Chrome versions that support it) so no re-pairing is needed.
async function prnRestore(){
  try{
    const saved = lsGet(LS.PRN, null);
    if(!saved || !navigator.bluetooth || !navigator.bluetooth.getDevices) return;
    const d = (await navigator.bluetooth.getDevices()).find(x => x.id === saved.id);
    if(d && !btDevice){
      btDevice = d;
      d.addEventListener("gattserverdisconnected", onBTDisconnect);
      prnRefreshStatus();
    }
  }catch(e){}
}
