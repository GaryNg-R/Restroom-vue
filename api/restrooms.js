import fs from "fs";
import path from "path";

export default function handler(req, res) {
  const filePath = path.join(process.cwd(), "data", "restrooms.json");

  if (req.method === "GET") {
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return res.status(200).json(data);
  }

  if (req.method === "POST") {
    const existing = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const newEntry = {
      id: `r_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      ...req.body,
      createdAt: new Date().toISOString(),
    };
    existing.push(newEntry);
    // Note: writes are ephemeral on Vercel (filesystem is read-only after deploy).
    // For persistent storage, replace this with a database (e.g. Supabase, PlanetScale).
    try {
      fs.writeFileSync(filePath, JSON.stringify(existing, null, 2));
    } catch {
      // Silently ignore write failures on read-only filesystem
    }
    return res.status(201).json(newEntry);
  }

  res.status(405).json({ error: "Method not allowed" });
}
