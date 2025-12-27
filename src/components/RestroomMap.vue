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
    marker.bindPopup(`
      <b>${escapeHtml(r.name || "Public Restroom")}</b><br/>
      Wheelchair: ${r.wheelchair ? "Yes" : "No"}<br/>
      Gender-neutral: ${r.genderNeutral ? "Yes" : "No"}<br/>
      ${
        r.notes
          ? `<div style="margin-top:6px;">${escapeHtml(r.notes)}</div>`
          : ""
      }
    `);
    marker.addTo(markersLayer);
  }
}

function toggleAddMode() {
  addMode.value = !addMode.value;
  if (!addMode.value) clearPending();
}

function clearPending() {
  if (pendingMarker) {
    pendingMarker.remove();
    pendingMarker = null;
  }
  formOpen.value = false;
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
  formOpen.value = true;
}

async function loadRestrooms() {
  if (!map) return;
  restrooms.value = await fetchRestroomsByBounds(map.getBounds());
  renderMarkers();
}

async function saveNewRestroom() {
  if (newRestroom.value.lat == null || newRestroom.value.lng == null) return;

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
    clearPending();
    await loadRestrooms();
  } catch (e) {
    alert(e?.message || "Failed to save restroom");
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
    <button class="btn" @click="toggleAddMode">
      {{ addMode ? "Cancel add" : "Add restroom" }}
    </button>
    <span class="hint">
      {{ addMode ? "Click on the map to drop a pin" : "Browse restrooms" }}
    </span>
  </div>

  <div class="layout">
    <div ref="mapEl" class="map"></div>

    <div v-if="formOpen" class="panel">
      <h3>Add restroom</h3>

      <label class="field">
        Name
        <input v-model="newRestroom.name" placeholder="Optional name" />
      </label>

      <label class="check">
        <input type="checkbox" v-model="newRestroom.wheelchair" />
        Wheelchair accessible
      </label>

      <label class="check">
        <input type="checkbox" v-model="newRestroom.genderNeutral" />
        Gender-neutral
      </label>

      <label class="field">
        Notes
        <textarea
          v-model="newRestroom.notes"
          rows="4"
          placeholder="e.g. inside building lobby"
        />
      </label>

      <div class="coords">
        Lat: {{ newRestroom.lat?.toFixed(5) }}<br />
        Lng: {{ newRestroom.lng?.toFixed(5) }}
      </div>

      <div class="actions">
        <button class="btn primary" @click="saveNewRestroom">Save</button>
        <button class="btn" @click="clearPending">Discard</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  margin: 12px 0;
}

.hint {
  opacity: 0.8;
  font-size: 14px;
}

.layout {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 12px;
}

.map {
  height: 72vh;
  width: 100%;
  border-radius: 12px;
  overflow: hidden;
}

.panel {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.18);
}

.field {
  display: grid;
  gap: 6px;
  margin: 10px 0;
}

.field input,
.field textarea {
  width: 100%;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(0, 0, 0, 0.2);
  color: inherit;
}

.check {
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 8px 0;
}

.coords {
  margin-top: 10px;
  font-size: 12px;
  opacity: 0.85;
}

.actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.btn {
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(0, 0, 0, 0.25);
  color: inherit;
  cursor: pointer;
}

.btn.primary {
  border-color: rgba(255, 255, 255, 0.25);
  background: rgba(255, 255, 255, 0.12);
}

@media (max-width: 900px) {
  .layout {
    grid-template-columns: 1fr;
  }
  .panel {
    order: -1;
  }
  .map {
    height: 60vh;
  }
}
</style>
