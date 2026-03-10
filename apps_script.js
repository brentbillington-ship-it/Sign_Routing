/**
 * ⚠️  EVERY TIME YOU CHANGE THIS FILE:
 *  1. Save (Ctrl+S)
 *  2. Deploy → Manage deployments
 *  3. Click the ✏️ pencil on your existing deployment
 *  4. Version → "New version"
 *  5. Click Deploy
 *  ✅ Same URL — no need to update config.js
 * ─────────────────────────────────────────────
 *
 * Chaka Yard Signs — Google Sheets Backend
 *
 * SETUP:
 * 1. Create a new Google Sheet
 * 2. Rename the first tab to "stops"
 * 3. Create a second tab named "routes"
 * 4. Open Extensions → Apps Script
 * 5. Paste this entire file, replacing the default code
 * 6. Click Deploy → New deployment
 *    - Type: Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 7. Copy the deployment URL
 * 8. Paste it into config.js in your GitHub repo
 *
 * SHEET STRUCTURE (auto-created on first GET):
 *
 * "stops" tab:
 *   id | route | sort_order | name | address | lat | lon | signs | notes | delivered | delivered_date | delivered_by
 *
 * "routes" tab:
 *   letter | color | volunteer | created_date
 */

function doGet(e) {
  try {
    // All requests come in via ?payload= encoded JSON
    if (e.parameter.payload) {
      const data = JSON.parse(decodeURIComponent(e.parameter.payload));
      return handleAction(data);
    }

    // Plain ?action=getAll fallback
    const action = e.parameter.action || 'getAll';
    if (action === 'getAll') {
      return ContentService.createTextOutput(JSON.stringify(getAllData()))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ error: 'Unknown action: ' + action }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    return handleAction(data);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function handleAction(data) {
  try {
    const action = data.action;
    let result;

    switch (action) {
      case 'getAll':        result = getAllData();                                        break;
      case 'addStop':       result = addStop(data.stop);                                 break;
      case 'removeStop':    result = removeStop(data.id);                                break;
      case 'updateStop':    result = updateStop(data.id, data.fields);                   break;
      case 'markDelivered': result = markDelivered(data.id, data.delivered, data.delivered_by); break;
      case 'reassignStop':  result = reassignStop(data.id, data.newRoute);               break;
      case 'reorderStops':  result = reorderStops(data.route, data.order);               break;
      case 'addRoute':      result = addRoute(data.letter, data.color, data.volunteer);  break;
      case 'deleteRoute':   result = deleteRoute(data.letter);                           break;
      case 'updateRoute':   result = updateRoute(data.letter, data.fields);              break;
      case 'bulkImport':    result = bulkImport(data.routes);                            break;
      case 'fixAllOrders':  result = fixAllOrders();                                       break;
      case 'heartbeat':     result = heartbeat(data.name, data.sessionId);               break;
      case 'getPresence':   result = getPresence();                                      break;
      default:              result = { error: 'Unknown action: ' + action };
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ─── Helpers ───

function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (name === 'stops') {
      sheet.appendRow(['id', 'route', 'sort_order', 'name', 'address', 'lat', 'lon', 'signs', 'notes', 'delivered', 'delivered_date', 'delivered_by']);
    } else if (name === 'routes') {
      sheet.appendRow(['letter', 'color', 'volunteer', 'created_date']);
    }
  }
  return sheet;
}

function generateId() {
  return Utilities.getUuid().substring(0, 8);
}

// ─── Read ───

function getAllData() {
  const stopsSheet = getSheet('stops');
  const routesSheet = getSheet('routes');

  const stopsData = sheetToObjects(stopsSheet);
  const routesData = sheetToObjects(routesSheet);

  const routes = routesData.map(r => ({
    letter: r.letter,
    color: r.color || '',
    volunteer: r.volunteer || '[UNASSIGNED]',
    stops: stopsData
      .filter(s => s.route === r.letter)
      .sort((a, b) => (parseInt(a.sort_order) || 0) - (parseInt(b.sort_order) || 0))
      .map(s => ({
        id: s.id,
        name: s.name,
        address: s.address,
        lat: parseFloat(s.lat),
        lon: parseFloat(s.lon),
        signs: parseInt(s.signs) || 1,
        notes: s.notes || '',
        delivered: s.delivered === 'true' || s.delivered === true,
        delivered_date: s.delivered_date || '',
        delivered_by: s.delivered_by || '',
        sort_order: parseInt(s.sort_order) || 0
      }))
  }));

  return { routes: routes, timestamp: new Date().toISOString() };
}

function sheetToObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  }).filter(obj => obj[headers[0]] !== '');
}

// ─── Stop CRUD ───

function addStop(stop) {
  const sheet = getSheet('stops');
  const id = generateId();
  const all = sheetToObjects(sheet);
  const routeStops = all.filter(s => s.route === stop.route);
  const maxOrder = routeStops.reduce((max, s) => Math.max(max, parseInt(s.sort_order) || 0), 0);

  sheet.appendRow([
    id, stop.route || 'A', maxOrder + 1,
    stop.name || '', stop.address || '',
    stop.lat || 0, stop.lon || 0,
    stop.signs || 1, stop.notes || '',
    false, '', ''
  ]);
  SpreadsheetApp.flush();
  return { success: true, id: id };
}

function removeStop(id) {
  const sheet = getSheet('stops');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.deleteRow(i + 1);
      SpreadsheetApp.flush();
      return { success: true };
    }
  }
  return { error: 'Stop not found: ' + id };
}

function updateStop(id, fields) {
  const sheet = getSheet('stops');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      for (const [key, value] of Object.entries(fields)) {
        const col = headers.indexOf(key);
        if (col >= 0) sheet.getRange(i + 1, col + 1).setValue(value);
      }
      SpreadsheetApp.flush();
      return { success: true };
    }
  }
  return { error: 'Stop not found: ' + id };
}

function markDelivered(id, delivered, deliveredBy) {
  const sheet = getSheet('stops');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.getRange(i + 1, headers.indexOf('delivered') + 1).setValue(delivered);
      sheet.getRange(i + 1, headers.indexOf('delivered_date') + 1).setValue(delivered ? new Date().toISOString() : '');
      sheet.getRange(i + 1, headers.indexOf('delivered_by') + 1).setValue(delivered ? (deliveredBy || '') : '');
      SpreadsheetApp.flush();
      return { success: true };
    }
  }
  return { error: 'Stop not found: ' + id };
}

function reassignStop(id, newRoute) {
  const moveResult = updateStop(id, { route: newRoute });
  if (moveResult.error) return moveResult;
  renumberAllRoutes();
  return { success: true };
}

function renumberAllRoutes() {
  const sheet = getSheet('stops');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const routeCol = headers.indexOf('route');
  const sortCol = headers.indexOf('sort_order');

  // Group row indices by route, preserving current sort order
  const routeRows = {};
  for (let i = 1; i < data.length; i++) {
    const route = String(data[i][routeCol]);
    if (!route) continue;
    if (!routeRows[route]) routeRows[route] = [];
    routeRows[route].push({ rowIdx: i + 1, sortOrder: parseInt(data[i][sortCol]) || 0 });
  }

  // Rewrite sort_order as clean 1,2,3... per route
  for (const route of Object.keys(routeRows)) {
    const rows = routeRows[route].sort((a, b) => a.sortOrder - b.sortOrder);
    rows.forEach((r, idx) => {
      sheet.getRange(r.rowIdx, sortCol + 1).setValue(idx + 1);
    });
  }
  SpreadsheetApp.flush();
}

function reorderStops(routeLetter, orderIds) {
  const sheet = getSheet('stops');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const sortCol = headers.indexOf('sort_order');
  orderIds.forEach((id, idx) => {
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === id) {
        sheet.getRange(i + 1, sortCol + 1).setValue(idx + 1);
        break;
      }
    }
  });
  SpreadsheetApp.flush();
  return { success: true };
}

// ─── Route CRUD ───

function addRoute(letter, color, volunteer) {
  const sheet = getSheet('routes');
  const existing = sheetToObjects(sheet);
  if (existing.some(r => r.letter === letter)) return { error: 'Route ' + letter + ' already exists' };
  sheet.appendRow([letter, color || '', volunteer || '[UNASSIGNED]', new Date().toISOString()]);
  SpreadsheetApp.flush();
  return { success: true };
}

function deleteRoute(letter) {
  const stopsSheet = getSheet('stops');
  const stops = sheetToObjects(stopsSheet);
  if (stops.some(s => s.route === letter)) {
    return { error: 'Cannot delete route ' + letter + ' — it still has stops. Reassign them first.' };
  }
  const sheet = getSheet('routes');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === letter) {
      sheet.deleteRow(i + 1);
      SpreadsheetApp.flush();
      return { success: true };
    }
  }
  return { error: 'Route not found: ' + letter };
}

function updateRoute(letter, fields) {
  const sheet = getSheet('routes');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === letter) {
      for (const [key, value] of Object.entries(fields)) {
        const col = headers.indexOf(key);
        if (col >= 0) sheet.getRange(i + 1, col + 1).setValue(value);
      }
      SpreadsheetApp.flush();
      return { success: true };
    }
  }
  return { error: 'Route not found: ' + letter };
}

// ─── Bulk Import ───

function bulkImport(routes) {
  const stopsSheet = getSheet('stops');
  const routesSheet = getSheet('routes');

  if (stopsSheet.getLastRow() > 1) stopsSheet.deleteRows(2, stopsSheet.getLastRow() - 1);
  if (routesSheet.getLastRow() > 1) routesSheet.deleteRows(2, routesSheet.getLastRow() - 1);

  const defaultColors = ['#f85149','#d29922','#3fb950','#58a6ff','#bc8cff','#f778ba','#39d2c0','#f0883e','#7ee787','#79c0ff'];

  routes.forEach((route, ri) => {
    routesSheet.appendRow([
      route.letter,
      route.color || defaultColors[ri % defaultColors.length],
      route.volunteer || '[UNASSIGNED]',
      new Date().toISOString()
    ]);
    route.stops.forEach((stop, si) => {
      stopsSheet.appendRow([
        generateId(), route.letter, si + 1,
        stop.name || '', stop.address || '',
        stop.lat || 0, stop.lon || 0,
        stop.signs || 1, stop.notes || '',
        stop.delivered || false, stop.delivered_date || '', stop.delivered_by || ''
      ]);
    });
  });

  SpreadsheetApp.flush();
  return { success: true, routes: routes.length, stops: routes.reduce((sum, r) => sum + r.stops.length, 0) };
}

// ─── Fix All Orders ───

function fixAllOrders() {
  renumberAllRoutes();
  return { success: true, message: 'All route sort orders fixed' };
}

// ─── Presence ───

function heartbeat(name, sessionId) {
  const sheet = getSheet('presence');

  // Bootstrap headers on first use
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['session_id', 'name', 'last_seen']);
  }

  const allRows = sheet.getDataRange().getValues();
  const hdrs = allRows[0];
  const sidCol = hdrs.indexOf('session_id');
  const nameCol = hdrs.indexOf('name');
  const seenCol = hdrs.indexOf('last_seen');
  const now = new Date().toISOString();

  // Update existing row if session already registered
  for (let i = 1; i < allRows.length; i++) {
    if (String(allRows[i][sidCol]) === String(sessionId)) {
      sheet.getRange(i + 1, nameCol + 1).setValue(name || 'Unknown');
      sheet.getRange(i + 1, seenCol + 1).setValue(now);
      SpreadsheetApp.flush();
      return { success: true };
    }
  }

  // New session row
  sheet.appendRow([sessionId, name || 'Unknown', now]);
  SpreadsheetApp.flush();
  return { success: true };
}

function getPresence() {
  const sheet = getSheet('presence');
  if (sheet.getLastRow() < 2) return { users: [] };

  const allRows = sheet.getDataRange().getValues();
  const hdrs = allRows[0];
  const sidCol = hdrs.indexOf('session_id');
  const nameCol = hdrs.indexOf('name');
  const seenCol = hdrs.indexOf('last_seen');

  // 90-second activity window
  const cutoffMs = Date.now() - 90 * 1000;

  const users = allRows.slice(1)
    .filter(row => row[seenCol] && new Date(row[seenCol]).getTime() >= cutoffMs)
    .map(row => ({
      sessionId: String(row[sidCol]),
      name: row[nameCol] || 'Unknown',
      last_seen: row[seenCol]
    }));

  return { users };
}
