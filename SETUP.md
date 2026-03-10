# Chaka Yard Sign Routes — Setup Guide

## Files Overview

| File | Purpose |
|------|---------|
| `index.html` | Main app shell |
| `style.css` | All styling |
| `config.js` | Your Apps Script URL + admin password |
| `sheets.js` | Google Sheets API + Nominatim geocoding |
| `map.js` | Leaflet map, markers, OSRM routing |
| `ui.js` | Sidebar, forms, delivery checkboxes, admin controls |
| `app.js` | State management, data flow, actions |
| `apps_script.js` | Google Apps Script code (paste into your Sheet) |
| `import.html` | One-time data import tool |

## Setup Steps (10 minutes)

### 1. Create Google Sheet
- Go to [sheets.google.com](https://sheets.google.com)
- Create a new blank spreadsheet
- Name it "Chaka Yard Signs" (or whatever you want)

### 2. Add the Apps Script
- In the Sheet, go to **Extensions → Apps Script**
- Delete any default code in the editor
- Open `apps_script.js` and copy the entire contents
- Paste it into the Apps Script editor
- Click **Save** (disk icon)

### 3. Deploy the Apps Script
- Click **Deploy → New deployment**
- Click the gear icon, select **Web app**
- Set **Execute as**: Me
- Set **Who has access**: Anyone
- Click **Deploy**
- **Authorize** when prompted (click through the "unsafe" warnings — it's your own script)
- **Copy the Web app URL** — you'll need this

### 4. Configure the App
- Open `config.js`
- Replace `YOUR_APPS_SCRIPT_URL_HERE` with the URL you copied
- Change the admin password if you want (default: `chaka2026`)

### 5. Import Existing Data
- Open `import.html` in your browser (locally is fine)
- Paste the Apps Script URL
- Click **Import**
- Check your Google Sheet — it should now have "stops" and "routes" tabs with all 56 stops

### 6. Deploy to GitHub Pages
- Push all files to your `Sign_Routing` repo
- GitHub Pages will serve it at `https://brentbillington-ship-it.github.io/Sign_Routing/`

### 7. Test
- Open the URL
- You should see the map with all routes
- Click the ⚙ Admin button, enter the password
- Try adding an address, marking delivered, etc.

## How It Works

- **Google Sheet** is the database — two tabs: `stops` and `routes`
- **Apps Script** is the API — handles reads and writes
- **The HTML app** on GitHub Pages talks to the API
- All changes are immediate — when someone marks delivered, it writes to the Sheet
- You can always view/edit the Sheet directly as a backup

## Admin Features (password required)

- **+ Add Address** — geocodes via Nominatim, auto-assigns to nearest route
- **+ New Route** — creates a new route with auto color
- **⚙ Edit Route** — change color, assign volunteer name
- **↔ Reassign** — move a stop to a different route
- **↕ Reorder** — reorder stops (use RouteXL to optimize, type new order)
- **✕ Remove** — delete a stop
- **✕ Delete Route** — remove empty routes
- **⤓ Export CSV** — download current state
- **↻ Optimize All** — try OSRM optimization

## Volunteer Features (no password)

- View map and route list
- Filter to "My Route" via dropdown
- Toggle delivered/undelivered visibility
- Mark stops delivered (with sign count confirmation)
- Tap Google Maps for navigation

## Troubleshooting

**App shows "Failed to load data"**
→ Check that config.js has the correct Apps Script URL

**Apps Script returns errors**
→ Make sure you deployed as Web app with "Anyone" access
→ If you updated the script, you need to create a **New deployment** (not just save)

**Geocoding fails**
→ Nominatim might not find new streets. Paste lat/lon manually from Google Maps (right-click → coordinates)
