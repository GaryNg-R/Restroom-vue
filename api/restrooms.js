import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("restrooms")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) return res.status(500).json({ error: error.message });

    const restrooms = data.map((r) => ({
      id: r.id,
      name: r.name,
      lat: r.lat,
      lng: r.lng,
      wheelchair: r.wheelchair,
      genderNeutral: r.gender_neutral,
      notes: r.notes,
      createdAt: r.created_at,
    }));

    return res.status(200).json(restrooms);
  }

  if (req.method === "POST") {
    const { name, lat, lng, wheelchair, genderNeutral, notes } = req.body;
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

    if (error) return res.status(500).json({ error: error.message });

    return res.status(201).json({
      id: data.id,
      name: data.name,
      lat: data.lat,
      lng: data.lng,
      wheelchair: data.wheelchair,
      genderNeutral: data.gender_neutral,
      notes: data.notes,
      createdAt: data.created_at,
    });
  }

  res.status(405).json({ error: "Method not allowed" });
}
