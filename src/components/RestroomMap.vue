<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";
import L from "leaflet";
import { fetchRestroomsByBounds, createRestroom, submitRating } from "../api/restroomsApi";

const mapEl = ref(null);
let map = null;
let markersLayer = null;
let pendingMarker = null;

const restrooms = ref([]);
const markerMap = new Map(); // restroomId → L.marker

const addMode = ref(false);
const formOpen = ref(false);
const formError = ref("");

const newRestroom = ref({
  name: "",
  wheelchair: false,
  genderNeutral: false,
  notes: "",
  lat: null,
  lng: null,
});

// ── localStorage rating dedup ─────────────────────────────────────────────
const LS_KEY = "ratedRestrooms";

function getRatedRestrooms() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function markRated(id, stars) {
  const current = getRatedRestrooms();
  current[id] = stars;
  localStorage.setItem(LS_KEY, JSON.stringify(current));
}

function hasRated(id) {
  return id in getRatedRestrooms();
}

// ── Popup HTML builder ────────────────────────────────────────────────────
function buildPopupHtml(r) {
  const badges = [
    r.wheelchair
      ? `<span class="popup-badge popup-badge--access">&#9851; Accessible</span>`
      : "",
    r.genderNeutral
      ? `<span class="popup-badge popup-badge--neutral">&#x26A7; Gender-neutral</span>`
      : "",
  ]
    .filter(Boolean)
    .join("");

  const rated = getRatedRestrooms();
  const userStars = rated[r.id] ?? 0;
  const alreadyRated = r.id in rated;

  let starsHtml = "";
  if (!alreadyRated) {
    for (let i = 1; i <= 5; i++) {
      starsHtml += `<span class="popup-star popup-star--interactive" data-action="rate" data-restroom-id="${escapeHtml(r.id)}" data-stars="${i}">★</span>`;
    }
  } else {
    for (let i = 1; i <= 5; i++) {
      const filled = i <= userStars;
      starsHtml += `<span class="popup-star${filled ? " popup-star--filled" : ""}">★</span>`;
    }
  }

  const avgRating = r.avgRating ?? 0;
  const ratingCount = r.ratingCount ?? 0;
  const ratingLabel = ratingCount > 0
    ? `${avgRating.toFixed(1)} (${ratingCount})`
    : "No ratings yet";

  return `<div class="popup-content">
    <div class="popup-name">${escapeHtml(r.name || "Public Restroom")}</div>
    ${badges ? `<div class="popup-badges">${badges}</div>` : ""}
    ${r.notes ? `<div class="popup-notes">${escapeHtml(r.notes)}</div>` : ""}
    <div class="popup-rating">
      <div class="popup-stars">${starsHtml}</div>
      <span class="popup-rating-label">${escapeHtml(ratingLabel)}</span>
    </div>
  </div>`;
}

// ── Marker rendering ──────────────────────────────────────────────────────
function renderMarkers() {
  if (!markersLayer) return;
  markersLayer.clearLayers();
  markerMap.clear();

  for (const r of restrooms.value) {
    const marker = L.marker([r.lat, r.lng]);
    marker.bindPopup(buildPopupHtml(r), { closeButton: false, className: "ios-popup" });
    marker.addTo(markersLayer);
    markerMap.set(r.id, marker);
  }
}

// ── Popup click handler (event delegation for rating stars) ───────────────
async function onPopupOpen(e) {
  e.popup.getElement()?.addEventListener("click", async (evt) => {
    const star = evt.target.closest("[data-action='rate']");
    if (!star || hasRated(star.dataset.restroomId)) return;

    const restroomId = star.dataset.restroomId;
    const stars = Number(star.dataset.stars);

    markRated(restroomId, stars); // optimistic localStorage write

    try {
      const { avgRating, ratingCount } = await submitRating(restroomId, stars);
      const restroom = restrooms.value.find((r) => r.id === restroomId);
      if (restroom) {
        restroom.avgRating = avgRating;
        restroom.ratingCount = ratingCount;
      }
      markerMap.get(restroomId)?.setPopupContent(buildPopupHtml(restroom));
    } catch {
      // rollback localStorage on failure
      const c = getRatedRestrooms();
      delete c[restroomId];
      localStorage.setItem(LS_KEY, JSON.stringify(c));
    }
  });
}

// ── Add-mode helpers ──────────────────────────────────────────────────────
function toggleAddMode() {
  addMode.value = !addMode.value;
  if (!addMode.value) {
    clearPending();
  }
  if (map) {
    map.getContainer().style.cursor = addMode.value ? "crosshair" : "";
  }
}

function clearPending() {
  if (pendingMarker) {
    pendingMarker.remove();
    pendingMarker = null;
  }
  formOpen.value = false;
  formError.value = "";
  newRestroom.value = {
    name: "",
    wheelchair: false,
    genderNeutral: false,
    notes: "",
    lat: null,
    lng: null,
  };
}

function onMapClick(e) {
  if (!addMode.value) return;

  const { lat, lng } = e.latlng;

  if (pendingMarker) pendingMarker.remove();
  pendingMarker = L.marker([lat, lng]).addTo(map);

  newRestroom.value.lat = lat;
  newRestroom.value.lng = lng;
  formError.value = "";
  formOpen.value = true;
}

async function loadRestrooms() {
  if (!map) return;
  restrooms.value = await fetchRestroomsByBounds(map.getBounds());
  renderMarkers();
}

async function saveNewRestroom() {
  if (newRestroom.value.lat == null || newRestroom.value.lng == null) return;
  formError.value = "";

  try {
    await createRestroom({
      name: newRestroom.value.name?.trim() || "Public Restroom",
      lat: newRestroom.value.lat,
      lng: newRestroom.value.lng,
      wheelchair: !!newRestroom.value.wheelchair,
      genderNeutral: !!newRestroom.value.genderNeutral,
      notes: newRestroom.value.notes?.trim() || "",
    });

    addMode.value = false;
    if (map) map.getContainer().style.cursor = "";
    clearPending();
    await loadRestrooms();
  } catch (e) {
    formError.value = e?.message || "Failed to save restroom. Please try again.";
  }
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

onMounted(async () => {
  map = L.map(mapEl.value, {
    center: [47.6062, -122.3321],
    zoom: 13,
  });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 19,
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);

  await loadRestrooms();

  map.on("click", onMapClick);
  map.on("moveend", loadRestrooms);
  map.on("popupopen", onPopupOpen);
});

onBeforeUnmount(() => {
  if (!map) return;
  map.off("click", onMapClick);
  map.off("moveend", loadRestrooms);
  map.off("popupopen", onPopupOpen);
  map.remove();
  map = null;
});
</script>

<template>
  <!-- Desktop toolbar (hidden on mobile; FAB is used instead) -->
  <div class="toolbar">
    <button
      class="btn-add"
      :class="{ 'btn-add--cancel': addMode }"
      @click="toggleAddMode"
    >
      <span class="btn-icon" aria-hidden="true">{{ addMode ? "✕" : "＋" }}</span>
      <span class="btn-label">{{ addMode ? "Cancel" : "Add Restroom" }}</span>
    </button>
    <span v-if="addMode" class="hint">
      <span class="hint-icon" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="7" fill="currentColor" fill-opacity="0.15"/>
          <path d="M7 6v4M7 4.5v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </span>
      Tap on the map to drop a pin
    </span>
    <span v-else class="hint">Browse restrooms near you</span>
  </div>

  <div class="layout">
    <!-- Map -->
    <div
      ref="mapEl"
      class="map"
      :class="{ 'map--add-mode': addMode }"
    ></div>

    <!-- Desktop: right sidebar panel; Mobile: bottom sheet -->
    <transition name="panel-slide">
      <div v-if="formOpen" class="panel">
        <!-- Drag handle (mobile) -->
        <div class="grabber" aria-hidden="true"></div>

        <div class="panel-header">
          <h3 class="panel-title">Add Restroom</h3>
          <button class="panel-close" @click="clearPending" aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <div v-if="formError" class="error-banner">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 5v4M8 11v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5"/>
          </svg>
          {{ formError }}
        </div>

        <!-- iOS inset-grouped form -->
        <div class="form-section">
          <div class="form-row">
            <input
              v-model="newRestroom.name"
              class="form-input"
              placeholder="Name (optional)"
              type="text"
              autocomplete="off"
            />
          </div>
        </div>

        <div class="form-section">
          <div class="form-row form-row--toggle">
            <span class="form-row-label">Wheelchair accessible</span>
            <label class="toggle-label">
              <input type="checkbox" v-model="newRestroom.wheelchair" class="toggle-input" />
              <span class="toggle-track"><span class="toggle-thumb"></span></span>
            </label>
          </div>
          <div class="form-separator"></div>
          <div class="form-row form-row--toggle">
            <span class="form-row-label">Gender-neutral</span>
            <label class="toggle-label">
              <input type="checkbox" v-model="newRestroom.genderNeutral" class="toggle-input" />
              <span class="toggle-track"><span class="toggle-thumb"></span></span>
            </label>
          </div>
        </div>

        <div class="form-section">
          <div class="form-row">
            <textarea
              v-model="newRestroom.notes"
              class="form-input form-textarea"
              rows="3"
              placeholder="Notes (e.g. inside building lobby)"
            />
          </div>
        </div>

        <div class="coords-chip">
          {{ newRestroom.lat?.toFixed(5) }}, {{ newRestroom.lng?.toFixed(5) }}
        </div>

        <div class="actions">
          <button class="btn-save" @click="saveNewRestroom">Save Restroom</button>
          <button class="btn-discard" @click="clearPending">Discard</button>
        </div>
      </div>
    </transition>
  </div>

  <!-- FAB (mobile only) -->
  <button
    class="fab"
    :class="{ 'fab--cancel': addMode }"
    @click="toggleAddMode"
    :aria-label="addMode ? 'Cancel adding restroom' : 'Add restroom'"
  >
    <span class="fab-icon" aria-hidden="true">{{ addMode ? "✕" : "＋" }}</span>
  </button>

  <!-- Add-mode hint toast (mobile) -->
  <transition name="toast-slide">
    <div v-if="addMode && !formOpen" class="hint-toast">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <circle cx="7" cy="7" r="7" fill="white" fill-opacity="0.25"/>
        <path d="M7 6v4M7 4.5v.5" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
      Tap the map to drop a pin
    </div>
  </transition>
</template>

<style scoped>
/* ── Desktop Toolbar ─────────────────────────── */
.toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  margin: 16px 0;
  flex-wrap: wrap;
}

.btn-add {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 10px 20px;
  border-radius: var(--radius-pill);
  background: var(--color-primary);
  color: #fff;
  font-weight: 600;
  font-size: 0.9375rem;
  white-space: nowrap;
  box-shadow: var(--shadow-sm);
  transition: background 0.15s, box-shadow 0.15s, transform 0.1s var(--spring);
}
.btn-add:hover {
  background: var(--color-primary-hover);
  box-shadow: var(--shadow-md);
}
.btn-add:active {
  transform: scale(0.96);
  opacity: 1;
}
.btn-add--cancel {
  background: var(--color-danger);
}
.btn-add--cancel:hover {
  background: #e0281e;
}

.btn-icon {
  font-size: 1.1rem;
  line-height: 1;
  font-weight: 300;
}

.hint {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.875rem;
  color: var(--color-text-secondary);
}
.hint-icon {
  display: flex;
  align-items: center;
  color: var(--color-primary);
  flex-shrink: 0;
}

/* ── Layout ──────────────────────────────────── */
.layout {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 16px;
  align-items: start;
}

/* ── Map ─────────────────────────────────────── */
.map {
  height: calc(100vh - 140px);
  min-height: 300px;
  width: 100%;
  border-radius: var(--radius-lg);
  overflow: hidden;
  border: 2px solid transparent;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.map--add-mode {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 4px rgba(0, 122, 255, 0.15);
}

/* ── Desktop Panel / Sidebar ─────────────────── */
.panel {
  border-radius: var(--radius-xl);
  padding: 20px;
  background: var(--color-surface);
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  gap: 12px;
  position: sticky;
  top: 80px;
}

.grabber {
  display: none; /* visible only on mobile */
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}
.panel-title {
  font-size: 1.0625rem;
  font-weight: 700;
  color: var(--color-text);
}
.panel-close {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: rgba(120, 120, 128, 0.12);
  color: var(--color-text-secondary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: background 0.15s;
}
.panel-close:hover {
  background: rgba(120, 120, 128, 0.22);
}

/* ── Error banner ────────────────────────────── */
.error-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: var(--radius-md);
  background: var(--color-error-bg);
  border: 1px solid var(--color-error-border);
  color: var(--color-error);
  font-size: 0.875rem;
  font-weight: 500;
}

/* ── iOS Inset-Grouped Form ──────────────────── */
.form-section {
  background: var(--color-bg);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.form-row {
  padding: 0 16px;
}

.form-row--toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  min-height: 44px;
}

.form-row-label {
  font-size: 0.9375rem;
  color: var(--color-text);
}

.form-separator {
  height: 1px;
  background: var(--color-separator);
  margin-left: 16px;
}

.form-input {
  width: 100%;
  padding: 13px 0;
  border: none;
  background: transparent;
  color: var(--color-text);
  font-size: 0.9375rem;
  outline: none;
  resize: none;
}
.form-input::placeholder {
  color: var(--color-text-muted);
}
.form-textarea {
  padding-top: 13px;
  padding-bottom: 13px;
  resize: none;
}

/* ── iOS Toggle Switches ─────────────────────── */
.toggle-label {
  display: inline-flex;
  cursor: pointer;
  user-select: none;
  flex-shrink: 0;
}
.toggle-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
  pointer-events: none;
}
.toggle-track {
  position: relative;
  width: 51px;
  height: 31px;
  border-radius: var(--radius-pill);
  background: rgba(120, 120, 128, 0.32);
  flex-shrink: 0;
  transition: background 0.25s var(--spring);
}
.toggle-input:checked + .toggle-track {
  background: var(--color-success);
}
.toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 27px;
  height: 27px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.30);
  transition: transform 0.25s var(--spring);
}
.toggle-input:checked + .toggle-track .toggle-thumb {
  transform: translateX(20px);
}

/* ── Coords chip ─────────────────────────────── */
.coords-chip {
  font-family: ui-monospace, "Cascadia Code", "SF Mono", "Menlo", monospace;
  font-size: 0.75rem;
  background: var(--color-bg);
  border-radius: var(--radius-pill);
  padding: 5px 12px;
  color: var(--color-text-muted);
  text-align: center;
  align-self: center;
}

/* ── Action buttons ──────────────────────────── */
.actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px;
}
.btn-save {
  width: 100%;
  height: 50px;
  border-radius: 14px;
  background: var(--color-primary);
  color: #fff;
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  transition: background 0.15s, transform 0.1s var(--spring);
}
.btn-save:hover {
  background: var(--color-primary-hover);
}
.btn-save:active {
  transform: scale(0.97);
  opacity: 1;
}
.btn-discard {
  width: 100%;
  padding: 12px;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 0.9375rem;
  font-weight: 400;
  transition: color 0.15s;
}
.btn-discard:hover {
  color: var(--color-text);
}

/* ── Panel slide transition (desktop: fade+rise) */
.panel-slide-enter-active,
.panel-slide-leave-active {
  transition: opacity 0.22s var(--ease-out), transform 0.22s var(--ease-out);
}
.panel-slide-enter-from,
.panel-slide-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

/* ── FAB (hidden on desktop) ─────────────────── */
.fab {
  display: none;
}

/* ── Hint toast (hidden on desktop) ─────────── */
.hint-toast {
  display: none;
}

/* ── Leaflet popup styles ────────────────────── */
:global(.ios-popup .leaflet-popup-content-wrapper) {
  border-radius: 12px;
  padding: 0;
  box-shadow: var(--shadow-lg);
  border: none;
}
:global(.ios-popup .leaflet-popup-content) {
  margin: 0;
  padding: 12px 14px;
}
:global(.ios-popup .leaflet-popup-tip-container) {
  display: none;
}
:global(.popup-content) {
  font-family: system-ui, -apple-system, sans-serif;
  min-width: 150px;
}
:global(.popup-name) {
  font-weight: 600;
  font-size: 0.9375rem;
  margin-bottom: 6px;
  color: #000;
}
:global(.popup-badges) {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 4px;
}
:global(.popup-badge) {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.6875rem;
  font-weight: 600;
}
:global(.popup-badge--access) {
  background: rgba(0, 122, 255, 0.12);
  color: #007aff;
}
:global(.popup-badge--neutral) {
  background: rgba(175, 82, 222, 0.12);
  color: #af52de;
}
:global(.popup-notes) {
  font-size: 0.8125rem;
  color: rgba(0, 0, 0, 0.55);
  margin-top: 4px;
}

/* ── Rating styles ───────────────────────────── */
:global(.popup-rating)  { display: flex; align-items: center; gap: 6px; margin-top: 6px; }
:global(.popup-stars)   { display: flex; gap: 2px; line-height: 1; }
:global(.popup-star)    { font-size: 1.05rem; color: rgba(0,0,0,0.20); user-select: none; transition: color 0.1s, transform 0.1s; }
:global(.popup-star--filled)       { color: #ff9500; }
:global(.popup-star--interactive)  { cursor: pointer; }
:global(.popup-star--interactive:hover) { color: #ff9500; transform: scale(1.15); }
:global(.popup-rating-label) { font-size: 0.75rem; color: rgba(0,0,0,0.45); }

/* ── Mobile (≤ 768px) ────────────────────────── */
@media (max-width: 768px) {
  /* Hide desktop toolbar, show FAB instead */
  .toolbar {
    display: none;
  }

  /* FAB */
  .fab {
    display: flex;
    align-items: center;
    justify-content: center;
    position: fixed;
    bottom: calc(24px + var(--safe-bottom));
    right: 20px;
    z-index: 999;
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: var(--color-primary);
    color: #fff;
    box-shadow: var(--shadow-lg);
    transition: background 0.15s, transform 0.2s var(--spring);
  }
  .fab:active {
    transform: scale(0.90);
    opacity: 1;
  }
  .fab--cancel {
    background: var(--color-danger);
  }
  .fab-icon {
    font-size: 2rem;
    line-height: 1;
    font-weight: 300;
  }

  /* Hint toast */
  .hint-toast {
    display: flex;
    align-items: center;
    gap: 7px;
    position: fixed;
    bottom: calc(96px + var(--safe-bottom));
    left: 50%;
    transform: translateX(-50%);
    z-index: 998;
    background: rgba(0, 0, 0, 0.72);
    color: #fff;
    font-size: 0.875rem;
    font-weight: 500;
    padding: 9px 18px;
    border-radius: var(--radius-pill);
    white-space: nowrap;
    pointer-events: none;
    backdrop-filter: var(--blur);
    -webkit-backdrop-filter: var(--blur);
  }
  .toast-slide-enter-active,
  .toast-slide-leave-active {
    transition: opacity 0.2s, transform 0.25s var(--spring);
  }
  .toast-slide-enter-from,
  .toast-slide-leave-to {
    opacity: 0;
    transform: translateX(-50%) translateY(6px);
  }

  /* Layout */
  .layout {
    grid-template-columns: 1fr;
  }

  /* Map */
  .map {
    height: calc(100dvh - 66px);
    border-radius: 0;
    border: none;
    min-height: unset;
  }
  .map--add-mode {
    box-shadow: none;
  }

  /* Bottom sheet panel */
  .panel {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 1000;
    border-radius: 24px 24px 0 0;
    border-bottom: none;
    max-height: 82vh;
    overflow-y: auto;
    box-shadow: 0 -6px 40px rgba(0, 0, 0, 0.18);
    background: var(--color-surface-blur);
    backdrop-filter: var(--blur);
    -webkit-backdrop-filter: var(--blur);
    padding-bottom: calc(20px + var(--safe-bottom));
    gap: 12px;
    top: unset;
  }

  /* Drag handle */
  .grabber {
    display: block;
    width: 36px;
    height: 5px;
    border-radius: var(--radius-pill);
    background: rgba(60, 60, 67, 0.30);
    margin: 8px auto 4px;
    flex-shrink: 0;
  }

  /* Bottom sheet slide-up with spring */
  .panel-slide-enter-active,
  .panel-slide-leave-active {
    transition: opacity 0.28s var(--ease-out), transform 0.35s var(--spring);
  }
  .panel-slide-enter-from,
  .panel-slide-leave-to {
    opacity: 0;
    transform: translateY(100%);
  }
}

/* ── Dark mode adjustments for popup ─────────── */
@media (prefers-color-scheme: dark) {
  :global(.ios-popup .leaflet-popup-content-wrapper) {
    background: #1c1c1e;
  }
  :global(.popup-name) {
    color: #fff;
  }
  :global(.popup-notes) {
    color: rgba(255, 255, 255, 0.55);
  }
  :global(.popup-badge--access) {
    background: rgba(0, 122, 255, 0.20);
  }
  :global(.popup-badge--neutral) {
    background: rgba(175, 82, 222, 0.20);
  }
  :global(.popup-star) {
    color: rgba(255, 255, 255, 0.20);
  }
  :global(.popup-rating-label) {
    color: rgba(255, 255, 255, 0.45);
  }
}
</style>
