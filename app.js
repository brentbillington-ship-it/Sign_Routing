// ─── App Module ───

const App = {
  state: { routes: [] },

  async init() {
    UI.init();
    MapModule.init();
    await this.loadData();
  },

  async loadData() {
    UI.showToast('Loading routes...', 'info');
    try {
      const data = await SheetsAPI.getAll();
      if (data.error) throw new Error(data.error);
      this.state.routes = data.routes;
      this.render();
      UI.showToast('Routes loaded', 'success');
    } catch (e) {
      console.error('Load failed:', e);
      UI.showToast('Failed to load data \u2014 check config.js', 'error');
    }
  },

  render() {
    const routes = this.getFilteredRoutes();
    UI.updateStats(this.state.routes); // always show full stats
    UI.renderSidebar(routes);
    MapModule.renderRoutes(routes, { showDelivered: UI.showDelivered });
  },

  getFilteredRoutes() {
    if (UI.myRouteFilter) {
      return this.state.routes.filter(r => r.letter === UI.myRouteFilter);
    }
    return this.state.routes;
  },

  // ─── Actions ───

  async toggleDelivered(stopId) {
    // Find the stop
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

    // Update UI immediately
    const stopIndex = route.stops.indexOf(stop);
    MapModule.updateStopMarker(stop, route, stopIndex);
    MapModule.addLegend(this.state.routes);
    UI.renderSidebar(this.getFilteredRoutes());
    UI.updateStats(this.state.routes);

    // If signs > 1, confirm count
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

    // Save to sheet
    try {
      await SheetsAPI.markDelivered(stopId, newVal, deliveredBy);
    } catch (e) {
      console.error('Save failed:', e);
      UI.showToast('Failed to save \u2014 will retry', 'error');
    }
  },

  async addStop(stopData) {
    UI.showToast('Adding stop...', 'info');
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
    // Find stop name for confirmation
    let stopName = '';
    for (const r of this.state.routes) {
      const s = r.stops.find(x => x.id === stopId);
      if (s) { stopName = s.name; break; }
    }
    if (!confirm(`Remove ${stopName}?`)) return;

    UI.showToast('Removing...', 'info');
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
    UI.showToast('Reassigning...', 'info');
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
    UI.showToast('Reordering...', 'info');
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
    UI.showToast('Creating route...', 'info');
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
      return alert('Cannot delete Route ' + letter + ' \u2014 reassign its ' + route.stops.length + ' stops first.');
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

  async tryOSRM() {
    UI.showToast('Attempting OSRM optimization...', 'info');
    let success = 0;
    for (const route of this.state.routes) {
      const result = await MapModule.optimizeRoute(route);
      if (result) {
        // Reorder stops
        const oldStops = [...route.stops];
        route.stops = result.order.map(i => oldStops[i]);
        MapModule.drawOptimizedPolyline(route, result.coords);
        // Save new order to sheet
        const orderIds = route.stops.map(s => s.id);
        await SheetsAPI.reorderStops(route.letter, orderIds);
        success++;
      }
    }
    if (success > 0) {
      this.render();
      UI.showToast(`Optimized ${success}/${this.state.routes.length} routes`, 'success');
    } else {
      UI.showToast('OSRM unavailable \u2014 use RouteXL links to optimize manually', 'error');
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

  getNextRouteLetter() {
    const used = new Set(this.state.routes.map(r => r.letter));
    for (let i = 0; i < 26; i++) {
      const l = String.fromCharCode(65 + i);
      if (!used.has(l)) return l;
    }
    return 'X';
  },

  exportCSV() {
    let csv = 'Route,Name,Address,Lat,Lon,Signs,Notes,Delivered,Delivered Date,Delivered By\n';
    for (const r of this.state.routes) {
      for (const s of r.stops) {
        csv += [r.letter, s.name, `"${s.address}"`, s.lat, s.lon, s.signs, `"${s.notes}"`, s.delivered, s.delivered_date, s.delivered_by].join(',') + '\n';
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
  }
};

// ─── Boot ───
document.addEventListener('DOMContentLoaded', () => App.init());
