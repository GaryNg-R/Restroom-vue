import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { restroomId, stars } = req.body ?? {};

  if (!restroomId || typeof restroomId !== "string" || restroomId.trim() === "") {
    return res.status(400).json({ error: "restroomId is required" });
  }

  const starsInt = Number(stars);
  if (!Number.isInteger(starsInt) || starsInt < 1 || starsInt > 5) {
    return res.status(400).json({ error: "stars must be an integer between 1 and 5" });
  }

  // Pre-check that the restroom exists (returns clean 404 rather than leaking FK error)
  const { data: existing, error: lookupError } = await supabase
    .from("restrooms")
    .select("id")
    .eq("id", restroomId.trim())
    .maybeSingle();

  if (lookupError) {
    console.error("[ratings] restroom lookup error:", lookupError);
    return res.status(500).json({ error: "Something went wrong" });
  }

  if (!existing) {
    return res.status(404).json({ error: "Restroom not found" });
  }

  const { data, error } = await supabase.rpc("submit_rating", {
    p_restroom_id: restroomId.trim(),
    p_stars: starsInt,
  });

  if (error) {
    console.error("[ratings] submit_rating RPC error:", error);
    return res.status(500).json({ error: "Something went wrong" });
  }

  const row = Array.isArray(data) ? data[0] : data;

  return res.status(200).json({
    avgRating: Number(row?.new_avg_rating ?? 0),
    ratingCount: Number(row?.new_rating_count ?? 0),
  });
}
