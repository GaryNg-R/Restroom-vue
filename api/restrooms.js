import fs from "fs";
import path from "path";

export default function handler(req, res) {
  if (req.method === "GET") {
    const filePath = path.join(process.cwd(), "data", "restrooms.json");
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

    return res.status(200).json(data);
  }

  res.status(405).json({ error: "Method not allowed" });
}
