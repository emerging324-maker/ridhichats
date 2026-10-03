"use strict";
// ══════════════════════════════════════════════════════
//  Ridhi Chats POS v3 — core: data, storage, settings, login, navigation
// ══════════════════════════════════════════════════════
const APP_VERSION = "3.3";

// ── MENU (built-in) ──
const BASE_MENU = {
  "Samosa":{icon:"🥟",color:"#f59e0b",items:[{id:"s1",name:"Veg Samosa",price:20},{id:"s2",name:"Paneer Samosa",price:30},{id:"s3",name:"Shahi Samosa",price:40},{id:"s4",name:"Chana Samosa",price:50},{id:"s5",name:"Bread Samosa",price:50}]},
  "Cutlet":{icon:"🍔",color:"#ef4444",items:[{id:"c1",name:"Veg Cutlet",price:20},{id:"c2",name:"Chana Cutlet",price:40}]},
  "Sandwich":{icon:"🥪",color:"#8b5cf6",items:[{id:"sw1",name:"Veg Sandwich",price:60},{id:"sw2",name:"Paneer Sandwich",price:100},{id:"sw3",name:"Tandoori Paneer Sandwich",price:120},{id:"sw4",name:"Veg Grill Sandwich",price:70},{id:"sw5",name:"Veg Cheese Sandwich",price:90},{id:"sw6",name:"Veg Masala Sandwich",price:100},{id:"sw7",name:"Club Sandwich",price:110},{id:"sw8",name:"Potato Cheese Sandwich",price:80},{id:"sw9",name:"Chilli Cheese Toast",price:90},{id:"sw10",name:"Cheese Toast",price:80},{id:"sw11",name:"Veg Murukku Sandwich",price:60},{id:"sw12",name:"Veg Cheese Murukku Sandwich",price:75}]},
  "Pizza":{icon:"🍕",color:"#f97316",items:[{id:"p1",name:"Veg Pizza",price:120},{id:"p2",name:"Tandoori Paneer Pizza",price:150},{id:"p3",name:"Corn Pizza",price:100},{id:"p4",name:"Pocket Pizza",price:180}]},
  "Chaats":{icon:"🥗",color:"#10b981",items:[{id:"ch1",name:"Pani Puri",price:40},{id:"ch2",name:"Masala Puri",price:40},{id:"ch3",name:"Bhel Puri",price:40},{id:"ch4",name:"Papdi Chaat",price:50},{id:"ch5",name:"Dahi Papdi Chaat",price:60},{id:"ch6",name:"Nippat Bhel",price:50},{id:"ch7",name:"Nippat Masala",price:50},{id:"ch8",name:"Ragda Puri",price:40},{id:"ch9",name:"Sukha Puri",price:40},{id:"ch10",name:"Corn Peanut Chaat",price:80},{id:"ch11",name:"Corn Canopy",price:70},{id:"ch12",name:"Dahi Puri",price:60}]},
  "Fries":{icon:"🍟",color:"#fbbf24",items:[{id:"f1",name:"French Fries",price:70},{id:"f2",name:"Peri Peri French Fries",price:80}]},
  "Wraps":{icon:"🌯",color:"#06b6d4",items:[{id:"w1",name:"Veg Wrap",price:80},{id:"w2",name:"Paneer Wrap",price:100},{id:"w3",name:"French Fries Wrap",price:110},{id:"w4",name:"Creamy Fries Wrap",price:120},{id:"w5",name:"Patty Wrap",price:120}]},
  "Drinks":{icon:"🥤",color:"#3b82f6",items:[{id:"d1",name:"Blue Curaco",price:50},{id:"d2",name:"Jeera Masala",price:50},{id:"d3",name:"Lemonade",price:50},{id:"d4",name:"Lime and Mint",price:50},{id:"d5",name:"Ginger and Lime",price:50},{id:"d6",name:"Rose Falooda",price:50},{id:"d7",name:"Goli Soda",price:20},{id:"d8",name:"Cold Coffee",price:100}]},
  "Parcel":{icon:"📦",color:"#e879f9",items:[{id:"pc1",name:"Parcel",price:5},{id:"pc2",name:"Parcel",price:10},{id:"pc3",name:"Parcel",price:15},{id:"pc4",name:"Parcel",price:20}]},
  "Combos":{icon:"🎁",color:"#f43f5e",items:[
    {id:"cb1",name:"Samosa + Drink",price:60,combo:true},{id:"cb2",name:"Sandwich + Drink",price:120,combo:true},
    {id:"cb3",name:"Pizza + Drink",price:160,combo:true},{id:"cb4",name:"Wrap + Fries",price:160,combo:true},
    {id:"cb5",name:"Chaat + Drink",price:80,combo:true},{id:"cb6",name:"Snack Combo",price:100,combo:true}]}
};
// Bundled photos (img/<name>.jpg). Stock photos per dish type — replace in Edit mode.
const ITEM_IMG = {s1:"samosa",s2:"samosa",s3:"samosa",s4:"samosa",s5:"samosa",c1:"cutlet",c2:"tikki",
  sw1:"sandwich",sw2:"sandwich",sw3:"grill",sw4:"grill",sw5:"grill2",sw6:"sandwich",sw7:"club",sw8:"grill2",sw9:"toast",sw10:"toast2",sw11:"streetsandwich",sw12:"streetsandwich",
  p1:"pizza",p2:"pizza2",p3:"cornpizza",p4:"pizza",
  ch1:"panipuri",ch2:"masalapuri",ch3:"bhel",ch4:"papdi",ch5:"dahipapdi",ch6:"nippat",ch7:"nippat",ch8:"ragda",ch9:"sevpuri",ch10:"cornchaat",ch11:"corncanopy",ch12:"dahipuri",
  f1:"fries",f2:"perifries",w1:"wrap",w2:"roll",w3:"wrap",w4:"roll2",w5:"roll2",
  d1:"bluedrink",d2:"jeera",d3:"lemonade",d4:"mint",d5:"gingerlime",d6:"falooda",d7:"golisoda",d8:"coldcoffee"};
const CAT_IMG = {Samosa:"samosa",Cutlet:"cutlet",Sandwich:"sandwich",Pizza:"pizza",Chaats:"bhel",Fries:"fries",Wraps:"wrap",Drinks:"lemonade"};
const FAV = "⭐ Favourites";
const ORDER_TYPES = [{id:"dinein",label:"Dine-in",icon:"🍽️"},{id:"parcel",label:"Parcel",icon:"🛍️"},{id:"swiggy",label:"Swiggy",icon:"🟠"},{id:"zomato",label:"Zomato",icon:"🔴"}];
const typeLabel = id => (ORDER_TYPES.find(t => t.id === id) || ORDER_TYPES[0]).label;

// ── STORAGE KEYS (unchanged from v2 so existing shop data carries over) ──
const LS = {O:"rc_orders",U:"rc_url",T:"rc_tok",TD:"rc_tok_date",COMBOS:"rc_combos",EXP:"rc_expenses",CMENU:"rc_custom_menu",CITEMS:"rc_custom_items",
  SET:"rc_settings",OVER:"rc_item_over",HELD:"rc_held",OOS:"rc_oos",QUEUE:"rc_queue",KIT:"rc_kitchen",PRN:"rc_printer",RESET:"rc_reset",OUTBOX:"rc_outbox",TOKH:"rc_tokhint"};

// ── HELPERS ──
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
const num = n => { const v = parseFloat(n); return isFinite(v) ? v : 0; };
const r2 = n => Math.round(num(n) * 100) / 100;
const fmt = n => "₹" + r2(n).toLocaleString("en-IN",{minimumFractionDigits:r2(n) % 1 ? 2 : 0, maximumFractionDigits:2});
const pad2 = n => String(n).padStart(2,"0");
const isoOf = d => d.getFullYear() + "-" + pad2(d.getMonth()+1) + "-" + pad2(d.getDate());
const isoToday = () => isoOf(new Date());
const isoShift = (iso, days) => { const p = iso.split("-"); const d = new Date(+p[0], +p[1]-1, +p[2]); d.setDate(d.getDate() + days); return isoOf(d); };
const isoNice = iso => { const p = String(iso||"").split("-"); return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : String(iso||""); };
const today = () => new Date().toLocaleDateString("en-IN");
const nowT = () => new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"});
// "18/7/2026" (or anything Date can parse) → "2026-07-18"
function toISO(str){
  if(!str) return "";
  const s = String(str);
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if(m) return m[3] + "-" + pad2(m[2]) + "-" + pad2(m[1]);
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(m) return m[1] + "-" + m[2] + "-" + m[3];
  const d = new Date(s);
  return isNaN(d) ? "" : isoOf(d);
}
const orderISO = o => o.dateISO || (o.dateISO = toISO(o.date));
const orderTs = o => num(o.ts) || (num(o.id) > 1e12 ? num(o.id) : 0);
const isLive = o => o.status !== "cancelled";

function lsGet(key, def){ try{ const v = localStorage.getItem(key); return v == null ? def : JSON.parse(v); }catch(e){ return def; } }
function lsSet(key, val){
  try{ localStorage.setItem(key, JSON.stringify(val)); return true; }
  catch(e){ toast("⚠️ Phone storage is full — take a backup in Settings"); return false; }
}

let toastTmr;
function toast(msg, ms){
  const t = $("toast"); if(!t) return;
  t.textContent = msg; t.style.opacity = "1";
  clearTimeout(toastTmr); toastTmr = setTimeout(() => t.style.opacity = "0", ms || 3200);
}
function closeM(id){ $(id).classList.remove("show"); }
function openM(id){ $(id).classList.add("show"); }
function busy(on, txt){ $("ldgTxt").textContent = txt || "Loading..."; $("ldg").classList.toggle("show", !!on); }

// ── SHA-256 (so passwords are never stored as plain text) ──
function sha256(str){
  const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const bytes = Array.from(new TextEncoder().encode(str));
  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while(bytes.length % 64 !== 56) bytes.push(0);
  const hi = Math.floor(bitLen / 0x100000000), lo = bitLen >>> 0;
  bytes.push(hi>>>24&255, hi>>>16&255, hi>>>8&255, hi&255, lo>>>24&255, lo>>>16&255, lo>>>8&255, lo&255);
  let h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const rr = (x, n) => (x >>> n) | (x << (32 - n));
  const w = new Array(64);
  for(let i = 0; i < bytes.length; i += 64){
    for(let t = 0; t < 16; t++) w[t] = (bytes[i+t*4]<<24 | bytes[i+t*4+1]<<16 | bytes[i+t*4+2]<<8 | bytes[i+t*4+3]) >>> 0;
    for(let t = 16; t < 64; t++){
      const s0 = rr(w[t-15],7) ^ rr(w[t-15],18) ^ (w[t-15]>>>3), s1 = rr(w[t-2],17) ^ rr(w[t-2],19) ^ (w[t-2]>>>10);
      w[t] = (w[t-16] + s0 + w[t-7] + s1) >>> 0;
    }
    let [a,b,c,d,e,f,g,hh] = h;
    for(let t = 0; t < 64; t++){
      const S1 = rr(e,6) ^ rr(e,11) ^ rr(e,25), ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[t] + w[t]) >>> 0;
      const S0 = rr(a,2) ^ rr(a,13) ^ rr(a,22), mj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + mj) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h = [(h[0]+a)>>>0,(h[1]+b)>>>0,(h[2]+c)>>>0,(h[3]+d)>>>0,(h[4]+e)>>>0,(h[5]+f)>>>0,(h[6]+g)>>>0,(h[7]+hh)>>>0];
  }
  return h.map(x => x.toString(16).padStart(8,"0")).join("");
}
const passHash = p => sha256("rc:" + p);
// Built-in Google Sheet (Apps Script Web App). A link typed in Settings always takes priority.
const DEFAULT_SHEET_URL = "https://script.google.com/macros/s/AKfycbzWIAbpc6NyhSY8OAp4RGONNlEA9e3Gag4AW6iOIo8CHQPXtvCqUYHentERoJQDOfPqAw/exec";
const OWNER_DEFAULT_HASH ="ef6a77fcf392c92a0c8b6af9551353ad68a2d275f01b8e8b85a0ed0af347b67b"; // the shop's existing password

// ── DATABASE (IndexedDB: bills + item photos; falls back to localStorage) ──
const DB = {
  db:null, ok:false,
  open(){
    return new Promise(res => {
      let rq;
      try{ if(!window.indexedDB) return res(false); rq = indexedDB.open("ridhi_pos", 1); }catch(e){ return res(false); }
      rq.onupgradeneeded = () => {
        const d = rq.result;
        if(!d.objectStoreNames.contains("orders")) d.createObjectStore("orders",{keyPath:"id"});
        if(!d.objectStoreNames.contains("images")) d.createObjectStore("images");
      };
      rq.onsuccess = () => { DB.db = rq.result; DB.ok = true; res(true); };
      rq.onerror = () => res(false);
      rq.onblocked = () => res(false);
    });
  },
  tx(store, mode, fn){
    return new Promise((res, rej) => {
      if(!DB.ok) return rej(new Error("no db"));
      let out;
      const t = DB.db.transaction(store, mode);
      t.oncomplete = () => res(out);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error || new Error("aborted"));
      const r = fn(t.objectStore(store));
      if(r) r.onsuccess = () => { out = r.result; };
    });
  },
  all(store){ return DB.tx(store, "readonly", s => s.getAll()); },
  put(store, val, key){ return DB.tx(store, "readwrite", s => { key === undefined ? s.put(val) : s.put(val, key); }); },
  del(store, key){ return DB.tx(store, "readwrite", s => { s.delete(key); }); },
  bulk(store, vals){ return DB.tx(store, "readwrite", s => { vals.forEach(v => s.put(v)); }); },
  clear(store){ return DB.tx(store, "readwrite", s => { s.clear(); }); },
  entries(store){
    return new Promise((res, rej) => {
      if(!DB.ok) return res([]);
      const out = [], rq = DB.db.transaction(store, "readonly").objectStore(store).openCursor();
      rq.onsuccess = () => { const c = rq.result; if(c){ out.push([c.key, c.value]); c.continue(); } else res(out); };
      rq.onerror = () => rej(rq.error);
    });
  }
};

// ── SETTINGS ──
const S_DEF = {shopName:"Ridhi Chats", tagline:"Pure Jain Veg", address:"Katpadi, Vellore", phone:"", gstin:"", footer:"Thank you! Please visit again",
  upiId:"", upiName:"Ridhi Chats", autoPrint:false, autoKOT:false, printRoute:"bt", loyaltyN:0, loyaltyReward:"", ownerHash:"", staffHash:"", openingCash:0};
let S = Object.assign({}, S_DEF);
function loadSettings(){ S = Object.assign({}, S_DEF, lsGet(LS.SET, {})); }
function saveSettings(){ lsSet(LS.SET, S); }

// ── STATE ──
let orders = [], expenses = [];
let MENU = {}, ALL = [];
let customCategories = [], customItems = {}, customCombos = [], itemOver = {};
let IMGS = {};                 // itemId → data URL (owner's own photos)
let oos = new Set();           // sold-out item ids (today only)
let cart = [], held = [];
let cust = {name:"", phone:""}, orderType = "dinein";
let gstOn = false, disc = 0, discType = "flat", pm = "cash";
let activeCat = "Samosa", menuMode = "", role = null;
let curReceipt = null, sheetUrl = "", sheetOn = false;
let customers = new Map(), favIds = [];

// ── OLD LOCAL DATA IS REMOVED ──
// Bills and expenses live in the Google Sheet. The only bill data on the device is the short
// "to sync" list (rc_outbox) of changes not yet confirmed by the Sheet. Every time the app opens it
// removes what older versions stored here (bills, expenses, kitchen list, old upload queue, token
// counter). Menu, prices, photos, settings, logins, the Sheet link and the printer stay.
const DATA_RESET_ID = "2026-10-03";
async function purgeLocalData(){
  try{ if(DB.ok) await DB.clear("orders"); }catch(e){}
  [LS.O, LS.EXP, LS.KIT, LS.QUEUE, LS.T, LS.TD].forEach(k => localStorage.removeItem(k));
  if(localStorage.getItem(LS.RESET) !== DATA_RESET_ID){   // one time: also drop an old Sheet link and old held bills
    [LS.HELD, LS.U].forEach(k => localStorage.removeItem(k));
    localStorage.setItem(LS.RESET, DATA_RESET_ID);
  }
}

// ── ORDERS (in memory only — loaded from the Sheet) ──
function normOrder(o){
  o.id = isFinite(+o.id) && String(o.id).trim() !== "" ? +o.id : String(o.id);
  if(typeof o.items === "string"){ try{ o.items = JSON.parse(o.items); }catch(e){ o.items = []; } }
  if(!Array.isArray(o.items)) o.items = [];
  o.total = num(o.total); o.subtotal = num(o.subtotal); o.discount = num(o.discount); o.gst = num(o.gst);
  o.paymentMethod = String(o.paymentMethod || "cash").toLowerCase();
  o.token = String(o.token == null ? "" : o.token).padStart(3,"0");
  orderISO(o);
  return o;
}
function sortOrders(){ orders.sort((a,b) => (orderTs(b) - orderTs(a)) || (String(b.id) > String(a.id) ? 1 : -1)); }

// ── MENU BUILD ──
function loadMenuStores(){
  customCategories = lsGet(LS.CMENU, []); if(!Array.isArray(customCategories)) customCategories = [];
  customItems = lsGet(LS.CITEMS, {}); if(!customItems || typeof customItems !== "object") customItems = {};
  customCombos = lsGet(LS.COMBOS, []); if(!Array.isArray(customCombos)) customCombos = [];
  itemOver = lsGet(LS.OVER, {}); if(!itemOver || typeof itemOver !== "object") itemOver = {};
  const o = lsGet(LS.OOS, null);
  oos = new Set(o && o.date === isoToday() && Array.isArray(o.ids) ? o.ids : []);
}
function saveMenuStores(){
  lsSet(LS.CMENU, customCategories); lsSet(LS.CITEMS, customItems); lsSet(LS.COMBOS, customCombos); lsSet(LS.OVER, itemOver);
}
function saveOOS(){ lsSet(LS.OOS, {date:isoToday(), ids:[...oos]}); }
function buildMenu(){
  const M = {};
  Object.entries(BASE_MENU).forEach(([cat, v]) => { M[cat] = {icon:v.icon, color:v.color, builtin:true, items:v.items.map(i => Object.assign({builtin:true}, i))}; });
  customCategories.forEach(c => {
    if(!c || !c.name) return;
    if(!M[c.name]) M[c.name] = {icon:c.icon || "🍱", color:c.color || "#f59e0b", items:[]};
    (c.items || []).forEach(i => { if(!M[c.name].items.some(x => x.id === i.id)) M[c.name].items.push(Object.assign({}, i)); });
  });
  Object.entries(customItems).forEach(([cat, items]) => {
    if(!M[cat] || !Array.isArray(items)) return;
    items.forEach(i => { if(!M[cat].items.some(x => x.id === i.id)) M[cat].items.push(Object.assign({}, i)); });
  });
  customCombos.forEach(c => { if(!M.Combos.items.some(x => x.id === c.id)) M.Combos.items.push({id:c.id, name:c.name, price:num(c.price), icon:c.emoji || "🎁", combo:true, includes:c.includes || ""}); });
  ALL = [];
  Object.entries(M).forEach(([cat, v]) => {
    v.items = v.items.map(i => Object.assign({}, i, itemOver[i.id] || {})).filter(i => !i.hidden);
    v.items.forEach(i => {
      i.category = cat; i.color = v.color; i.price = num(i.price);
      if(!i.icon) i.icon = v.icon;
      if(cat === "Combos") i.combo = true;
      ALL.push(i);
    });
  });
  MENU = M;
}
const itemById = id => ALL.find(i => i.id === id);
function imgFor(item){
  if(!item) return "";
  if(IMGS[item.id]) return IMGS[item.id];
  const n = ITEM_IMG[item.id] || (item.category && CAT_IMG[item.category]);
  return n ? "img/" + n + ".jpg" : "";
}
function thumbHTML(item){
  const src = imgFor(item);
  return src ? '<img src="' + esc(src) + '" alt="" loading="lazy" onerror="this.outerHTML=\'<span class=emo>' + esc(item.icon || "🍽️") + '</span>\'"/>'
             : '<span class="emo" style="background:linear-gradient(135deg,' + esc(item.color || "#f59e0b") + '33,transparent)">' + esc(item.icon || "🍽️") + '</span>';
}

// ── BILL NUMBER ──
// Next number = highest number among today's bills in the Sheet + 1 (starts at 001 each day).
// A deleted bill is gone from the Sheet, so if the last bill (006) is deleted the next one is 006 again.
// The Sheet has the final say when the bill is saved, so two phones never share a number.
function maxTokenToday(){
  const t = isoToday();
  return orders.reduce((m, o) => orderISO(o) === t ? Math.max(m, parseInt(o.token, 10) || 0) : m, 0);
}
// The last number is also remembered on the device, so numbering continues correctly when the
// app is opened with no internet (before today's bills could be loaded from the Sheet).
function tokenHint(){ const h = lsGet(LS.TOKH, null); return h && h.date === isoToday() ? (parseInt(h.n, 10) || 0) : 0; }
function syncTokenHint(){ lsSet(LS.TOKH, {date:isoToday(), n:maxTokenToday()}); }
function nextToken(){ return String(Math.max(maxTokenToday(), tokenHint()) + 1).padStart(3, "0"); }

// ── CUSTOMERS + FAVOURITES (worked out from bill history) ──
function rebuildIndex(){
  customers = new Map();
  const since = isoShift(isoToday(), -30), freq = {};
  for(let i = orders.length - 1; i >= 0; i--){   // oldest → newest
    const o = orders[i]; if(!isLive(o)) continue;
    const ph = String(o.customerPhone || "").replace(/\D/g,"");
    if(ph.length === 10){
      const c = customers.get(ph) || {phone:ph, name:"", visits:0, total:0, last:"", lastItems:""};
      c.visits++; c.total += o.total; c.last = orderISO(o);
      if(o.customerName) c.name = o.customerName;
      c.lastItems = o.items.map(x => x.name + " ×" + x.qty).join(", ");
      customers.set(ph, c);
    }
    if(orderISO(o) >= since) o.items.forEach(x => { const id = x.baseId || x.id; freq[id] = (freq[id] || 0) + num(x.qty); });
  }
  favIds = Object.entries(freq).filter(([id]) => itemById(id) && itemById(id).category !== "Parcel").sort((a,b) => b[1] - a[1]).slice(0, 8).map(x => x[0]);
}

// ── SOUND ──
let audioCtx = null;
function playSound(type){
  try{
    const AC = window.AudioContext || window.webkitAudioContext; if(!AC) return;
    if(!audioCtx) audioCtx = new AC();
    if(audioCtx.state === "suspended") audioCtx.resume();
    const ctx = audioCtx, now = ctx.currentTime;
    const tone = (f0, f1, at, dur, vol, wave) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination); o.type = wave || "sine";
      o.frequency.setValueAtTime(f0, now + at);
      if(f1) o.frequency.exponentialRampToValueAtTime(f1, now + at + dur * .6);
      g.gain.setValueAtTime(vol, now + at); g.gain.exponentialRampToValueAtTime(.001, now + at + dur);
      o.start(now + at); o.stop(now + at + dur);
    };
    if(type === "add") tone(600, 900, 0, .15, .15);
    else if(type === "remove") tone(300, 150, 0, .15, .12);
    else if(type === "payment"){ tone(880, 0, 0, .4, .3, "triangle"); tone(1320, 0, .18, .4, .3, "triangle"); }
    else if(type === "ready" || type === "neworder"){ [523,659,784].forEach((f,i) => tone(f, 0, i*.15, .35, .25)); }
    else if(type === "error"){ tone(180, 0, 0, .1, .1, "sawtooth"); tone(180, 0, .12, .1, .1, "sawtooth"); }
    else if(type === "voice") tone(440, 660, 0, .3, .2);
    else if(type === "open"){ [523.25,659.25,783.99,1046.5].forEach((f,i) => tone(f, 0, i*.15, .5, .3, "triangle")); }
  }catch(e){}
}

// ── LOGIN / ROLES ──
function togglePass(){ const i = $("loginPass"); i.type = i.type === "password" ? "text" : "password"; i.focus(); }
function doLogin(){
  const inp = $("loginPass"), p = (inp.value || "").trim();
  const h = passHash(p);
  let r = null;
  if(p && h === (S.ownerHash || OWNER_DEFAULT_HASH)) r = "owner";
  else if(p && S.staffHash && h === S.staffHash) r = "staff";
  if(!r){
    $("loginErr").classList.add("show"); inp.value = ""; inp.focus(); playSound("error");
    const c = $("loginCard"); c.style.animation = "shake .4s ease"; setTimeout(() => c.style.animation = "", 400);
    return;
  }
  $("loginErr").classList.remove("show"); inp.value = "";
  role = r; applyRole(); playSound("open");
  $("splash").classList.add("hide");
  setTimeout(() => { if(role) $("splash").style.display = "none"; }, 420);
  sv("pos");
}
function lockApp(){
  role = null;
  document.querySelectorAll(".ov.show").forEach(m => m.classList.remove("show"));
  toggleOrder(false);
  const s = $("splash"); s.style.display = "flex"; s.classList.remove("hide");
  setTimeout(() => $("loginPass").focus(), 100);
}
const isOwner = () => role === "owner";
function needOwner(){ if(isOwner()) return true; toast("🔒 Owner login needed for this"); return false; }
function applyRole(){
  document.body.dataset.role = role || "";
  const rp = $("rolePill");
  rp.innerHTML = isOwner() ? '👑<span class="pl"> Owner</span>' : '👤<span class="pl"> Staff</span>'; rp.className = "pill " + (isOwner() ? "warn" : "");
  if(menuMode === "edit" && !isOwner()) menuMode = "";
  renderNav();
}

// ── NAVIGATION ──
const VIEWS = [
  {id:"pos", label:"Billing", icon:"🧾"}, {id:"kitchen", label:"Kitchen", icon:"👨‍🍳"}, {id:"history", label:"History", icon:"📋"},
  {id:"dashboard", label:"Reports", icon:"📊", owner:true}, {id:"expenses", label:"Expenses", icon:"💸", owner:true},
  {id:"customers", label:"Customers", icon:"👥", owner:true}, {id:"settings", label:"Settings", icon:"⚙️", owner:true}, {id:"sync", label:"Sync", icon:"🔄"}];
let curView = "pos";
function renderNav(){
  const vis = VIEWS.filter(v => !v.owner || isOwner());
  $("navTop").innerHTML = vis.map(v => '<button class="nv' + (v.id === curView ? " active" : "") + '" onclick="sv(\'' + v.id + '\')">' + v.icon + " " + v.label + "</button>").join("");
  const main = vis.slice(0, isOwner() ? 4 : 3);
  const inMore = vis.slice(main.length);
  $("navBot").innerHTML = main.map(v => '<button class="nv' + (v.id === curView ? " active" : "") + '" onclick="sv(\'' + v.id + '\')"><i>' + v.icon + "</i>" + v.label + "</button>").join("")
    + '<button class="nv' + (inMore.some(v => v.id === curView) ? " active" : "") + '" onclick="openMore()"><i>☰</i>More</button>';
}
function openMore(){
  const vis = VIEWS.filter(v => !v.owner || isOwner()).slice(isOwner() ? 4 : 3);
  $("moreGrid").innerHTML = vis.map(v => '<button onclick="closeM(\'moreMod\');sv(\'' + v.id + '\')"><div>' + v.icon + "</div>" + v.label + "</button>").join("")
    + '<button onclick="closeM(\'moreMod\');lockApp()"><div>🔒</div>Lock</button>';
  openM("moreMod");
}
function sv(v){
  const def = VIEWS.find(x => x.id === v);
  if(!def || (def.owner && !isOwner())) v = "pos";
  curView = v;
  document.querySelectorAll(".view").forEach(el => el.classList.remove("active"));
  $("view-" + v).classList.add("active");
  toggleOrder(false);
  renderNav();
  if(v === "pos"){ renderCats(); renderMenu(); }
  if(v === "dashboard") renderDash();
  if(v === "history") renderHist();
  if(v === "kitchen") kitchenOpen();
  if(v === "expenses") renderExp();
  if(v === "customers") renderCustomers();
  if(v === "settings") renderSettings();
  if(v === "sync") renderSync();
  if(v !== "kitchen") kitchenClose();
}
function updateClock(){ const el = $("clock"); if(el) el.textContent = "● " + today() + " " + nowT(); }
function applyShopName(){
  ["brandName","splashName"].forEach(id => { const el = $(id); if(el) el.textContent = S.shopName || "Ridhi Chats"; });
  const t = $("splashTag"); if(t) t.textContent = [S.tagline, S.address].filter(Boolean).join(" • ");
  document.title = (S.shopName || "Ridhi Chats") + " POS";
}

// ── BOOT ──
async function boot(){
  try{ FX.init(); }catch(e){}
  loadSettings(); applyShopName();
  $("verTxt").textContent = (S.shopName || "Ridhi Chats") + " POS v" + APP_VERSION;
  await DB.open();
  await purgeLocalData();
  loadMenuStores();
  try{ (await DB.entries("images")).forEach(([k, v]) => { IMGS[k] = v; }); }catch(e){}
  buildMenu();
  held = lsGet(LS.HELD, []); if(!Array.isArray(held)) held = [];
  // Use the built-in Sheet link unless one was entered (or Disconnect was tapped) in Settings
  const savedUrl = localStorage.getItem(LS.U);
  sheetUrl = savedUrl === null ? DEFAULT_SHEET_URL : savedUrl; sheetOn = !!sheetUrl;
  outbox.forEach(it => applyOp(it.body)); sortData(); // bills not yet synced are shown straight away
  rebuildIndex();
  activeCat = Object.keys(MENU)[0];
  applyRole();
  renderTypeSeg(); renderCats(); renderMenu(); renderCart();
  updateClock(); setInterval(updateClock, 30000);
  const t = isoToday();
  ["dFrom","dTo"].forEach(id => { $(id).value = t; }); // History and Expenses open on "All" (newest first)
  updateSyncUI();
  pullSheet().then(() => { if(favIds.length && !cart.length){ activeCat = FAV; if(curView === "pos"){ renderCats(); renderMenu(); } } });
  setInterval(pullSheet, 60000);    // keep in step with the Sheet
  setInterval(flushOutbox, 15000);  // keep pushing anything still waiting
  window.addEventListener("online", () => { sheetState = "idle"; flushOutbox(); pullSheet(); });
  window.addEventListener("offline", updateSyncUI);
  prnRestore();
  pwaInit();
  setTimeout(() => $("loginPass").focus(), 300);
}
