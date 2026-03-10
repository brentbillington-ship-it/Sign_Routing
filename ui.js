// ─── UI Module ───

const UI = {
  isAdmin: false,
  openRoute: null,
  volunteerName: localStorage.getItem('volunteerName') || '',
  myRouteFilter: null,
  showDelivered: true,

  init() {
    this.renderHeader();
    this.renderAdminBar();
  },

  renderHeader() {
    const header = document.getElementById('header');
    header.innerHTML = `
      <h1>Chaka Yard Signs</h1>
      <div class="header-controls">
        <select id="my-route-filter" title="Filter to my route">
          <option value="">All Routes</option>
        </select>
        <label class="toggle-label" title="Show/hide delivered stops">
          <input type="checkbox" id="toggle-delivered" checked> Delivered
        </label>
        <button class="btn btn-admin" id="admin-btn">\u2699 Admin</button>
      </div>
      <div class="stats" id="stats"></div>
    `;

    document.getElementById('admin-btn').addEventListener('click', () => this.toggleAdmin());
    document.getElementById('toggle-delivered').addEventListener('change', (e) => {
      this.showDelivered = e.target.checked;
      App.render();
    });
    document.getElementById('my-route-filter').addEventListener('change', (e) => {
      this.myRouteFilter = e.target.value || null;
      App.render();
    });
  },

  renderAdminBar() {
    const bar = document.getElementById('admin-bar');
    bar.innerHTML = `
      <button class="btn btn-green" onclick="UI.showAddStopForm()">+ Add Address</button>
      <button class="btn btn-green" onclick="UI.showAddRouteForm()">+ New Route</button>
      <button class="btn" onclick="App.exportCSV()">\u2913 Export CSV</button>
      <button class="btn" onclick="App.tryOSRM()">\u21bb Optimize All (OSRM)</button>
    `;
    bar.style.display = 'none';
  },

  toggleAdmin() {
    if (this.isAdmin) {
      this.isAdmin = false;
      document.getElementById('admin-bar').style.display = 'none';
      document.body.classList.remove('admin-mode');
      App.render();
      return;
    }
    const pw = prompt('Admin password:');
    if (pw === CONFIG.ADMIN_PASSWORD) {
      this.isAdmin = true;
      document.getElementById('admin-bar').style.display = 'flex';
      document.body.classList.add('admin-mode');
      App.render();
    } else if (pw !== null) {
      alert('Incorrect password');
    }
  },

  updateStats(routes) {
    const totalStops = routes.reduce((s, r) => s + r.stops.length, 0);
    const totalSigns = routes.reduce((s, r) => s + r.stops.reduce((a, b) => a + b.signs, 0), 0);
    const totalDelivered = routes.reduce((s, r) => s + r.stops.filter(x => x.delivered).length, 0);
    document.getElementById('stats').innerHTML = `
      <span>${routes.length}</span> Routes &nbsp;\u00b7&nbsp;
      <span>${totalStops}</span> Stops &nbsp;\u00b7&nbsp;
      <span>${totalSigns}</span> Signs &nbsp;\u00b7&nbsp;
      <span class="delivered-count">${totalDelivered}/${totalStops}</span> Delivered
    `;

    // Update route filter dropdown
    const sel = document.getElementById('my-route-filter');
    const currentVal = sel.value;
    sel.innerHTML = '<option value="">All Routes</option>' +
      routes.map(r => `<option value="${r.letter}"${r.letter === currentVal ? ' selected' : ''}>Route ${r.letter}${r.volunteer !== '[UNASSIGNED]' ? ' \u2014 ' + r.volunteer : ''}</option>`).join('');
  },

  renderSidebar(routes) {
    const sb = document.getElementById('sidebar');
    sb.innerHTML = '';

    const filtered = this.myRouteFilter
      ? routes.filter(r => r.letter === this.myRouteFilter)
      : routes;

    filtered.forEach((route, ri) => {
      const color = route.color || CONFIG.ROUTE_COLORS[ri % CONFIG.ROUTE_COLORS.length];
      const delivered = route.stops.filter(s => s.delivered).length;
      const total = route.stops.length;
      const pct = total > 0 ? Math.round((delivered / total) * 100) : 0;
      const totalSigns = route.stops.reduce((a, s) => a + s.signs, 0);

      const card = document.createElement('div');
      card.className = 'route-card' + (this.openRoute === route.letter ? ' open' : '');
      card.id = 'card-' + route.letter;

      // Progress bar
      const progressBar = `<div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${color}"></div></div>`;

      // Volunteer name
      const volName = route.volunteer || '[UNASSIGNED]';

      // Stops HTML
      const visibleStops = this.showDelivered ? route.stops : route.stops.filter(s => !s.delivered);
      const stopsHtml = visibleStops.map((s, si) => {
        const actualIndex = route.stops.indexOf(s);
        const deliveredClass = s.delivered ? ' stop-delivered' : '';
        let extra = '';
        if (s.signs > 1) extra += ` <span class="stop-signs">(x${s.signs})</span>`;
        if (s.notes) extra += ` <span class="stop-notes">[${s.notes}]</span>`;

        const deliverBtn = `<button class="deliver-btn ${s.delivered ? 'delivered' : ''}" onclick="event.stopPropagation(); App.toggleDelivered('${s.id}')" title="${s.delivered ? 'Mark undelivered' : 'Mark delivered'}">
          ${s.delivered ? '\u2713' : '\u25cb'}
        </button>`;

        const adminBtns = this.isAdmin ? `
          <div class="stop-admin">
            <button class="btn-tiny" onclick="event.stopPropagation(); UI.showReassignForm('${s.id}')" title="Reassign">\u21c4</button>
            <button class="btn-tiny btn-danger" onclick="event.stopPropagation(); App.removeStop('${s.id}')" title="Remove">\u2715</button>
          </div>` : '';

        const deliveryInfo = s.delivered ? `<div class="delivery-info">\u2713 ${s.delivered_date ? new Date(s.delivered_date).toLocaleDateString() : ''} ${s.delivered_by ? 'by ' + s.delivered_by : ''}</div>` : '';

        return `<div class="stop${deliveredClass}">
          ${deliverBtn}
          <div class="stop-content">
            <span class="stop-num">${actualIndex + 1}.</span>
            <div class="stop-detail">
              <span class="stop-name">${s.name}</span><br>${s.address}${extra}
              ${deliveryInfo}
            </div>
          </div>
          ${adminBtns}
        </div>`;
      }).join('');

      // Google Maps link
      const gmLink = 'https://www.google.com/maps/dir/' + route.stops.map(s => encodeURIComponent(s.address)).join('/');

      // RouteXL link
      const rxlQ = route.stops.map(s => s.address).join('$');
      const rxlLink = 'https://www.routexl.com/?q=' + encodeURIComponent(rxlQ) + '&roundtrip=false&lang=en';

      // Admin route controls
      const adminRouteControls = this.isAdmin ? `
        <div class="route-admin-controls">
          <button class="btn btn-sm" onclick="event.stopPropagation(); UI.showReorderForm('${route.letter}')">\u2195 Reorder</button>
          <button class="btn btn-sm" onclick="event.stopPropagation(); UI.showEditRouteForm('${route.letter}')">\u270e Edit Route</button>
          <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); App.deleteRoute('${route.letter}')">\u2715 Delete Route</button>
        </div>` : '';

      card.innerHTML = `
        <div class="route-header" onclick="UI.toggleRoute('${route.letter}')">
          <div class="route-badge" style="background:${color}">${route.letter}</div>
          <div class="route-meta">
            <div class="title">Route ${route.letter} \u2014 ${total} stops</div>
            <div class="info">${totalSigns} signs \u00b7 ${volName} \u00b7 ${delivered}/${total} delivered</div>
            ${progressBar}
          </div>
          <div class="route-toggle">\u25BC</div>
        </div>
        <div class="route-stops">
          ${stopsHtml}
          <div class="route-actions">
            <a class="route-link gmaps" href="${gmLink}" target="_blank">\ud83d\udccd Google Maps</a>
            <a class="route-link routexl" href="${rxlLink}" target="_blank">\ud83d\udd00 RouteXL</a>
          </div>
          ${adminRouteControls}
        </div>`;

      sb.appendChild(card);
    });
  },

  toggleRoute(letter) {
    if (this.openRoute === letter) {
      this.openRoute = null;
    } else {
      this.openRoute = letter;
      const route = App.state.routes.find(r => r.letter === letter);
      if (route) MapModule.focusRoute(route);
    }
    // Re-render just the card states
    document.querySelectorAll('.route-card').forEach(c => {
      c.classList.toggle('open', c.id === 'card-' + this.openRoute);
    });
  },

  // ─── Forms ───

  showAddStopForm() {
    const routes = App.state.routes;
    const routeOpts = routes.map(r => `<option value="${r.letter}">Route ${r.letter}</option>`).join('');

    this.showModal('Add Address', `
      <div class="form-group">
        <label>Name</label>
        <input type="text" id="form-name" placeholder="First Last">
      </div>
      <div class="form-group">
        <label>Street Address</label>
        <input type="text" id="form-address" placeholder="123 Main St">
      </div>
      <div class="form-group">
        <label>City/State/Zip</label>
        <input type="text" id="form-city" value="${CONFIG.DEFAULT_CITY}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Lat</label>
          <input type="text" id="form-lat" placeholder="Auto or paste">
        </div>
        <div class="form-group">
          <label>Lon</label>
          <input type="text" id="form-lon" placeholder="Auto or paste">
        </div>
        <button class="btn btn-sm" onclick="UI.geocodeAddress()" style="margin-top:22px">Geocode</button>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Signs</label>
          <input type="number" id="form-signs" value="1" min="1" max="10">
        </div>
        <div class="form-group">
          <label>Route</label>
          <select id="form-route">
            <option value="auto">Auto (nearest)</option>
            ${routeOpts}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Notes</label>
        <input type="text" id="form-notes" placeholder="Optional install notes">
      </div>
      <div id="geocode-status" class="form-status"></div>
    `, async () => {
      const name = document.getElementById('form-name').value.trim();
      const street = document.getElementById('form-address').value.trim();
      const city = document.getElementById('form-city').value.trim();
      const lat = parseFloat(document.getElementById('form-lat').value);
      const lon = parseFloat(document.getElementById('form-lon').value);
      const signs = parseInt(document.getElementById('form-signs').value) || 1;
      let route = document.getElementById('form-route').value;
      const notes = document.getElementById('form-notes').value.trim();

      if (!name || !street) return alert('Name and address are required');
      if (isNaN(lat) || isNaN(lon)) return alert('Coordinates required \u2014 click Geocode or paste lat/lon');

      const address = street + ', ' + city;

      // Auto-assign to nearest route
      if (route === 'auto') {
        route = App.findNearestRoute(lat, lon);
      }

      await App.addStop({ name, address, lat, lon, signs, notes, route });
      this.closeModal();
    });
  },

  async geocodeAddress() {
    const street = document.getElementById('form-address').value.trim();
    const city = document.getElementById('form-city').value.trim();
    const statusEl = document.getElementById('geocode-status');

    if (!street) return;
    statusEl.textContent = 'Geocoding...';
    statusEl.className = 'form-status';

    const result = await Geocoder.geocode(street + ', ' + city);
    if (result) {
      document.getElementById('form-lat').value = result.lat.toFixed(6);
      document.getElementById('form-lon').value = result.lon.toFixed(6);
      statusEl.textContent = '\u2713 Found: ' + result.display;
      statusEl.className = 'form-status success';
    } else {
      statusEl.textContent = '\u2717 Not found \u2014 paste lat/lon manually from Google Maps';
      statusEl.className = 'form-status error';
    }
  },

  showAddRouteForm() {
    const nextLetter = App.getNextRouteLetter();
    const colors = CONFIG.ROUTE_COLORS;
    const colorOpts = colors.map((c, i) => `<option value="${c}" style="background:${c};color:#fff">${c}</option>`).join('');

    this.showModal('New Route', `
      <div class="form-row">
        <div class="form-group">
          <label>Letter</label>
          <input type="text" id="form-route-letter" value="${nextLetter}" maxlength="2">
        </div>
        <div class="form-group">
          <label>Color</label>
          <select id="form-route-color">${colorOpts}</select>
        </div>
      </div>
      <div class="form-group">
        <label>Volunteer Name</label>
        <input type="text" id="form-route-volunteer" placeholder="[UNASSIGNED]">
      </div>
    `, async () => {
      const letter = document.getElementById('form-route-letter').value.trim().toUpperCase();
      const color = document.getElementById('form-route-color').value;
      const volunteer = document.getElementById('form-route-volunteer').value.trim() || '[UNASSIGNED]';
      if (!letter) return alert('Route letter required');
      await App.addRoute(letter, color, volunteer);
      this.closeModal();
    });
  },

  showEditRouteForm(letter) {
    const route = App.state.routes.find(r => r.letter === letter);
    if (!route) return;
    const colors = CONFIG.ROUTE_COLORS;
    const colorOpts = colors.map(c => `<option value="${c}"${c === route.color ? ' selected' : ''} style="background:${c};color:#fff">${c}</option>`).join('');

    this.showModal('Edit Route ' + letter, `
      <div class="form-group">
        <label>Color</label>
        <select id="form-edit-color">${colorOpts}</select>
      </div>
      <div class="form-group">
        <label>Volunteer Name</label>
        <input type="text" id="form-edit-volunteer" value="${route.volunteer || ''}">
      </div>
    `, async () => {
      const color = document.getElementById('form-edit-color').value;
      const volunteer = document.getElementById('form-edit-volunteer').value.trim() || '[UNASSIGNED]';
      await App.updateRoute(letter, { color, volunteer });
      this.closeModal();
    });
  },

  showReassignForm(stopId) {
    const routes = App.state.routes;
    const routeOpts = routes.map(r => `<option value="${r.letter}">Route ${r.letter}</option>`).join('');

    this.showModal('Reassign Stop', `
      <div class="form-group">
        <label>Move to route:</label>
        <select id="form-reassign-route">${routeOpts}</select>
      </div>
    `, async () => {
      const newRoute = document.getElementById('form-reassign-route').value;
      await App.reassignStop(stopId, newRoute);
      this.closeModal();
    });
  },

  showReorderForm(letter) {
    const route = App.state.routes.find(r => r.letter === letter);
    if (!route) return;

    const stopsList = route.stops.map((s, i) => `${i + 1}. ${s.name} \u2014 ${s.address}`).join('\n');

    this.showModal('Reorder Route ' + letter, `
      <p style="font-size:12px;color:#8b949e;margin-bottom:8px">
        Open <a href="${'https://www.routexl.com/?q=' + encodeURIComponent(route.stops.map(s => s.address).join('$')) + '&roundtrip=false&lang=en'}" target="_blank" style="color:#58a6ff">RouteXL</a> to optimize, then enter the new order below.
      </p>
      <div class="form-group">
        <label>Current order:</label>
        <pre class="order-preview">${stopsList}</pre>
      </div>
      <div class="form-group">
        <label>New order (comma-separated numbers, e.g. 3,1,5,2,4,7,6)</label>
        <input type="text" id="form-reorder" placeholder="3,1,5,2,4,7,6">
      </div>
    `, async () => {
      const input = document.getElementById('form-reorder').value.trim();
      if (!input) return alert('Enter the new order');
      const order = input.split(',').map(n => parseInt(n.trim()) - 1); // 1-indexed to 0-indexed
      if (order.length !== route.stops.length) return alert(`Expected ${route.stops.length} numbers, got ${order.length}`);
      if (order.some(n => isNaN(n) || n < 0 || n >= route.stops.length)) return alert('Invalid number in order');
      // Check all unique
      if (new Set(order).size !== order.length) return alert('Duplicate numbers in order');

      const newOrderIds = order.map(i => route.stops[i].id);
      await App.reorderStops(letter, newOrderIds);
      this.closeModal();
    });
  },

  // ─── Modal ───

  showModal(title, bodyHtml, onConfirm) {
    let modal = document.getElementById('modal-overlay');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modal-overlay';
      document.body.appendChild(modal);
    }
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="modal-close" onclick="UI.closeModal()">\u2715</button>
        </div>
        <div class="modal-body">${bodyHtml}</div>
        <div class="modal-footer">
          <button class="btn" onclick="UI.closeModal()">Cancel</button>
          <button class="btn btn-green" id="modal-confirm">Confirm</button>
        </div>
      </div>
    `;
    modal.style.display = 'flex';
    document.getElementById('modal-confirm').addEventListener('click', onConfirm);
  },

  closeModal() {
    const modal = document.getElementById('modal-overlay');
    if (modal) modal.style.display = 'none';
  },

  showToast(msg, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3000);
  }
};
