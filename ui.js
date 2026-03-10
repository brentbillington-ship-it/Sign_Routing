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
    this.renderOfflineBanner();
    this.renderNamePrompt();
  },

  // ─── Offline Banner ───

  renderOfflineBanner() {
    const el = document.createElement('div');
    el.id = 'offline-banner';
    el.innerHTML = '⚠ Working offline — changes may not be saving. Check your connection.';
    document.body.insertBefore(el, document.querySelector('.container'));
  },

  setOffline(isOffline) {
    const banner = document.getElementById('offline-banner');
    if (!banner) return;
    if (isOffline) {
      banner.classList.add('visible');
      document.body.classList.add('has-offline-banner');
    } else {
      banner.classList.remove('visible');
      document.body.classList.remove('has-offline-banner');
    }
  },

  // ─── First-run Name Prompt ───

  renderNamePrompt() {
    const overlay = document.createElement('div');
    overlay.id = 'name-prompt-overlay';
    overlay.innerHTML = `
      <div class="name-prompt-box">
        <div class="prompt-icon">🪧</div>
        <h2>Welcome!</h2>
        <p>Enter your name so deliveries get attributed to you. This is saved on your device.</p>
        <input type="text" id="prompt-name-input" placeholder="Your name" autocomplete="off">
        <button class="btn btn-green" style="width:100%" onclick="UI.savePromptName()">Let's go</button>
        <br>
        <button class="btn-skip" onclick="UI.skipNamePrompt()">Skip for now</button>
      </div>
    `;
    document.body.appendChild(overlay);

    // Show on first load if no name saved
    if (!this.volunteerName) {
      overlay.classList.add('visible');
      setTimeout(() => {
        const inp = document.getElementById('prompt-name-input');
        if (inp) inp.focus();
      }, 100);
    }

    // Allow Enter key
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.savePromptName();
    });
  },

  savePromptName() {
    const val = (document.getElementById('prompt-name-input')?.value || '').trim();
    if (val) {
      this.volunteerName = val;
      localStorage.setItem('volunteerName', val);
      this._updateVolNameInput();
    }
    document.getElementById('name-prompt-overlay').classList.remove('visible');
  },

  skipNamePrompt() {
    // Mark that they've seen the prompt so we don't show it again this session
    document.getElementById('name-prompt-overlay').classList.remove('visible');
  },

  // ─── Header ───

  renderHeader() {
    const header = document.getElementById('header');
    header.innerHTML = `
      <h1>🪧 Chaka Signs</h1>
      <div class="header-controls">
        <div id="volunteer-name-wrap">
          👤 <input type="text" id="volunteer-name-input" placeholder="Your name" title="Your name (shown on deliveries)" value="${this.volunteerName}">
        </div>
        <select id="my-route-filter" title="Filter to my route">
          <option value="">All Routes</option>
        </select>
        <label class="toggle-label" title="Show/hide delivered stops">
          <input type="checkbox" id="toggle-delivered" checked> Delivered
        </label>
        <button class="btn btn-admin" id="admin-btn">⚙ Admin</button>
        <button class="btn" id="map-toggle-btn" onclick="UI.toggleMap()" title="Show/hide map">🗺 Map</button>
      </div>
      <div class="stats" id="stats">
        <span id="sync-indicator"></span>
      </div>
      <div id="presence-bar"></div>
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

    const nameInput = document.getElementById('volunteer-name-input');
    nameInput.addEventListener('input', (e) => {
      this.volunteerName = e.target.value.trim();
      localStorage.setItem('volunteerName', this.volunteerName);
      this._updateVolNameInput();
    });

    this._updateVolNameInput();
  },

  _updateVolNameInput() {
    const inp = document.getElementById('volunteer-name-input');
    if (!inp) return;
    if (this.volunteerName) {
      inp.classList.add('has-name');
      inp.value = this.volunteerName;
    } else {
      inp.classList.remove('has-name');
    }
  },

  setSyncStatus(status) {
    // status: 'syncing' | 'ok' | 'error' | ''
    const el = document.getElementById('sync-indicator');
    if (!el) return;
    el.className = 'sync-indicator ' + status;
    if (status === 'syncing') el.textContent = '↻ Saving…';
    else if (status === 'ok') { el.textContent = '✓ Saved'; setTimeout(() => { if (el.textContent === '✓ Saved') el.textContent = ''; el.className = ''; }, 2500); }
    else if (status === 'error') el.textContent = '⚠ Save failed';
    else el.textContent = '';
  },

  // ─── Admin Bar ───

  renderAdminBar() {
    const bar = document.getElementById('admin-bar');
    bar.innerHTML = `
      <button class="btn btn-green" onclick="UI.showAddStopForm()">+ Add Address</button>
      <button class="btn btn-green" onclick="UI.showAddRouteForm()">+ New Route</button>
      <button class="btn" onclick="UI.toggleVolPanel()">👥 Assign Volunteers</button>
      <button class="btn" onclick="UI.showImportForm()">⤒ Import CSV</button>
      <button class="btn" onclick="App.exportCSV()">⤓ Export CSV</button>
      <button class="btn" onclick="App.tryOSRM()">↻ Optimize All (OSRM)</button>
    `;
    bar.style.display = 'none';
  },

  toggleAdmin() {
    if (this.isAdmin) {
      this.isAdmin = false;
      document.getElementById('admin-bar').style.display = 'none';
      document.body.classList.remove('admin-mode');
      const vp = document.getElementById('vol-panel');
      if (vp) vp.classList.remove('visible');
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

  // ─── Volunteer Assignment Panel ───

  toggleVolPanel() {
    const sb = document.getElementById('sidebar');
    let panel = document.getElementById('vol-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'vol-panel';
      sb.insertBefore(panel, sb.firstChild);
    }
    if (panel.classList.contains('visible')) {
      panel.classList.remove('visible');
    } else {
      this.renderVolPanel(panel);
      panel.classList.add('visible');
    }
  },

  renderVolPanel(panel) {
    const routes = App.state.routes;
    const rows = routes.map(r => {
      const color = r.color || '#58a6ff';
      const isAssigned = r.volunteer && r.volunteer !== '[UNASSIGNED]';
      return `
        <div class="vol-row">
          <div class="vol-row-badge" style="background:${color}">${r.letter}</div>
          <label>Route ${r.letter}</label>
          <input type="text"
            class="${isAssigned ? 'assigned' : ''}"
            placeholder="[UNASSIGNED]"
            value="${isAssigned ? r.volunteer : ''}"
            data-route="${r.letter}"
            oninput="this.classList.toggle('assigned', this.value.trim().length > 0)">
        </div>`;
    }).join('');

    panel.innerHTML = `
      <div class="vol-panel-header">
        <h3>👥 Assign Volunteers</h3>
        <button onclick="UI.toggleVolPanel()">✕</button>
      </div>
      ${rows}
      <div class="vol-panel-footer">
        <button class="btn" onclick="UI.toggleVolPanel()">Cancel</button>
        <button class="btn btn-green" onclick="UI.saveVolAssignments()">Save All</button>
      </div>
    `;
  },

  async saveVolAssignments() {
    const inputs = document.querySelectorAll('#vol-panel input[data-route]');
    const updates = [];
    inputs.forEach(inp => {
      const letter = inp.dataset.route;
      const volunteer = inp.value.trim() || '[UNASSIGNED]';
      const route = App.state.routes.find(r => r.letter === letter);
      if (route && route.volunteer !== volunteer) {
        updates.push({ letter, volunteer });
      }
    });

    if (updates.length === 0) {
      this.showToast('No changes to save', 'info');
      this.toggleVolPanel();
      return;
    }

    this.showToast('Saving assignments…', 'info');
    try {
      for (const u of updates) {
        await App.updateRoute(u.letter, { volunteer: u.volunteer });
      }
      this.toggleVolPanel();
      this.showToast(`Saved ${updates.length} assignment${updates.length > 1 ? 's' : ''}`, 'success');
    } catch (e) {
      this.showToast('Failed to save assignments', 'error');
    }
  },

  // ─── Stats ───

  updateStats(routes) {
    const totalStops = routes.reduce((s, r) => s + r.stops.length, 0);
    const totalSigns = routes.reduce((s, r) => s + r.stops.reduce((a, b) => a + b.signs, 0), 0);
    const totalDelivered = routes.reduce((s, r) => s + r.stops.filter(x => x.delivered).length, 0);

    const statsEl = document.getElementById('stats');
    const syncEl = document.getElementById('sync-indicator');
    const syncHtml = syncEl ? syncEl.outerHTML : '';

    statsEl.innerHTML = `
      <span>${routes.length}</span> Routes &nbsp;·&nbsp;
      <span>${totalStops}</span> Stops &nbsp;·&nbsp;
      <span>${totalSigns}</span> Signs &nbsp;·&nbsp;
      <span class="delivered-count">${totalDelivered}/${totalStops}</span> Delivered
      ${syncHtml}
    `;

    // Update route filter dropdown
    const sel = document.getElementById('my-route-filter');
    const currentVal = sel.value;
    sel.innerHTML = '<option value="">All Routes</option>' +
      routes.map(r => {
        const label = r.volunteer && r.volunteer !== '[UNASSIGNED]'
          ? `Route ${r.letter} — ${r.volunteer}`
          : `Route ${r.letter}`;
        return `<option value="${r.letter}"${r.letter === currentVal ? ' selected' : ''}>${label}</option>`;
      }).join('');
  },

  // ─── Sidebar ───

  renderSidebar(routes) {
    const sb = document.getElementById('sidebar');

    // Preserve vol-panel if it exists
    const existingPanel = document.getElementById('vol-panel');

    sb.innerHTML = '';

    // Re-insert vol panel if it was open
    if (existingPanel && existingPanel.classList.contains('visible')) {
      sb.appendChild(existingPanel);
    }

    // Sort: incomplete routes first, 100% delivered routes last
    const sorted = [...routes].sort((a, b) => {
      const aPct = a.stops.length > 0 ? a.stops.filter(s => s.delivered).length / a.stops.length : 0;
      const bPct = b.stops.length > 0 ? b.stops.filter(s => s.delivered).length / b.stops.length : 0;
      const aFull = aPct >= 1;
      const bFull = bPct >= 1;
      if (aFull !== bFull) return aFull ? 1 : -1;
      return 0; // preserve original order among same group
    });

    sorted.forEach((route, ri) => {
      const color = route.color || CONFIG.ROUTE_COLORS[ri % CONFIG.ROUTE_COLORS.length];
      const delivered = route.stops.filter(s => s.delivered).length;
      const total = route.stops.length;
      const pct = total > 0 ? Math.round((delivered / total) * 100) : 0;
      const totalSigns = route.stops.reduce((a, s) => a + s.signs, 0);
      const allDone = total > 0 && delivered === total;
      const isUnassigned = !route.volunteer || route.volunteer === '[UNASSIGNED]';

      const card = document.createElement('div');
      card.className = 'route-card' +
        (this.openRoute === route.letter ? ' open' : '') +
        (allDone ? ' all-delivered' : '');
      card.id = 'card-' + route.letter;

      const progressBar = `<div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${color}"></div></div>`;

      const volDisplay = isUnassigned ? '' : route.volunteer;

      const signsPill = totalSigns > total
        ? `<span class="signs-pill">📦 ${totalSigns} signs</span>`
        : '';

      // Stops HTML
      const visibleStops = this.showDelivered ? route.stops : route.stops.filter(s => !s.delivered);
      const stopsHtml = visibleStops.map((s) => {
        const actualIndex = route.stops.indexOf(s);
        const deliveredClass = s.delivered ? ' stop-delivered' : '';
        let extra = '';
        if (s.signs > 1) extra += ` <span class="stop-signs">(x${s.signs})</span>`;
        if (s.notes) extra += ` <span class="stop-notes">[${s.notes}]</span>`;

        const deliverBtn = `<button class="deliver-btn ${s.delivered ? 'delivered' : ''}" onclick="event.stopPropagation(); App.toggleDelivered('${s.id}')" title="${s.delivered ? 'Mark undelivered' : 'Mark delivered'}">
          ${s.delivered ? '✓' : '○'}
        </button>`;

        const adminBtns = this.isAdmin ? `
          <div class="stop-admin">
            <button class="btn-tiny" onclick="event.stopPropagation(); UI.showReassignForm('${s.id}')" title="Reassign">⇄</button>
            <button class="btn-tiny btn-danger" onclick="event.stopPropagation(); App.removeStop('${s.id}')" title="Remove">✕</button>
          </div>` : '';

        const deliveryInfo = s.delivered
          ? `<div class="delivery-info">✓ ${s.delivered_date ? new Date(s.delivered_date).toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) + ' CT' : ''}${s.delivered_by ? ' by ' + s.delivered_by : ''}</div>`
          : '';

        // Duplicate check indicator (set during addStop flow)
        return `<div class="stop${deliveredClass}">
          ${deliverBtn}
          <div class="stop-content">
            <span class="stop-num">${actualIndex + 1}.</span>
            <div class="stop-detail" onclick="event.stopPropagation(); UI.copyStopAddress('${s.address}', '${s.name.replace(/'/g, "\\'")}')" title="Tap to copy address" style="cursor:pointer">
              <span class="stop-name">${s.name}</span><br>${s.address}${extra}
              ${deliveryInfo}
            </div>
          </div>
          ${adminBtns}
        </div>`;
      }).join('');

      const gmLink = 'https://www.google.com/maps/dir/' + route.stops.map(s => encodeURIComponent(s.address)).join('/');
      const rxlQ = route.stops.map(s => s.address).join('$');
      const rxlLink = 'https://www.routexl.com/?q=' + encodeURIComponent(rxlQ) + '&roundtrip=false&lang=en';

      // Inline assign button (admin only)
      const assignBtn = this.isAdmin
        ? `<button class="route-assign-btn ${isUnassigned ? 'unassigned' : ''}" onclick="event.stopPropagation(); UI.showQuickAssignForm('${route.letter}')" title="Assign volunteer">👤 ${isUnassigned ? 'Assign' : route.volunteer}</button>`
        : '';

      const adminRouteControls = this.isAdmin ? `
        <div class="route-admin-controls">
          <button class="btn btn-sm" onclick="event.stopPropagation(); UI.showReorderForm('${route.letter}')">↕ Reorder</button>
          <button class="btn btn-sm" onclick="event.stopPropagation(); UI.showEditRouteForm('${route.letter}')">✎ Edit Route</button>
          <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); App.deleteRoute('${route.letter}')">✕ Delete Route</button>
        </div>` : '';

      const allDoneBadge = allDone ? `<span style="font-size:10px;color:var(--green);font-weight:700;margin-left:4px">✓ Complete</span>` : '';

      card.innerHTML = `
        <div class="route-header" onclick="UI.toggleRoute('${route.letter}')">
          <div class="route-badge ${isUnassigned ? 'unassigned' : ''}" style="background:${color}">${route.letter}</div>
          <div class="route-meta">
            <div class="title">Route ${route.letter} — ${total} stops${signsPill}${allDoneBadge}</div>
            <div class="info">${volDisplay ? volDisplay + ' · ' : ''}${delivered}/${total} delivered</div>
            ${progressBar}
          </div>
          ${assignBtn}
          <div class="route-toggle">▼</div>
        </div>
        <div class="route-stops">
          ${stopsHtml}
          <div class="route-actions">
            <a class="route-link gmaps" href="${gmLink}" target="_blank">📍 Google Maps</a>
            <a class="route-link routexl" href="${rxlLink}" target="_blank">🔀 RouteXL</a>
            <button class="copy-addrs-btn" onclick="event.stopPropagation(); UI.copyAddresses('${route.letter}')">📋 Copy Addresses</button>
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
    document.querySelectorAll('.route-card').forEach(c => {
      c.classList.toggle('open', c.id === 'card-' + this.openRoute);
    });
  },

  // ─── Copy Addresses ───

  copyAddresses(letter) {
    const route = App.state.routes.find(r => r.letter === letter);
    if (!route) return;
    const text = route.stops.map((s, i) => `${i + 1}. ${s.name} — ${s.address}`).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      this.showToast(`Copied ${route.stops.length} addresses for Route ${letter}`, 'success');
    }).catch(() => {
      // Fallback for older browsers
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      this.showToast(`Copied Route ${letter} addresses`, 'success');
    });
  },

  copyStopAddress(address, name) {
    navigator.clipboard.writeText(address).then(() => {
      this.showToast(`📋 Copied: ${address}`, 'success');
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = address;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      this.showToast(`📋 Copied: ${address}`, 'success');
    });
  },

  // ─── Forms ───

  showQuickAssignForm(letter) {
    const route = App.state.routes.find(r => r.letter === letter);
    if (!route) return;
    const current = route.volunteer === '[UNASSIGNED]' ? '' : (route.volunteer || '');
    this.showModal(`Assign Volunteer — Route ${letter}`, `
      <div class="form-group">
        <label>Volunteer Name</label>
        <input type="text" id="form-quick-vol" value="${current}" placeholder="Full name" autofocus>
      </div>
    `, async () => {
      const volunteer = document.getElementById('form-quick-vol').value.trim() || '[UNASSIGNED]';
      await App.updateRoute(letter, { volunteer });
      this.closeModal();
    });
    // Auto-focus
    setTimeout(() => document.getElementById('form-quick-vol')?.focus(), 100);
  },

  showAddStopForm() {
    const routes = App.state.routes;
    const routeOpts = routes.map(r => `<option value="${r.letter}">Route ${r.letter}${r.volunteer !== '[UNASSIGNED]' ? ' — ' + r.volunteer : ''}</option>`).join('');

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
      <div id="dup-warning" class="form-status error" style="display:none"></div>
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
      if (isNaN(lat) || isNaN(lon)) return alert('Coordinates required — click Geocode or paste lat/lon');

      const address = street + ', ' + city;

      // Duplicate check
      const dup = App.findDuplicateStop(address);
      if (dup) {
        const proceed = confirm(`⚠ "${address}" already exists in Route ${dup.route} (${dup.name}). Add anyway?`);
        if (!proceed) return;
      }

      // Route capacity check
      if (route !== 'auto') {
        const targetRoute = App.state.routes.find(r => r.letter === route);
        if (targetRoute && targetRoute.stops.length >= 10) {
          const proceed = confirm(`⚠ Route ${route} already has ${targetRoute.stops.length} stops (Google Maps limit is 10). Add anyway?`);
          if (!proceed) return;
        }
      }

      if (route === 'auto') {
        route = App.findNearestRoute(lat, lon);
        // Check nearest route capacity too
        const nearestRoute = App.state.routes.find(r => r.letter === route);
        if (nearestRoute && nearestRoute.stops.length >= 10) {
          this.showToast(`Auto-assigned to Route ${route} (already at 10 stops — consider reassigning)`, 'info');
        }
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
    statusEl.textContent = 'Geocoding…';
    statusEl.className = 'form-status';
    const result = await Geocoder.geocode(street + ', ' + city);
    if (result) {
      document.getElementById('form-lat').value = result.lat.toFixed(6);
      document.getElementById('form-lon').value = result.lon.toFixed(6);
      statusEl.textContent = '✓ Found: ' + result.display;
      statusEl.className = 'form-status success';
    } else {
      statusEl.textContent = '✗ Not found — paste lat/lon manually from Google Maps';
      statusEl.className = 'form-status error';
    }
  },

  showAddRouteForm() {
    const nextLetter = App.getNextRouteLetter();
    const colors = CONFIG.ROUTE_COLORS;
    const colorOpts = colors.map((c) => `<option value="${c}" style="background:${c};color:#fff">${c}</option>`).join('');

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
        <input type="text" id="form-edit-volunteer" value="${route.volunteer !== '[UNASSIGNED]' ? route.volunteer : ''}">
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
    const routeOpts = routes.map(r => {
      const vol = r.volunteer !== '[UNASSIGNED]' ? ` — ${r.volunteer}` : '';
      const warn = r.stops.length >= 10 ? ' ⚠' : '';
      return `<option value="${r.letter}">Route ${r.letter}${vol}${warn} (${r.stops.length} stops)</option>`;
    }).join('');

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
    const stopsList = route.stops.map((s, i) => `${i + 1}. ${s.name} — ${s.address}`).join('\n');

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
      const order = input.split(',').map(n => parseInt(n.trim()) - 1);
      if (order.length !== route.stops.length) return alert(`Expected ${route.stops.length} numbers, got ${order.length}`);
      if (order.some(n => isNaN(n) || n < 0 || n >= route.stops.length)) return alert('Invalid number in order');
      if (new Set(order).size !== order.length) return alert('Duplicate numbers in order');
      const newOrderIds = order.map(i => route.stops[i].id);
      await App.reorderStops(letter, newOrderIds);
      this.closeModal();
    });
  },

  // ─── CSV Import ───

  showImportForm() {
    const routes = App.state.routes;
    const routeOpts = routes.map(r => `<option value="${r.letter}">Route ${r.letter}${r.volunteer !== '[UNASSIGNED]' ? ' — ' + r.volunteer : ''}</option>`).join('');

    this.showModal('Import CSV', `
      <p style="font-size:11px;color:var(--text-dim);margin-bottom:10px;line-height:1.6">
        Paste or upload a CSV with columns:<br>
        <code style="color:var(--green);font-size:10px">name, address, route, signs, notes</code><br>
        <span style="font-size:10px">Address should include city/state/zip. Route column is optional — leave blank to auto-assign to nearest route. Signs defaults to 1.</span>
      </p>
      <div class="form-group">
        <label>Upload CSV file</label>
        <input type="file" id="import-file" accept=".csv,.txt" style="font-size:11px">
      </div>
      <div class="form-group">
        <label>Or paste CSV text</label>
        <textarea id="import-paste" rows="6" style="width:100%;padding:8px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:5px;color:var(--text-bright);font-size:11px;font-family:monospace;resize:vertical" placeholder="name,address,route,signs,notes&#10;John Smith,123 Oak St Coppell TX 75019,A,1,&#10;Jane Doe,456 Elm Dr Coppell TX 75019,,2,Install near sidewalk"></textarea>
      </div>
      <div class="form-group">
        <label>Default route (if not specified in CSV)</label>
        <select id="import-default-route">
          <option value="auto">Auto (nearest)</option>
          ${routeOpts}
        </select>
      </div>
      <div id="import-status" class="form-status" style="min-height:18px"></div>
    `, async () => {
      await UI._runImport();
    }, 'Preview & Import');
  },

  async _runImport() {
    const fileInput = document.getElementById('import-file');
    const pasteEl = document.getElementById('import-paste');
    const statusEl = document.getElementById('import-status');
    const defaultRoute = document.getElementById('import-default-route').value;

    let rawText = pasteEl.value.trim();

    // File takes priority over paste
    if (fileInput.files.length > 0) {
      rawText = await fileInput.files[0].text();
    }

    if (!rawText) return alert('Paste CSV text or upload a file first.');

    // Parse CSV
    const rows = rawText.split('\n').map(r => r.trim()).filter(Boolean);
    const headers = rows[0].toLowerCase().split(',').map(h => h.trim().replace(/^"|"$/g, ''));

    const col = (row, name) => {
      const idx = headers.indexOf(name);
      if (idx < 0) return '';
      return (row[idx] || '').trim().replace(/^"|"$/g, '');
    };

    const dataRows = rows.slice(1).map(r => {
      // Handle quoted commas
      const parts = [];
      let cur = '', inQ = false;
      for (const ch of r) {
        if (ch === '"') { inQ = !inQ; }
        else if (ch === ',' && !inQ) { parts.push(cur); cur = ''; }
        else cur += ch;
      }
      parts.push(cur);
      return parts.map(p => p.trim());
    }).filter(r => r.some(c => c));

    if (dataRows.length === 0) return alert('No data rows found. Make sure your CSV has a header row.');

    // Build stop list
    const stops = dataRows.map(r => ({
      name: col(r, 'name'),
      address: col(r, 'address'),
      route: col(r, 'route') || defaultRoute,
      signs: parseInt(col(r, 'signs')) || 1,
      notes: col(r, 'notes'),
      lat: null, lon: null,
      status: 'pending'  // pending | ok | geocode_failed | duplicate | added
    }));

    const invalid = stops.filter(s => !s.name || !s.address);
    if (invalid.length > 0) return alert(`${invalid.length} row(s) missing name or address. Fix CSV and try again.`);

    // Hand off to geocode + preview flow
    this.closeModal();
    await App.runImport(stops);
  },

  renderImportPreview(stops) {
    const statusIcon = s => {
      if (s.status === 'ok') return '<span style="color:var(--green)">✓</span>';
      if (s.status === 'geocode_failed') return '<span style="color:var(--red)">✗ no coords</span>';
      if (s.status === 'duplicate') return '<span style="color:var(--yellow)">⚠ dup</span>';
      if (s.status === 'added') return '<span style="color:var(--green)">✓ added</span>';
      return '<span style="color:var(--text-faint)">…</span>';
    };

    const rows = stops.map((s, i) => `
      <tr style="border-bottom:1px solid var(--border-light);font-size:11px">
        <td style="padding:4px 6px;color:var(--text-faint)">${i + 1}</td>
        <td style="padding:4px 6px;color:var(--text-bright);font-weight:600">${s.name}</td>
        <td style="padding:4px 6px;color:var(--text-dim)">${s.address}</td>
        <td style="padding:4px 6px;text-align:center">${s.route === 'auto' ? '<em style="color:var(--text-faint)">auto</em>' : s.route}</td>
        <td style="padding:4px 6px;text-align:center">${statusIcon(s)}</td>
      </tr>`).join('');

    const geocodeFailed = stops.filter(s => s.status === 'geocode_failed');
    const dupes = stops.filter(s => s.status === 'duplicate');
    const ok = stops.filter(s => s.status === 'ok');

    const warnings = [];
    if (geocodeFailed.length) warnings.push(`<span style="color:var(--red)">✗ ${geocodeFailed.length} address(es) couldn't be geocoded — they'll be skipped</span>`);
    if (dupes.length) warnings.push(`<span style="color:var(--yellow)">⚠ ${dupes.length} duplicate(s) — they'll be skipped</span>`);

    this.showModal('Import Preview', `
      <div style="margin-bottom:10px;font-size:11px;color:var(--text-dim)">
        <strong style="color:var(--green)">${ok.length}</strong> ready to add
        ${warnings.length ? ' · ' + warnings.join(' · ') : ''}
      </div>
      <div style="overflow-x:auto;max-height:300px;overflow-y:auto;border:1px solid var(--border);border-radius:4px">
        <table style="width:100%;border-collapse:collapse">
          <thead style="background:var(--bg-card);position:sticky;top:0">
            <tr style="font-size:10px;color:var(--text-dim)">
              <th style="padding:4px 6px">#</th>
              <th style="padding:4px 6px;text-align:left">Name</th>
              <th style="padding:4px 6px;text-align:left">Address</th>
              <th style="padding:4px 6px">Route</th>
              <th style="padding:4px 6px">Status</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      ${ok.length === 0 ? '<p style="margin-top:10px;font-size:11px;color:var(--red)">Nothing to import — fix errors and try again.</p>' : ''}
    `, ok.length > 0 ? async () => {
      await App.commitImport(stops.filter(s => s.status === 'ok'));
    } : null, ok.length > 0 ? `Add ${ok.length} Stop${ok.length > 1 ? 's' : ''}` : null);
  },

  // ─── Modal ───

  showModal(title, bodyHtml, onConfirm, confirmLabel = 'Confirm') {
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
          <button class="modal-close" onclick="UI.closeModal()">✕</button>
        </div>
        <div class="modal-body">${bodyHtml}</div>
        <div class="modal-footer">
          <button class="btn" onclick="UI.closeModal()">Cancel</button>
          ${onConfirm ? `<button class="btn btn-green" id="modal-confirm">${confirmLabel}</button>` : ''}
        </div>
      </div>
    `;
    modal.style.display = 'flex';
    if (onConfirm) document.getElementById('modal-confirm').addEventListener('click', onConfirm);
    // Close on backdrop click
    modal.addEventListener('click', (e) => { if (e.target === modal) this.closeModal(); });
  },

  closeModal() {
    const modal = document.getElementById('modal-overlay');
    if (modal) modal.style.display = 'none';
  },

  toggleMap() {
    const mapEl = document.getElementById('map');
    const btn = document.getElementById('map-toggle-btn');
    const isHidden = mapEl.classList.toggle('map-hidden');
    if (isHidden) {
      mapEl.style.setProperty('height', '0', 'important');
      mapEl.style.overflow = 'hidden';
      btn.textContent = '🗺 Show Map';
    } else {
      mapEl.style.removeProperty('height');
      mapEl.style.overflow = '';
      btn.textContent = '🗺 Map';
      // Give browser a frame to reflow before Leaflet measures
      requestAnimationFrame(() => {
        setTimeout(() => MapModule.map.invalidateSize(), 50);
      });
    }
  },

  // ─── Presence Avatars ───

  renderPresence(users) {
    const bar = document.getElementById('presence-bar');
    if (!bar) return;

    if (!users || users.length === 0) {
      bar.innerHTML = '';
      return;
    }

    const mySession = App._sessionId;
    const avatarColors = [
      '#58a6ff','#3fb950','#f778ba','#d29922',
      '#bc8cff','#39d2c0','#f0883e','#f85149'
    ];

    // Stable color per session (hash)
    function colorFor(sessionId) {
      let h = 0;
      for (let i = 0; i < sessionId.length; i++) h = (h * 31 + sessionId.charCodeAt(i)) >>> 0;
      return avatarColors[h % avatarColors.length];
    }

    function initials(name) {
      if (!name || name === 'Unknown') return '?';
      const parts = name.trim().split(/\s+/);
      if (parts.length === 1) return parts[0][0].toUpperCase();
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    function timeAgo(isoStr) {
      const secs = Math.round((Date.now() - new Date(isoStr).getTime()) / 1000);
      if (secs < 10) return 'just now';
      if (secs < 60) return `${secs}s ago`;
      return `${Math.round(secs / 60)}m ago`;
    }

    const chips = users.map(u => {
      const isMe = u.sessionId === mySession;
      const color = isMe ? 'var(--green)' : colorFor(u.sessionId);
      const border = isMe ? '2px solid var(--green-dark)' : '2px solid transparent';
      const label = initials(u.name);
      const title = `${u.name}${isMe ? ' (you)' : ''} · ${timeAgo(u.last_seen)}`;
      return `<div class="presence-avatar" style="background:${color};border:${border}" title="${title}">${label}</div>`;
    }).join('');

    bar.innerHTML = `
      <div class="presence-wrap">
        <span class="presence-label">Now viewing:</span>
        ${chips}
      </div>
    `;
  },

  // ─── Toast ───

  showToast(msg, type = 'info') {
    // Remove existing toasts to prevent stacking
    document.querySelectorAll('.toast').forEach(t => t.remove());
    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3000);
  }
};
