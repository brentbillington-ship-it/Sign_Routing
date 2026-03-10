// ─── Google Sheets API Module ───

const SheetsAPI = {
  async getAll() {
    const url = CONFIG.SHEETS_API_URL + '?action=getAll';
    const resp = await fetch(url);
    return resp.json();
  },

  async post(data) {
    const resp = await fetch(CONFIG.SHEETS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' }, // Apps Script needs text/plain for CORS
      body: JSON.stringify(data)
    });
    return resp.json();
  },

  async addStop(stop) {
    return this.post({ action: 'addStop', stop });
  },

  async removeStop(id) {
    return this.post({ action: 'removeStop', id });
  },

  async updateStop(id, fields) {
    return this.post({ action: 'updateStop', id, fields });
  },

  async markDelivered(id, delivered, deliveredBy) {
    return this.post({ action: 'markDelivered', id, delivered, delivered_by: deliveredBy });
  },

  async reassignStop(id, newRoute) {
    return this.post({ action: 'reassignStop', id, newRoute });
  },

  async reorderStops(route, orderIds) {
    return this.post({ action: 'reorderStops', route, order: orderIds });
  },

  async addRoute(letter, color, volunteer) {
    return this.post({ action: 'addRoute', letter, color, volunteer });
  },

  async deleteRoute(letter) {
    return this.post({ action: 'deleteRoute', letter });
  },

  async updateRoute(letter, fields) {
    return this.post({ action: 'updateRoute', letter, fields });
  },

  async bulkImport(routes) {
    return this.post({ action: 'bulkImport', routes });
  }
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
