import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;

// Edit passcode. Set EDIT_CODE in Render environment. Falls back to a default for local dev.
const EDIT_CODE = process.env.EDIT_CODE || "adam2026";

// --- Storage ---
// Preferred (durable + free): Upstash Redis REST. Set these two env vars on Render and the
// plan is stored in Redis, surviving restarts, sleeps and redeploys.
// Trim stray spaces/quotes and any trailing slash that break the REST call.
const UPSTASH_URL = (process.env.UPSTASH_REDIS_REST_URL || "").trim().replace(/^["']|["']$/g, "").replace(/\/+$/, "");
const UPSTASH_TOKEN = (process.env.UPSTASH_REDIS_REST_TOKEN || "").trim().replace(/^["']|["']$/g, "");
const useRedis = Boolean(UPSTASH_URL && UPSTASH_TOKEN);
const REDIS_KEY = "adam_summer_plan";

if (useRedis && !/^https:\/\/.+\.upstash\.io$/i.test(UPSTASH_URL)) {
  console.warn("WARNING: UPSTASH_REDIS_REST_URL should look like https://xxxx.upstash.io — got:", UPSTASH_URL);
}

// Fallback (local dev / paid instance with a disk): a JSON file.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "plan.json");
if (!useRedis) fs.mkdirSync(DATA_DIR, { recursive: true });

const EMPTY_PLAN = { people: [], days: {}, updatedAt: null };

function normalize(p) {
  return {
    people: Array.isArray(p.people) ? p.people : [],
    days: p.days && typeof p.days === "object" ? p.days : {},
    updatedAt: p.updatedAt || null,
  };
}

async function redisCmd(cmd) {
  const r = await fetch(UPSTASH_URL, {
    method: "POST",
    headers: { Authorization: "Bearer " + UPSTASH_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  const text = await r.text();
  if (!r.ok) {
    // 401 = wrong/expired token · 403 = read-only token (can't SET) · 404 = wrong URL
    throw new Error("Upstash HTTP " + r.status + " — " + text.slice(0, 180));
  }
  let j;
  try { j = JSON.parse(text); } catch { throw new Error("Upstash returned non-JSON: " + text.slice(0, 120)); }
  if (j && j.error) throw new Error("Upstash: " + j.error);
  return j ? j.result : null;
}

async function readPlan() {
  if (useRedis) {
    const val = await redisCmd(["GET", REDIS_KEY]);
    if (!val) return { ...EMPTY_PLAN };
    try { return normalize(JSON.parse(val)); } catch { return { ...EMPTY_PLAN }; }
  }
  try { return normalize(JSON.parse(fs.readFileSync(DATA_FILE, "utf8"))); }
  catch { return { ...EMPTY_PLAN }; }
}

async function writePlan(plan) {
  const toSave = { ...normalize(plan), updatedAt: new Date().toISOString() };
  if (useRedis) await redisCmd(["SET", REDIS_KEY, JSON.stringify(toSave)]);
  else fs.writeFileSync(DATA_FILE, JSON.stringify(toSave, null, 2));
  return toSave;
}

app.use(express.json({ limit: "256kb" }));
app.use(express.static(path.join(__dirname, "public")));

// Diagnostics: visit /api/health in the browser to see storage mode + whether it works.
app.get("/api/health", async (_req, res) => {
  const info = { storage: useRedis ? "upstash-redis" : "local-file" };
  try { await readPlan(); info.read = "ok"; }
  catch (e) { info.read = "fail"; info.error = String((e && e.message) || e); }
  res.json(info);
});

// Public: anyone with the link can read the plan (read-only for family).
app.get("/api/plan", async (_req, res) => {
  try { res.json(await readPlan()); }
  catch (e) { res.status(500).json({ error: "read_failed", detail: String((e && e.message) || e) }); }
});

// Verify the edit passcode (used to unlock editor mode in the browser).
app.post("/api/verify", (req, res) => {
  const code = (req.body && req.body.code) || "";
  res.json({ ok: code === EDIT_CODE });
});

// Protected: save the plan. Requires the passcode in the x-edit-code header.
app.post("/api/plan", async (req, res) => {
  if ((req.get("x-edit-code") || "") !== EDIT_CODE) {
    return res.status(401).json({ error: "unauthorized" });
  }
  try { res.json(await writePlan(req.body || {})); }
  catch (e) { res.status(500).json({ error: "write_failed", detail: String((e && e.message) || e) }); }
});

app.listen(PORT, () => {
  console.log("Adam summer planner on http://localhost:" + PORT + " · storage: " + (useRedis ? "Upstash Redis" : "local file"));
});
