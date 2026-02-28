import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

function validateRestroomBody(body) {
  const { lat, lng, name, notes, wheelchair, genderNeutral } = body ?? {};

  const latNum = Number(lat);
  if (lat == null || isNaN(latNum) || latNum < -90 || latNum > 90) {
    return { error: "lat is required and must be a number between -90 and 90" };
  }

  const lngNum = Number(lng);
  if (lng == null || isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
    return { error: "lng is required and must be a number between -180 and 180" };
  }

  return {
    lat: latNum,
    lng: lngNum,
    name: typeof name === "string" ? name.slice(0, 100) : undefined,
    notes: typeof notes === "string" ? notes.slice(0, 500) : undefined,
    wheelchair,
    genderNeutral,
  };
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("restrooms")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[restrooms] GET error:", error);
      return res.status(500).json({ error: "Something went wrong" });
    }

    const restrooms = data.map((r) => ({
      id: r.id,
      name: r.name,
      lat: r.lat,
      lng: r.lng,
      wheelchair: r.wheelchair,
      genderNeutral: r.gender_neutral,
      notes: r.notes,
      createdAt: r.created_at,
      avgRating: Number(r.avg_rating ?? 0),
      ratingCount: r.rating_count ?? 0,
    }));

    return res.status(200).json(restrooms);
  }

  if (req.method === "POST") {
    const validated = validateRestroomBody(req.body);

    if (validated.error) {
      return res.status(400).json({ error: validated.error });
    }

    const { lat, lng, name, notes, wheelchair, genderNeutral } = validated;

    const newEntry = {
      id: `r_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name,
      lat,
      lng,
      wheelchair,
      gender_neutral: genderNeutral,
      notes,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("restrooms")
      .insert([newEntry])
      .select()
      .single();

    if (error) {
      console.error("[restrooms] POST error:", error);
      return res.status(500).json({ error: "Something went wrong" });
    }

    return res.status(201).json({
      id: data.id,
      name: data.name,
      lat: data.lat,
      lng: data.lng,
      wheelchair: data.wheelchair,
      genderNeutral: data.gender_neutral,
      notes: data.notes,
      createdAt: data.created_at,
      avgRating: Number(data.avg_rating ?? 0),
      ratingCount: data.rating_count ?? 0,
    });
  }

  res.status(405).json({ error: "Method not allowed" });
}
