/* ── WWU Basic Needs Hub · Grocery Map · app.js ─────────────────────── */
'use strict';

const WWU = { lat: 48.7330, lng: -122.4876, zoom: 13 };
const DATA_URL = './locations.json';

/* ── Type → emoji ───────────────────────────────────────────────────── */
const TYPE_ICON = {
  supermarket: '🛒',
  discount:    '💰',
  specialty:   '🏪',
  'co-op':     '🌱',
};

/* ── Active filters ─────────────────────────────────────────────────── */
let activeFilters = new Set();
let allLocations  = [];
let markerMap     = {};   // id → L.marker

/* ── Map init ───────────────────────────────────────────────────────── */
const map = L.map('map', {
  center: [WWU.lat, WWU.lng],
  zoom:   WWU.zoom,
  zoomControl: false,
});

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
  subdomains: 'abcd',
  maxZoom: 19,
}).addTo(map);

L.control.zoom({ position: 'bottomright' }).addTo(map);

const clusterGroup = L.markerClusterGroup({
  showCoverageOnHover: false,
  maxClusterRadius: 50,
  iconCreateFunction(cluster) {
    const count = cluster.getChildCount();
    const size  = count < 5 ? 'small' : count < 10 ? 'medium' : 'large';
    return L.divIcon({
      html: `<div><span>${count}</span></div>`,
      className: `marker-cluster marker-cluster-${size}`,
      iconSize: L.point(40, 40),
    });
  },
});
map.addLayer(clusterGroup);

/* ── WWU button ─────────────────────────────────────────────────────── */
document.getElementById('btn-wwu').addEventListener('click', () => {
  map.flyTo([WWU.lat, WWU.lng], WWU.zoom, { duration: 1.2 });
});

/* ── Build custom icon ──────────────────────────────────────────────── */
function makeIcon(type) {
  const emoji = TYPE_ICON[type] || '🏪';
  const cls   = `store-marker type-${CSS.escape(type)}`;
  return L.divIcon({
    html: `<div class="${cls}" style="width:32px;height:32px;"><span>${emoji}</span></div>`,
    className: '',
    iconSize:  [32, 32],
    iconAnchor:[16, 32],
    popupAnchor:[0, -34],
  });
}

/* ── Build popup HTML ───────────────────────────────────────────────── */
function buildPopup(loc) {
  const ebtLabel = loc.ebt === true    ? '<span class="popup-ebt yes">✓ EBT Accepted</span>'
                 : loc.ebt === 'unknown'? '<span class="popup-ebt unknown">EBT: Unknown</span>'
                 : '';

  const tagsHtml = (loc.tags || [])
    .map(t => `<span class="popup-tag">${t.replace(/-/g,' ')}</span>`)
    .join('');

  const links = [];
  if (loc.website)   links.push(`<a class="popup-link" href="${loc.website}" target="_blank" rel="noopener">🌐 Website</a>`);
  if (loc.hours_url) links.push(`<a class="popup-link hours" href="${loc.hours_url}" target="_blank" rel="noopener">🕐 Hours</a>`);

  return `
    <div class="popup-inner">
      <div class="popup-header">
        <span class="popup-name">${loc.name}</span>
        <span class="popup-type">${loc.type}</span>
      </div>
      <p class="popup-address">${loc.address}</p>
      <div class="popup-meta">
        <span class="popup-price">${loc.price_tier}</span>
        ${ebtLabel}
      </div>
      ${tagsHtml ? `<div class="popup-tags">${tagsHtml}</div>` : ''}
      ${links.length ? `<div class="popup-links">${links.join('')}</div>` : ''}
    </div>`;
}

/* ── Render markers ─────────────────────────────────────────────────── */
function renderMarkers(locations) {
  clusterGroup.clearLayers();
  markerMap = {};

  locations.forEach(loc => {
    const marker = L.marker([loc.latitude, loc.longitude], { icon: makeIcon(loc.type) });
    marker.bindPopup(buildPopup(loc), { maxWidth: 300 });
    marker.options.locData = loc;
    markerMap[loc.id] = marker;
    clusterGroup.addLayer(marker);
  });

  document.getElementById('store-count').textContent =
    `${locations.length} store${locations.length !== 1 ? 's' : ''}`;
}

/* ── Filter logic ───────────────────────────────────────────────────── */
function applyFilters() {
  if (activeFilters.size === 0) {
    renderMarkers(allLocations);
    return;
  }

  const filtered = allLocations.filter(loc => {
    for (const f of activeFilters) {
      if (f === 'ebt') {
        if (loc.ebt !== true) return false;
      } else if (f === 'discount') {
        if (!loc.tags.includes('discount-pricing') && loc.price_tier !== '$') return false;
      } else {
        // type filter
        if (loc.type !== f) return false;
      }
    }
    return true;
  });

  renderMarkers(filtered);
}

document.querySelectorAll('.filter-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const f = chip.dataset.filter;
    if (activeFilters.has(f)) {
      activeFilters.delete(f);
      chip.classList.remove('active');
      chip.setAttribute('aria-pressed', 'false');
    } else {
      activeFilters.add(f);
      chip.classList.add('active');
      chip.setAttribute('aria-pressed', 'true');
    }
    applyFilters();
  });
});

/* ── Load data ──────────────────────────────────────────────────────── */
fetch(DATA_URL)
  .then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  })
  .then(data => {
    allLocations = data;
    renderMarkers(allLocations);
  })
  .catch(err => {
    console.error('Failed to load locations.json:', err);
    document.getElementById('store-count').textContent = 'Error loading data';
  });
