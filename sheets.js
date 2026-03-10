// ─── Google Sheets API Module ───
// Apps Script POST responses redirect to googleusercontent.com which blocks CORS.
// All calls use GET with ?payload= encoded JSON — the only reliable approach.

const SheetsAPI = {
  async _get(data) {
    const encoded = encodeURIComponent(JSON.stringify(data));
    const url = CONFIG.SHEETS_API_URL + '?payload=' + encoded;
    try {
      const resp = await fetch(url, { redirect: 'follow' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      return resp.json();
    } catch (e) {
      console.error('API call failed:', data.action, e);
      throw e;
    }
  },

  async getAll()                      { return this._get({ action: 'getAll' }); },
  async addStop(stop)                 { return this._get({ action: 'addStop', stop }); },
  async removeStop(id)                { return this._get({ action: 'removeStop', id }); },
  async updateStop(id, fields)        { return this._get({ action: 'updateStop', id, fields }); },
  async markDelivered(id, del, by)    { return this._get({ action: 'markDelivered', id, delivered: del, delivered_by: by }); },
  async reassignStop(id, newRoute)    { return this._get({ action: 'reassignStop', id, newRoute }); },
  async reorderStops(route, orderIds) { return this._get({ action: 'reorderStops', route, order: orderIds }); },
  async addRoute(letter, color, vol)  { return this._get({ action: 'addRoute', letter, color, volunteer: vol }); },
  async deleteRoute(letter)           { return this._get({ action: 'deleteRoute', letter }); },
  async updateRoute(letter, fields)   { return this._get({ action: 'updateRoute', letter, fields }); },
  async bulkImport(routes)            { return this._get({ action: 'bulkImport', routes }); }
};

// ─── Nominatim Geocoding ───

const Geocoder = {
  async geocode(address) {
    const q = encodeURIComponent(address);
    const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=us`;
    try {
      const resp = await fetch(url, { headers: { 'User-Agent': 'ChakaSignRoutes/1.0' } });
      const data = await resp.json();
      if (data && data[0]) {
        return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), display: data[0].display_name };
      }
    } catch (e) {
      console.error('Geocoding error:', e);
    }
    return null;
  }
};
