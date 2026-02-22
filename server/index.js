import Fastify from "fastify";
import cors from "@fastify/cors";
import fs from "node:fs/promises";
import path from "node:path";

const fastify = Fastify({ logger: true });

await fastify.register(cors, {
  origin: ["http://localhost:5173"],
  methods: ["GET", "POST", "OPTIONS"],
});

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "restrooms.json");

async function ensureFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    fs.writeFile(DATA_FILE, "[]", "utf8");
  }
}

async function readAll() {
  await ensureFile();
  const raw = await fs.readFile(DATA_FILE, "utf8");
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

async function writeAll(list) {
  await ensureFile();
  const tmp = DATA_FILE + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(list, null, 2), "utf8");
  await fs.rename(tmp, DATA_FILE);
}

function uid() {
  return (
    "r_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).slice(2, 8)
  );
}

// GET /api/restrooms?minLat=&maxLat=&minLng=&maxLng=
fastify.get("/api/restrooms", async (req) => {
  const list = await readAll();
  const q = req.query || {};

  const minLat = q.minLat !== undefined ? Number(q.minLat) : undefined;
  const maxLat = q.maxLat !== undefined ? Number(q.maxLat) : undefined;
  const minLng = q.minLng !== undefined ? Number(q.minLng) : undefined;
  const maxLng = q.maxLng !== undefined ? Number(q.maxLng) : undefined;

  const hasBounds = [minLat, maxLat, minLng, maxLng].every(
    (v) => v !== undefined && Number.isFinite(v),
  );

  if (!hasBounds) return list;

  return list.filter((r) => {
    return (
      typeof r.lat === "number" &&
      typeof r.lng === "number" &&
      r.lat >= minLat &&
      r.lat <= maxLat &&
      r.lng >= minLng &&
      r.lng <= maxLng
    );
  });
});

// POST /api/restrooms
fastify.post("/api/restrooms", async (req, reply) => {
  const b = req.body || {};
  const lat = Number(b.lat);
  const lng = Number(b.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return reply.code(400).send({ error: "lat/lng must be numbers" });
  }

  const item = {
    id: uid(),
    name:
      typeof b.name === "string" && b.name.trim()
        ? b.name.trim()
        : "Public Restroom",
    lat,
    lng,
    wheelchair: !!b.wheelchair,
    genderNeutral: !!b.genderNeutral,
    notes: typeof b.notes === "string" ? b.notes.trim() : "",
    createdAt: new Date().toISOString(),
  };

  const list = await readAll();
  list.push(item);
  await writeAll(list);

  return reply.code(201).send(item);
});

fastify.listen({ host: "0.0.0.0", port: 8787 });
