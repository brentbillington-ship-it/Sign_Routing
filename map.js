// ─── Map Module ───

const MapModule = {
  map: null,
  routeGroups: {},
  routePolylines: {},
  stopMarkers: {},  // keyed by stop id

  init() {
    this.map = L.map('map', { zoomControl: true }).setView(CONFIG.MAP_CENTER, CONFIG.MAP_ZOOM);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '\u00a9 OSM', maxZoom: 19
    }).addTo(this.map);
    // Let flexbox settle before Leaflet measures the container
    setTimeout(() => this.map.invalidateSize(), 100);
  },

  clearAll() {
    Object.values(this.routeGroups).forEach(g => g.remove());
    this.routeGroups = {};
    this.routePolylines = {};
    this.stopMarkers = {};
  },

  renderRoutes(routes, options = {}) {
    this.clearAll();
    routes.forEach((route, ri) => {
      this.renderRoute(route, ri, options);
    });
    this.addLegend(routes);
  },

  renderRoute(route, index, options = {}) {
    const color = route.color || CONFIG.ROUTE_COLORS[index % CONFIG.ROUTE_COLORS.length];
    const group = L.layerGroup().addTo(this.map);
    this.routeGroups[route.letter] = group;

    // Filter for visibility
    const stops = options.showDelivered === false
      ? route.stops.filter(s => !s.delivered)
      : route.stops;

    if (stops.length === 0) return;

    // Dashed placeholder line
    const latlngs = stops.map(s => [s.lat, s.lon]);
    const pl = L.polyline(latlngs, { color, weight: 3, opacity: 0.4, dashArray: '6,8' }).addTo(group);
    this.routePolylines[route.letter] = pl;

    // Markers
    stops.forEach((stop, si) => {
      const delivered = stop.delivered;
      const fillColor = delivered ? '#2d333b' : color;
      const borderColor = delivered ? '#3fb950' : '#0d1117';
      const opacity = delivered ? 0.5 : 0.9;

      const cm = L.circleMarker([stop.lat, stop.lon], {
        radius: delivered ? 7 : 8,
        fillColor, color: borderColor,
        weight: delivered ? 3 : 2,
        opacity: 1, fillOpacity: opacity
      }).addTo(group);

      // Popup
      let popupHtml = `<div style="font-family:'DM Sans',sans-serif;min-width:180px">`;
      popupHtml += `<div style="font-size:12px;font-weight:700;color:${color};margin-bottom:4px">Route ${route.letter} \u00b7 #${si + 1}</div>`;
      popupHtml += `<div style="font-size:14px;font-weight:700;color:#1a1a1a">${stop.name}</div>`;
      popupHtml += `<div style="font-size:12px;color:#555;margin:2px 0 6px">${stop.address}</div>`;
      if (stop.signs > 1) popupHtml += `<div style="font-size:11px;color:#7c3aed;font-weight:600">${stop.signs} signs</div>`;
      if (stop.notes) popupHtml += `<div style="font-size:11px;color:#b45309;font-weight:600;margin-top:2px">${stop.notes}</div>`;
      if (delivered) {
        popupHtml += `<div style="margin-top:6px;padding:4px 8px;background:#2ea043;color:#fff;border-radius:4px;font-size:11px;font-weight:600;display:inline-block">\u2713 Delivered</div>`;
        if (stop.delivered_date) {
          const d = new Date(stop.delivered_date);
          popupHtml += `<div style="font-size:10px;color:#888;margin-top:2px">${d.toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })} CT</div>`;
        }
        if (stop.delivered_by) popupHtml += `<div style="font-size:10px;color:#888">by ${stop.delivered_by}</div>`;
      }
      popupHtml += `</div>`;
      cm.bindPopup(popupHtml);

      // Number label
      const label = delivered ? '\u2713' : (si + 1);
      const labelColor = delivered ? '#3fb950' : '#fff';
      const numMarker = L.marker([stop.lat, stop.lon], {
        icon: L.divIcon({
          html: `<div style="width:16px;height:16px;display:flex;align-items:center;justify-content:center;font-size:${delivered ? '11px' : '9px'};font-weight:800;color:${labelColor}">${label}</div>`,
          className: '', iconSize: [16, 16], iconAnchor: [8, 8]
        }), interactive: false
      }).addTo(group);

      this.stopMarkers[stop.id] = { circle: cm, number: numMarker };
    });
  },

  updateStopMarker(stop, route, index) {
    const markers = this.stopMarkers[stop.id];
    if (!markers) return;
    const color = route.color || '#58a6ff';
    const delivered = stop.delivered;
    const group = this.routeGroups[route.letter];
    if (!group) return;

    // Update circle style
    markers.circle.setStyle({
      fillColor: delivered ? '#2d333b' : color,
      color: delivered ? '#3fb950' : '#0d1117',
      weight: delivered ? 3 : 2,
      fillOpacity: delivered ? 0.5 : 0.9,
      radius: delivered ? 7 : 8
    });

    // Update number label
    group.removeLayer(markers.number);
    const label = delivered ? '\u2713' : (index + 1);
    const labelColor = delivered ? '#3fb950' : '#fff';
    markers.number = L.marker([stop.lat, stop.lon], {
      icon: L.divIcon({
        html: `<div style="width:16px;height:16px;display:flex;align-items:center;justify-content:center;font-size:${delivered ? '11px' : '9px'};font-weight:800;color:${labelColor}">${label}</div>`,
        className: '', iconSize: [16, 16], iconAnchor: [8, 8]
      }), interactive: false
    }).addTo(group);
  },

  focusRoute(route) {
    const pl = this.routePolylines[route.letter];
    if (pl) {
      try { this.map.fitBounds(pl.getBounds(), { padding: [40, 40] }); } catch (e) { }
    } else if (route.stops.length) {
      this.map.fitBounds(L.latLngBounds(route.stops.map(s => [s.lat, s.lon])), { padding: [40, 40] });
    }
  },

  addLegend(routes) {
    // Remove existing legend
    if (this._legend) this._legend.remove();
    // Don't show legend on mobile — takes too much space
    if (window.innerWidth <= 768) return;
    const legend = L.control({ position: 'bottomleft' });
    legend.onAdd = () => {
      const div = L.DomUtil.create('div');
      div.style.cssText = 'background:rgba(13,17,23,.92);border:1px solid #30363d;border-radius:6px;padding:10px 14px;font-size:11px;font-family:"DM Sans",sans-serif;color:#c9d1d9;margin-bottom:8px;margin-left:8px';
      div.innerHTML = routes.map((r, i) => {
        const c = r.color || CONFIG.ROUTE_COLORS[i % CONFIG.ROUTE_COLORS.length];
        const delivered = r.stops.filter(s => s.delivered).length;
        const total = r.stops.length;
        return `<div style="display:flex;align-items:center;gap:7px;padding:2px 0"><div style="width:12px;height:12px;border-radius:50%;background:${c}"></div>Route ${r.letter} (${delivered}/${total})</div>`;
      }).join('');
      return div;
    };
    legend.addTo(this.map);
    this._legend = legend;
  },

  // OSRM trip routing
  async optimizeRoute(route) {
    if (route.stops.length < 3) return null;
    const coords = route.stops.map(s => s.lon + ',' + s.lat).join(';');
    const url = 'https://router.project-osrm.org/trip/v1/driving/' + coords + '?overview=full&geometries=geojson&roundtrip=false&source=any&destination=any';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const resp = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      const data = await resp.json();
      if (data.code === 'Ok' && data.trips && data.trips[0]) {
        const trip = data.trips[0];
        return {
          coords: trip.geometry.coordinates.map(c => [c[1], c[0]]),
          distance_mi: (trip.distance / 1609.34).toFixed(1),
          duration_min: Math.round(trip.duration / 60),
          order: data.waypoints.map(wp => wp.waypoint_index)
        };
      }
    } catch (e) { clearTimeout(timeout); }
    return null;
  },

  drawOptimizedPolyline(route, coords) {
    const color = route.color || '#58a6ff';
    const group = this.routeGroups[route.letter];
    if (!group) return;
    // Remove old polyline
    if (this.routePolylines[route.letter]) {
      group.removeLayer(this.routePolylines[route.letter]);
    }
    this.routePolylines[route.letter] = L.polyline(coords, {
      color, weight: 4, opacity: 0.75
    }).addTo(group);
  }
};
