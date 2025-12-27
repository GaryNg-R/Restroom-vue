const API_BASE = "http://localhost:8787/api";

export async function fetchRestroomsByBounds(bounds) {
  const url = new URL(`${API_BASE}/restrooms`);

  if (bounds) {
    url.searchParams.set("minLat", String(bounds.getSouth()));
    url.searchParams.set("maxLat", String(bounds.getNorth()));
    url.searchParams.set("minLng", String(bounds.getWest()));
    url.searchParams.set("maxLng", String(bounds.getEast()));
  }

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Failed to fetch restrooms");
  return await res.json();
}

export async function createRestroom(payload) {
  const res = await fetch(`${API_BASE}/restrooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to create restroom");
  }

  return await res.json();
}
