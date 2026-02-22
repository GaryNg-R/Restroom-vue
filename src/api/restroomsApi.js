//const API_BASE = import.meta.env.VITE_API_BASE_URL;

export async function fetchRestroomsByBounds(bounds) {
  const params = new URLSearchParams();

  if (bounds) {
    params.set("minLat", String(bounds.getSouth()));
    params.set("maxLat", String(bounds.getNorth()));
    params.set("minLng", String(bounds.getWest()));
    params.set("maxLng", String(bounds.getEast()));
  }

  const queryString = params.toString();
  const url = queryString ? `/api/restrooms?${queryString}` : `/api/restrooms`;

  const res = await fetch(url);

  if (!res.ok) throw new Error("Failed to fetch restrooms");

  return await res.json();
}

export async function createRestroom(payload) {
  const res = await fetch(`/api/restrooms`, {
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
