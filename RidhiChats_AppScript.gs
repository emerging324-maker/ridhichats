/**
 * Ridhi Chats POS v3 — Google Sheets backend
 *
 * SETUP (one time, about 3 minutes)
 *  1. Open your Google Sheet  →  Extensions  →  Apps Script
 *  2. Delete the code that is there, paste this whole file, press Save
 *  3. Deploy  →  Manage deployments  →  pencil icon  →  Version: "New version"  →  Deploy
 *     (first time: Deploy → New deployment → Web app → Execute as: Me → Who has access: Anyone)
 *  4. Copy the Web App URL (ends in /exec) into the POS: Settings → Google Sheet → Connect
 *
 * The script keeps its data in two tabs it creates by itself: POS_Orders and POS_Expenses.
 * Your older tabs are not touched.
 */
var SH_ORDERS = 'POS_Orders';
var SH_EXP = 'POS_Expenses';
var ORDER_COLS = ['id', 'dateISO', 'time', 'token', 'status', 'kitchenStatus', 'orderType', 'customerName', 'customerPhone',
                  'itemsText', 'subtotal', 'discount', 'gst', 'total', 'paymentMethod', 'cancelReason', 'json'];
var EXP_COLS = ['id', 'dateISO', 'category', 'desc', 'amount', 'paidVia'];

function sheet_(name, cols) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(cols);
    sh.setFrozenRows(1);
    // keep dates and times as plain text so Sheets never re-formats them
    sh.getRange(1, 1, sh.getMaxRows(), cols.length).setNumberFormat('@');
  }
  return sh;
}

function findRow_(sh, id) {
  var last = sh.getLastRow();
  if (last < 2) return 0;
  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = ids.length - 1; i >= 0; i--) {
    if (String(ids[i][0]) === String(id)) return i + 2;
  }
  return 0;
}

function col_(cols, name) { return cols.indexOf(name) + 1; }

function upsertOrder_(d) {
  var sh = sheet_(SH_ORDERS, ORDER_COLS);
  var items = d.items || [];
  var text = items.map(function (i) { return i.name + ' x' + i.qty + (i.note ? ' (' + i.note + ')' : ''); }).join('; ');
  var copy = {};
  for (var k in d) { if (k !== 'type') copy[k] = d[k]; }
  var row = [String(d.id), d.dateISO || '', d.time || '', String(d.token || ''), d.status || 'paid', d.kitchenStatus || 'preparing',
             d.orderType || 'dinein', d.customerName || '', String(d.customerPhone || ''), text,
             String(d.subtotal || 0), String(d.discount || 0), String(d.gst || 0), String(d.total || 0), d.paymentMethod || 'cash',
             d.cancelReason || '', JSON.stringify(copy)];
  var r = findRow_(sh, d.id);
  if (r) {
    // keep the kitchen status already in the sheet (the kitchen may have changed it)
    row[col_(ORDER_COLS, 'kitchenStatus') - 1] = sh.getRange(r, col_(ORDER_COLS, 'kitchenStatus')).getValue() || row[5];
    sh.getRange(r, 1, 1, row.length).setValues([row]);
  } else {
    sh.appendRow(row);
  }
}

function setOrderCols_(id, values) {
  var sh = sheet_(SH_ORDERS, ORDER_COLS);
  var r = findRow_(sh, id);
  if (!r) return;
  for (var name in values) sh.getRange(r, col_(ORDER_COLS, name)).setValue(values[name]);
}

function upsertExpense_(d) {
  var sh = sheet_(SH_EXP, EXP_COLS);
  var row = [String(d.id), d.dateISO || '', d.category || 'other', d.desc || '', String(d.amount || 0), d.paidVia || 'cash'];
  var r = findRow_(sh, d.id);
  if (r) sh.getRange(r, 1, 1, row.length).setValues([row]);
  else sh.appendRow(row);
}

function deleteExpense_(id) {
  var sh = sheet_(SH_EXP, EXP_COLS);
  var r = findRow_(sh, id);
  if (r) sh.deleteRow(r);
}

function handle_(d) {
  if (!d || !d.type) return;
  if (d.type === 'order') upsertOrder_(d);
  else if (d.type === 'kitchen') setOrderCols_(d.id, {kitchenStatus: d.status || 'preparing'});
  else if (d.type === 'cancel') setOrderCols_(d.id, {status: 'cancelled', cancelReason: d.reason || '', kitchenStatus: 'done'});
  else if (d.type === 'expense') upsertExpense_(d);
  else if (d.type === 'expenseDelete') deleteExpense_(d.id);
  else if (d.type === 'batch') (d.items || []).forEach(handle_);
}

function readOrders_(fromRow) {
  var sh = sheet_(SH_ORDERS, ORDER_COLS);
  var last = sh.getLastRow();
  if (last < 2) return [];
  var start = Math.max(2, fromRow || 2);
  var rows = sh.getRange(start, 1, last - start + 1, ORDER_COLS.length).getValues();
  var cStatus = col_(ORDER_COLS, 'status') - 1, cKit = col_(ORDER_COLS, 'kitchenStatus') - 1,
      cReason = col_(ORDER_COLS, 'cancelReason') - 1, cJson = col_(ORDER_COLS, 'json') - 1;
  var out = [];
  rows.forEach(function (r) {
    var o;
    try { o = JSON.parse(r[cJson]); } catch (err) { return; }
    if (!o || o.id == null) return;
    o.status = r[cStatus] || o.status || 'paid';
    o.kitchenStatus = r[cKit] || 'preparing';
    if (r[cReason]) o.cancelReason = r[cReason];
    out.push(o);
  });
  return out;
}

function getKitchen_(dateISO) {
  var sh = sheet_(SH_ORDERS, ORDER_COLS);
  // only the newest rows matter for the kitchen screen
  var list = readOrders_(sh.getLastRow() - 79);
  return list.filter(function (o) { return !dateISO || o.dateISO === dateISO; }).map(function (o) {
    return {id: o.id, token: o.token, time: o.time, customerName: o.customerName, orderType: o.orderType,
            items: o.items, status: o.status, kitchenStatus: o.kitchenStatus};
  });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    handle_(JSON.parse(e.postData.contents));
    return ContentService.createTextOutput(JSON.stringify({ok: true})).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ok: false, error: String(err)})).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  var data;
  try {
    if (p.action === 'getOrders') data = {orders: readOrders_(2)};
    else if (p.action === 'getKitchen') data = {kitchen: getKitchen_(p.d)};
    else data = {ok: true, app: 'ridhi-pos', version: 3};
  } catch (err) {
    data = {ok: false, error: String(err)};
  }
  var txt = JSON.stringify(data);
  if (p.callback && /^[A-Za-z0-9_$.]+$/.test(p.callback)) {
    return ContentService.createTextOutput(p.callback + '(' + txt + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(txt).setMimeType(ContentService.MimeType.JSON);
}
