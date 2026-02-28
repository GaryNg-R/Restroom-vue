<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";
import L from "leaflet";
import { fetchRestroomsByBounds, createRestroom } from "../api/restroomsApi";

const mapEl = ref(null);
let map = null;
let markersLayer = null;
let pendingMarker = null;

const restrooms = ref([]);

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

function renderMarkers() {
  if (!markersLayer) return;
  markersLayer.clearLayers();

  for (const r of restrooms.value) {
    const marker = L.marker([r.lat, r.lng]);
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

    marker.bindPopup(`
      <div class="popup-content">
        <div class="popup-name">${escapeHtml(r.name || "Public Restroom")}</div>
        ${badges ? `<div class="popup-badges">${badges}</div>` : ""}
        ${r.notes ? `<div class="popup-notes">${escapeHtml(r.notes)}</div>` : ""}
      </div>
    `);
    marker.addTo(markersLayer);
  }
}

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
});

onBeforeUnmount(() => {
  if (!map) return;
  map.off("click", onMapClick);
  map.off("moveend", loadRestrooms);
  map.remove();
  map = null;
});
</script>

<template>
  <div class="toolbar">
    <button
      class="btn-add"
      :class="{ 'btn-add--cancel': addMode }"
      @click="toggleAddMode"
    >
      <span class="btn-icon">{{ addMode ? "×" : "+" }}</span>
      <span class="btn-label">{{ addMode ? "Cancel" : "Add restroom" }}</span>
    </button>
    <span class="hint">
      <span v-if="addMode" class="hint-icon">i</span>
      {{ addMode ? "Tap on the map to drop a pin" : "Browse restrooms near you" }}
    </span>
  </div>

  <div class="layout">
    <div
      ref="mapEl"
      class="map"
      :class="{ 'map--add-mode': addMode }"
    ></div>

    <transition name="panel-slide">
      <div v-if="formOpen" class="panel">
        <div class="panel-header">
          <h3 class="panel-title">Add restroom</h3>
          <button class="panel-close" @click="clearPending" aria-label="Close">×</button>
        </div>

        <div v-if="formError" class="error-banner">
          &#9888; {{ formError }}
        </div>

        <label class="field">
          <span class="field-label">Name</span>
          <input v-model="newRestroom.name" placeholder="Optional name" />
        </label>

        <div class="field">
          <span class="field-label">Features</span>
          <label class="toggle-label">
            <input type="checkbox" v-model="newRestroom.wheelchair" class="toggle-input" />
            <span class="toggle-track"><span class="toggle-thumb"></span></span>
            <span>Wheelchair accessible</span>
          </label>
          <label class="toggle-label">
            <input type="checkbox" v-model="newRestroom.genderNeutral" class="toggle-input" />
            <span class="toggle-track"><span class="toggle-thumb"></span></span>
            <span>Gender-neutral</span>
          </label>
        </div>

        <label class="field">
          <span class="field-label">Notes</span>
          <textarea
            v-model="newRestroom.notes"
            rows="3"
            placeholder="e.g. inside building lobby"
          />
        </label>

        <div class="coords-chip">
          {{ newRestroom.lat?.toFixed(5) }}, {{ newRestroom.lng?.toFixed(5) }}
        </div>

        <div class="actions">
          <button class="btn-save" @click="saveNewRestroom">Save restroom</button>
          <button class="btn-discard" @click="clearPending">Discard</button>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
/* ── Toolbar ─────────────────────────────────── */
.toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  margin: 14px 0;
  flex-wrap: wrap;
}

.btn-add {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 18px;
  border-radius: var(--radius-md);
  border: none;
  background: var(--color-primary);
  color: #fff;
  font-weight: 600;
  font-size: 0.9375rem;
  white-space: nowrap;
  box-shadow: var(--shadow-sm);
}
.btn-add:hover {
  background: var(--color-primary-hover);
  box-shadow: var(--shadow-md);
}
.btn-add--cancel {
  background: #dc2626;
}
.btn-add--cancel:hover {
  background: #b91c1c;
}

.btn-icon {
  font-size: 1.25rem;
  line-height: 1;
  font-weight: 300;
}

.hint {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.875rem;
  color: var(--color-text-muted);
}
.hint-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--color-primary);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  font-style: normal;
  flex-shrink: 0;
}

/* ── Layout ──────────────────────────────────── */
.layout {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 14px;
  align-items: start;
}

/* ── Map ─────────────────────────────────────── */
.map {
  height: calc(100vh - 130px);
  min-height: 300px;
  width: 100%;
  border-radius: var(--radius-lg);
  overflow: hidden;
  border: 2px solid transparent;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.map--add-mode {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 4px rgba(13, 148, 136, 0.15);
}

/* ── Panel ───────────────────────────────────── */
.panel {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 20px;
  background: var(--color-surface);
  box-shadow: var(--shadow-md);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.panel-title {
  font-size: 1.0625rem;
  font-weight: 700;
  color: var(--color-text);
}
.panel-close {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text-muted);
  font-size: 1.25rem;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}
.panel-close:hover {
  background: var(--color-border);
  color: var(--color-text);
}

/* ── Error banner ────────────────────────────── */
.error-banner {
  padding: 10px 14px;
  border-radius: var(--radius-md);
  background: var(--color-error-bg);
  border: 1px solid var(--color-error-border);
  color: var(--color-error);
  font-size: 0.875rem;
  font-weight: 500;
}

/* ── Form fields ─────────────────────────────── */
.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.field-label {
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}
.field input,
.field textarea {
  width: 100%;
  padding: 9px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  outline: none;
  resize: vertical;
}
.field input:focus,
.field textarea:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.15);
}

/* ── Toggle switch ───────────────────────────── */
.toggle-label {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  font-size: 0.9rem;
  color: var(--color-text);
  user-select: none;
}
.toggle-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}
.toggle-track {
  position: relative;
  width: 38px;
  height: 22px;
  border-radius: 11px;
  background: var(--color-border);
  flex-shrink: 0;
  transition: background 0.2s;
}
.toggle-input:checked + .toggle-track {
  background: var(--color-primary);
}
.toggle-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}
.toggle-input:checked + .toggle-track .toggle-thumb {
  transform: translateX(16px);
}

/* ── Coords chip ─────────────────────────────── */
.coords-chip {
  font-family: ui-monospace, "Cascadia Code", "Menlo", monospace;
  font-size: 0.8125rem;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 6px 10px;
  color: var(--color-text-muted);
}

/* ── Actions ─────────────────────────────────── */
.actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.btn-save {
  width: 100%;
  padding: 11px;
  border-radius: var(--radius-md);
  border: none;
  background: var(--color-primary);
  color: #fff;
  font-size: 0.9375rem;
  font-weight: 600;
}
.btn-save:hover {
  background: var(--color-primary-hover);
}
.btn-discard {
  width: 100%;
  padding: 9px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text-muted);
  font-size: 0.9rem;
}
.btn-discard:hover {
  background: var(--color-bg);
  color: var(--color-text);
}

/* ── Panel slide transition ──────────────────── */
.panel-slide-enter-active,
.panel-slide-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}
.panel-slide-enter-from,
.panel-slide-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

/* ── Leaflet popup styles ────────────────────── */
:global(.popup-content) {
  font-family: system-ui, sans-serif;
  min-width: 160px;
}
:global(.popup-name) {
  font-weight: 700;
  font-size: 1rem;
  margin-bottom: 6px;
  color: #0f172a;
}
:global(.popup-badges) {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 6px;
}
:global(.popup-badge) {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
}
:global(.popup-badge--access) {
  background: #ccfbf1;
  color: #0f766e;
}
:global(.popup-badge--neutral) {
  background: #dbeafe;
  color: #1d4ed8;
}
:global(.popup-notes) {
  font-size: 0.875rem;
  color: #64748b;
  font-style: italic;
  margin-top: 4px;
}

/* ── Mobile (≤ 768px) ────────────────────────── */
@media (max-width: 768px) {
  .toolbar {
    position: fixed;
    bottom: 24px;
    right: 20px;
    z-index: 999;
    margin: 0;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
  }

  .hint {
    display: none;
  }

  .btn-add {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    padding: 0;
    justify-content: center;
    box-shadow: var(--shadow-lg);
  }
  .btn-label {
    display: none;
  }
  .btn-icon {
    font-size: 1.75rem;
  }

  .layout {
    grid-template-columns: 1fr;
  }

  .map {
    height: calc(100vh - 66px);
    border-radius: 0;
    border: none;
    min-height: unset;
  }
  .map--add-mode {
    box-shadow: none;
  }

  .panel {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 1000;
    border-radius: 16px 16px 0 0;
    border-bottom: none;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.15);
  }

  .panel-slide-enter-from,
  .panel-slide-leave-to {
    opacity: 0;
    transform: translateY(100%);
  }
}
</style>
