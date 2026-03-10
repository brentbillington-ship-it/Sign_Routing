// ─── App Module ───

const App = {
  state: { routes: [] },

  // Unique ID for this browser tab session
  _sessionId: Math.random().toString(36).slice(2, 10) + Date.now().toString(36),

  // Retry queue for failed markDelivered calls
  _retryQueue: [],
  _retrying: false,
  _isOffline: false,
  _presenceInterval: null,
  _presencePollInterval: null,

  async init() {
    UI.init();
    MapModule.init();
    await this.loadData();
    this._startPresence();
    // Flush any queued retries on focus (e.g. coming back online)
    window.addEventListener('focus', () => this._flushRetryQueue());
    window.addEventListener('online', () => {
      UI.setOffline(false);
      this._isOffline = false;
      this._flushRetryQueue();
    });
    window.addEventListener('offline', () => {
      UI.setOffline(true);
      this._isOffline = true;
    });
  },

  async loadData() {
    UI.showToast('Loading routes…', 'info');
    try {
      const data = await SheetsAPI.getAll();
      if (data.error) throw new Error(data.error);
      this.state.routes = data.routes;
      this.render();
      UI.showToast('Routes loaded ✓', 'success');
      UI.setOffline(false);
    } catch (e) {
      console.error('Load failed:', e);
      UI.showToast('Failed to load data — check config.js', 'error');
      UI.setOffline(true);
    }
  },

  render() {
    const routes = this.getFilteredRoutes();
    UI.updateStats(this.state.routes);
    UI.renderSidebar(routes);
    MapModule.renderRoutes(routes, { showDelivered: UI.showDelivered });
  },

  getFilteredRoutes() {
    if (UI.myRouteFilter) {
      return this.state.routes.filter(r => r.letter === UI.myRouteFilter);
    }
    return this.state.routes;
  },

  // ─── Presence ───

  _startPresence() {
    // Send heartbeat immediately, then every 30s
    this._sendHeartbeat();
    this._presenceInterval = setInterval(() => this._sendHeartbeat(), 30000);

    // Poll for other users every 15s
    this._pollPresence();
    this._presencePollInterval = setInterval(() => this._pollPresence(), 15000);

    // Silent background data refresh every 15s — keeps map current
    this._dataRefreshInterval = setInterval(() => this._silentRefresh(), 15000);

    // Clean up on tab close
    window.addEventListener('beforeunload', () => {
      clearInterval(this._presenceInterval);
      clearInterval(this._presencePollInterval);
      clearInterval(this._dataRefreshInterval);
    });
  },

  async _silentRefresh() {
    // Skip if a modal is open — don't yank the UI mid-action
    const modal = document.getElementById('modal-overlay');
    if (modal && modal.style.display === 'flex') return;

    try {
      const data = await SheetsAPI.getAll();
      if (data.error) return;

      // Only re-render if delivery state actually changed
      const oldHash = this._deliveryHash(this.state.routes);
      this.state.routes = data.routes;
      const newHash = this._deliveryHash(this.state.routes);

      if (oldHash === newHash) {
        // Nothing delivered/undelivered — skip map redraw, just update stats quietly
        UI.updateStats(this.state.routes);
        return;
      }

      this.render();
    } catch (e) {
      // Silently ignore — offline banner handles persistent failures
    }
  },

  _deliveryHash(routes) {
    // Lightweight fingerprint of all delivery states
    return routes.map(r =>
      r.stops.map(s => s.id + ':' + (s.delivered ? '1' : '0')).join(',')
    ).join('|');
  },

  async _sendHeartbeat() {
    const name = UI.volunteerName || 'Unknown';
    try {
      await SheetsAPI.heartbeat(name, this._sessionId);
    } catch (e) {
      // Silently ignore heartbeat failures — not critical
    }
  },

  async _pollPresence() {
    try {
      const result = await SheetsAPI.getPresence();
      if (result && result.users) {
        UI.renderPresence(result.users);
      }
    } catch (e) {
      // Silently ignore presence poll failures
    }
  },

    // ─── Retry Queue ───

  _enqueueRetry(fn, label) {
    this._retryQueue.push({ fn, label, attempts: 0 });
    UI.setSyncStatus('error');
    UI.setOffline(true);
  },

  async _flushRetryQueue() {
    if (this._retrying || this._retryQueue.length === 0) return;
    this._retrying = true;
    UI.setSyncStatus('syncing');

    const remaining = [];
    for (const item of this._retryQueue) {
      try {
        await item.fn();
        UI.showToast(`Synced: ${item.label}`, 'success');
      } catch (e) {
        item.attempts++;
        if (item.attempts < 5) remaining.push(item);
      }
    }

    this._retryQueue = remaining;
    this._retrying = false;

    if (remaining.length === 0) {
      UI.setSyncStatus('ok');
      UI.setOffline(false);
    } else {
      UI.setSyncStatus('error');
    }
  },

  // ─── Actions ───

  async toggleDelivered(stopId) {
    let stop = null, route = null;
    for (const r of this.state.routes) {
      const s = r.stops.find(x => x.id === stopId);
      if (s) { stop = s; route = r; break; }
    }
    if (!stop) return;

    const newVal = !stop.delivered;
    const deliveredBy = UI.volunteerName || '';

    // Optimistic update
    stop.delivered = newVal;
    stop.delivered_date = newVal ? new Date().toISOString() : '';
    stop.delivered_by = newVal ? deliveredBy : '';

    const stopIndex = route.stops.indexOf(stop);
    MapModule.updateStopMarker(stop, route, stopIndex);
    MapModule.addLegend(this.state.routes);
    UI.renderSidebar(this.getFilteredRoutes());
    UI.updateStats(this.state.routes);

    // Multi-sign confirmation
    if (newVal && stop.signs > 1) {
      const confirmed = confirm(`Deliver ${stop.signs} signs to ${stop.name}?`);
      if (!confirmed) {
        stop.delivered = false;
        stop.delivered_date = '';
        stop.delivered_by = '';
        this.render();
        return;
      }
    }

    // Toast with name attribution
    if (newVal) {
      const byStr = deliveredBy ? ` by ${deliveredBy}` : '';
      UI.showToast(`✓ Delivered${byStr}`, 'success');
    } else {
      UI.showToast('Marked undelivered', 'info');
    }

    UI.setSyncStatus('syncing');

    // Save to sheet with retry on failure
    try {
      await SheetsAPI.markDelivered(stopId, newVal, deliveredBy);
      UI.setSyncStatus('ok');
    } catch (e) {
      console.error('Save failed, queuing retry:', e);
      const label = `${stop.name} (${newVal ? 'delivered' : 'undelivered'})`;
      this._enqueueRetry(
        () => SheetsAPI.markDelivered(stopId, newVal, deliveredBy),
        label
      );
      UI.showToast('⚠ Save failed — will retry when online', 'error');
    }
  },

  async addStop(stopData) {
    UI.showToast('Adding stop…', 'info');
    try {
      const result = await SheetsAPI.addStop(stopData);
      if (result.error) throw new Error(result.error);
      await this.loadData();
      UI.showToast(`Added ${stopData.name} to Route ${stopData.route}`, 'success');
    } catch (e) {
      UI.showToast('Failed to add stop: ' + e.message, 'error');
    }
  },

  async removeStop(stopId) {
    let stopName = '';
    for (const r of this.state.routes) {
      const s = r.stops.find(x => x.id === stopId);
      if (s) { stopName = s.name; break; }
    }
    if (!confirm(`Remove ${stopName}?`)) return;

    UI.showToast('Removing…', 'info');
    try {
      const result = await SheetsAPI.removeStop(stopId);
      if (result.error) throw new Error(result.error);
      await this.loadData();
      UI.showToast('Removed ' + stopName, 'success');
    } catch (e) {
      UI.showToast('Failed: ' + e.message, 'error');
    }
  },

  async reassignStop(stopId, newRoute) {
    UI.showToast('Reassigning…', 'info');
    try {
      const result = await SheetsAPI.reassignStop(stopId, newRoute);
      if (result.error) throw new Error(result.error);
      await this.loadData();
      UI.showToast('Reassigned to Route ' + newRoute, 'success');
    } catch (e) {
      UI.showToast('Failed: ' + e.message, 'error');
    }
  },

  async reorderStops(routeLetter, orderIds) {
    UI.showToast('Reordering…', 'info');
    try {
      const result = await SheetsAPI.reorderStops(routeLetter, orderIds);
      if (result.error) throw new Error(result.error);
      await this.loadData();
      UI.showToast('Route ' + routeLetter + ' reordered', 'success');
    } catch (e) {
      UI.showToast('Failed: ' + e.message, 'error');
    }
  },

  async addRoute(letter, color, volunteer) {
    UI.showToast('Creating route…', 'info');
    try {
      const result = await SheetsAPI.addRoute(letter, color, volunteer);
      if (result.error) throw new Error(result.error);
      await this.loadData();
      UI.showToast('Route ' + letter + ' created', 'success');
    } catch (e) {
      UI.showToast('Failed: ' + e.message, 'error');
    }
  },

  async deleteRoute(letter) {
    const route = this.state.routes.find(r => r.letter === letter);
    if (route && route.stops.length > 0) {
      return alert(`Cannot delete Route ${letter} — reassign its ${route.stops.length} stops first.`);
    }
    if (!confirm('Delete Route ' + letter + '?')) return;

    try {
      const result = await SheetsAPI.deleteRoute(letter);
      if (result.error) throw new Error(result.error);
      await this.loadData();
      UI.showToast('Route ' + letter + ' deleted', 'success');
    } catch (e) {
      UI.showToast('Failed: ' + e.message, 'error');
    }
  },

  async updateRoute(letter, fields) {
    try {
      const result = await SheetsAPI.updateRoute(letter, fields);
      if (result.error) throw new Error(result.error);
      await this.loadData();
      UI.showToast('Route ' + letter + ' updated', 'success');
    } catch (e) {
      UI.showToast('Failed: ' + e.message, 'error');
    }
  },

  async fixAllOrders() {
    UI.showToast('Fixing route order…', 'info');
    try {
      const result = await SheetsAPI.fixAllOrders();
      if (result.error) throw new Error(result.error);
      await this.loadData();
      UI.showToast('✓ Route orders fixed', 'success');
    } catch (e) {
      UI.showToast('Failed: ' + e.message, 'error');
    }
  },

  async tryOSRM() {
    UI.showToast('Attempting OSRM optimization…', 'info');
    let success = 0;
    for (const route of this.state.routes) {
      const result = await MapModule.optimizeRoute(route);
      if (result) {
        const oldStops = [...route.stops];
        route.stops = result.order.map(i => oldStops[i]);
        MapModule.drawOptimizedPolyline(route, result.coords);
        const orderIds = route.stops.map(s => s.id);
        await SheetsAPI.reorderStops(route.letter, orderIds);
        success++;
      }
    }
    if (success > 0) {
      this.render();
      UI.showToast(`Optimized ${success}/${this.state.routes.length} routes`, 'success');
    } else {
      UI.showToast('OSRM unavailable — use RouteXL links to optimize manually', 'error');
    }
  },

  // ─── Helpers ───

  findNearestRoute(lat, lon) {
    let nearest = this.state.routes[0]?.letter || 'A';
    let minDist = Infinity;
    for (const r of this.state.routes) {
      if (r.stops.length === 0) continue;
      const avgLat = r.stops.reduce((s, x) => s + x.lat, 0) / r.stops.length;
      const avgLon = r.stops.reduce((s, x) => s + x.lon, 0) / r.stops.length;
      const d = Math.sqrt(Math.pow(lat - avgLat, 2) + Math.pow(lon - avgLon, 2));
      if (d < minDist) { minDist = d; nearest = r.letter; }
    }
    return nearest;
  },

  findDuplicateStop(address) {
    const normalized = address.toLowerCase().replace(/\s+/g, ' ').trim();
    for (const r of this.state.routes) {
      for (const s of r.stops) {
        if (s.address.toLowerCase().replace(/\s+/g, ' ').trim() === normalized) {
          return { route: r.letter, name: s.name };
        }
      }
    }
    return null;
  },

  getNextRouteLetter() {
    const used = new Set(this.state.routes.map(r => r.letter));
    for (let i = 0; i < 26; i++) {
      const l = String.fromCharCode(65 + i);
      if (!used.has(l)) return l;
    }
    return 'X';
  },

  exportCSV() {
    let csv = 'Route,Volunteer,Name,Address,Lat,Lon,Signs,Notes,Delivered,Delivered Date,Delivered By\n';
    for (const r of this.state.routes) {
      for (const s of r.stops) {
        csv += [r.letter, `"${r.volunteer}"`, `"${s.name}"`, `"${s.address}"`, s.lat, s.lon, s.signs, `"${s.notes}"`, s.delivered, s.delivered_date, `"${s.delivered_by}"`].join(',') + '\n';
      }
    }
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'yard_signs_' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(url);
    UI.showToast('CSV exported', 'success');
  },

  async runImport(stops) {
    // Geocode each stop via Nominatim (1 req/sec rate limit)
    UI.showToast(`Geocoding ${stops.length} addresses…`, 'info');

    for (let i = 0; i < stops.length; i++) {
      const s = stops[i];
      UI.showToast(`Geocoding ${i + 1}/${stops.length}: ${s.name}…`, 'info');

      // Check for duplicate first
      const dup = this.findDuplicateStop(s.address);
      if (dup) { s.status = 'duplicate'; continue; }

      // Geocode
      const result = await Geocoder.geocode(s.address);
      if (result) {
        s.lat = result.lat;
        s.lon = result.lon;
        // Auto-assign route if needed
        if (s.route === 'auto') s.route = this.findNearestRoute(s.lat, s.lon);
        s.status = 'ok';
      } else {
        s.status = 'geocode_failed';
      }

      // Nominatim rate limit: 1 req/sec
      if (i < stops.length - 1) await new Promise(r => setTimeout(r, 1100));
    }

    UI.renderImportPreview(stops);
  },

  async commitImport(stops) {
    UI.closeModal();
    UI.showToast(`Adding ${stops.length} stops…`, 'info');
    let added = 0;
    for (const s of stops) {
      try {
        await SheetsAPI.addStop({
          name: s.name, address: s.address,
          lat: s.lat, lon: s.lon,
          signs: s.signs, notes: s.notes, route: s.route
        });
        s.status = 'added';
        added++;
      } catch (e) {
        console.error('Failed to add stop:', s.name, e);
      }
    }
    await this.loadData();
    UI.showToast(`✓ Imported ${added} stop${added !== 1 ? 's' : ''}`, 'success');
  }

};

// ─── Boot ───
document.addEventListener('DOMContentLoaded', () => App.init());
