import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { presets, type PresetId } from "./presets.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 8787);
const maxMb = Number(process.env.MAX_UPLOAD_MB || 30);
const uploadDir = path.resolve("uploads");
const outputDir = path.resolve("outputs");
await mkdir(uploadDir, { recursive: true });
await mkdir(outputDir, { recursive: true });

app.use(cors({ origin: process.env.CORS_ORIGIN || "*", methods: ["GET", "POST"] }));
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.resolve("public")));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      cb(new Error("Format didukung: JPG, PNG, WEBP."));
      return;
    }
    cb(null, true);
  }
});

type Direction = "center" | "top-left" | "top" | "top-right" | "left" | "right" | "bottom-left" | "bottom" | "bottom-right";
const gradeSchema = z.object({
  preset: z.enum(Object.keys(presets) as [PresetId, ...PresetId[]]).default("direct_flash"),
  intensity: z.enum(["subtle", "medium", "strong"]).default("medium"),
  exposure: z.coerce.number().min(-1).max(1).default(0),
  contrast: z.coerce.number().min(-50).max(50).default(0),
  saturation: z.coerce.number().min(-50).max(50).default(0),
  warmth: z.coerce.number().min(-30).max(30).default(0),
  lightPower: z.coerce.number().min(0).max(100).default(35),
  lightDirection: z.enum(["center","top-left","top","top-right","left","right","bottom-left","bottom","bottom-right"]).default("top-left"),
  softness: z.coerce.number().min(0).max(100).default(70),
  lightColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#fff0dc"),
  preserveColor: z.coerce.boolean().default(true)
});

app.get("/health", (_req, res) => res.json({
  ok: true,
  name: "MMOS V4 Hybrid Lighting Engine",
  version: "4.0.0",
  processing: "manual-directional-light-simulation",
  ai: { enabled: process.env.COMFYUI_ENABLED === "true", provider: "ComfyUI adapter (workflow required)" },
  mcp: "/mcp"
}));
app.get("/api/presets", (_req, res) => res.json(presets));
app.get("/api/ai-status", async (_req, res) => {
  const enabled = process.env.COMFYUI_ENABLED === "true";
  const base = process.env.COMFYUI_URL || "";
  if (!enabled || !base) return res.json({ configured: false, connected: false, message: "AI belum dikonfigurasi. Manual Lighting tetap dapat digunakan." });
  try {
    const r = await fetch(`${base.replace(/\/$/, "")}/system_stats`, { signal: AbortSignal.timeout(2500) });
    res.json({ configured: true, connected: r.ok, message: r.ok ? "ComfyUI terhubung. Workflow relighting tetap perlu dipasang dan dipetakan." : "ComfyUI merespons dengan status non-OK." });
  } catch {
    res.json({ configured: true, connected: false, message: "ComfyUI belum dapat dijangkau dari komputer ini." });
  }
});

function buildPrompt(preset: PresetId, intensity: string, direction: string, preservation: string[]) {
  const p = presets[preset];
  const preserve = preservation.length ? preservation.join(", ") : "original composition";
  return [
    `Professionally relight the supplied original photograph in the style of ${p.name}.`,
    p.description,
    `Lighting intensity: ${intensity}. Key light direction: ${direction}.`,
    `ABSOLUTE PRESERVATION: preserve ${preserve}; retain exact identity, facial geometry, expression, gaze, pose, body proportions, clothing, accessories, background objects, architecture, framing and aspect ratio.`,
    "Maintain natural skin texture, realistic light falloff, physically plausible highlights and shadows, no face replacement, no invented objects, no beauty-filter look.",
    "Do not claim pixel-perfect identity preservation; inspect the result before delivery."
  ].join(" ");
}

app.post("/api/recipe", (req, res) => {
  const schema = z.object({
    preset: z.enum(Object.keys(presets) as [PresetId, ...PresetId[]]),
    intensity: z.enum(["subtle", "medium", "strong"]).default("medium"),
    direction: z.string().default("top-left"),
    preservation: z.array(z.string().max(80)).max(12).default(["face identity", "pose", "clothing", "background"])
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  res.json({
    preset: presets[parsed.data.preset].name,
    prompt: buildPrompt(parsed.data.preset, parsed.data.intensity, parsed.data.direction, parsed.data.preservation),
    note: "Prompt ini dapat digunakan pada model image-editing eksternal. Endpoint ini tidak memanggil generator gambar ChatGPT secara otomatis."
  });
});

function hexRgb(hex: string) {
  return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
}
function lightSvg(width: number, height: number, direction: Direction, color: string, power: number, softness: number) {
  const points: Record<Direction, [number, number]> = {
    center: [50, 50], "top-left": [12, 10], top: [50, 0], "top-right": [88, 10],
    left: [0, 50], right: [100, 50], "bottom-left": [12, 90], bottom: [50, 100], "bottom-right": [88, 90]
  };
  const [cx, cy] = points[direction];
  const [r, g, b] = hexRgb(color);
  const opacity = Math.min(0.34, power / 100 * 0.34);
  const radius = 48 + softness * 0.48;
  return Buffer.from(`<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="key" cx="${cx}%" cy="${cy}%" r="${radius}%"><stop offset="0%" stop-color="rgb(${r},${g},${b})" stop-opacity="${opacity}"/><stop offset="48%" stop-color="rgb(${r},${g},${b})" stop-opacity="${opacity * 0.48}"/><stop offset="100%" stop-color="rgb(${r},${g},${b})" stop-opacity="0"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#key)"/></svg>`);
}

// Local manual engine: deterministic global grade + broad directional light wash.
// It is intentionally described as a lighting simulation, not subject-aware AI relighting.
app.post("/api/grade", upload.single("photo"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Unggah satu foto JPG, PNG, atau WEBP." });
  const parsed = gradeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const v = parsed.data;
  const recipe = presets[v.preset].recipe;
  const intensityFactor = v.intensity === "subtle" ? 0.55 : v.intensity === "strong" ? 1.35 : 1;
  const id = randomUUID();
  const out = path.join(outputDir, `${id}.jpg`);

  try {
    // rotate() applies EXIF orientation before pixel operations.
    const input = sharp(req.file.buffer, { limitInputPixels: 40000000 }).rotate();
    const meta = await input.metadata();
    const swapsAxes = !!meta.orientation && [5, 6, 7, 8].includes(meta.orientation);
    const width = swapsAxes ? meta.height : meta.width;
    const height = swapsAxes ? meta.width : meta.height;
    if (!width || !height) throw new Error("Dimensi foto tidak dapat dibaca.");

    const brightness = Math.max(0.5, Math.min(1.5, recipe.brightness + v.exposure / 2));
    const saturation = Math.max(0.5, Math.min(1.5, recipe.saturation * (1 + v.saturation / 100)));
    const contrast = Math.max(0.5, Math.min(1.6, recipe.contrast * (1 + v.contrast / 100)));
    const warmth = recipe.warmth + v.warmth;
    const warmMatrix = [
      [1 + warmth * 0.0015, 0, 0],
      [0, 1, 0],
      [0, 0, 1 - warmth * 0.0015],
    ];

    let pipeline = input
      .modulate({ brightness, saturation })
      .linear(contrast, 128 * (1 - contrast))
      .recomb(warmMatrix);

    if (v.lightPower > 0) {
      pipeline = pipeline.composite([{
        input: lightSvg(width, height, v.lightDirection, v.lightColor, v.lightPower * intensityFactor, v.softness),
        blend: "soft-light"
      }]);
    }

    await pipeline.jpeg({ quality: 96, mozjpeg: true }).toFile(out);
    res.json({
      ok: true,
      output: `${process.env.PUBLIC_BASE_URL || `http://localhost:${port}`}/outputs/${id}.jpg`,
      width, height,
      note: "Local Manual Lighting selesai: color grade dan simulasi wash cahaya arah luas diterapkan. Ini bukan AI subject-aware relighting; cahaya tidak dipisahkan dari wajah, pakaian, atau latar."
    });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Gagal memproses foto." });
  }
});
app.use("/outputs", express.static(outputDir, { maxAge: "1h", index: false }));

app.post("/mcp", async (req, res) => {
  const server = new McpServer({ name: "mmos-v4-hybrid-lighting-engine", version: "4.0.0" });
  server.tool("mmos_list_lighting_presets", "List MMOS V4 professional lighting presets.", {},
    async () => ({ content: [{ type: "text", text: JSON.stringify(presets, null, 2) }] }));
  server.tool("mmos_build_lighting_prompt", "Build a strict-preservation relighting prompt. It returns a prompt and does not itself edit the image.", {
    preset: z.enum(Object.keys(presets) as [PresetId, ...PresetId[]]),
    intensity: z.enum(["subtle", "medium", "strong"]).default("medium"),
    direction: z.string().default("top-left"),
    preserve_face: z.boolean().default(true),
    preserve_clothing: z.boolean().default(true),
    preserve_background: z.boolean().default(true)
  }, async ({ preset, intensity, direction, preserve_face, preserve_clothing, preserve_background }) => {
    const keep = [
      ...(preserve_face ? ["face identity and facial geometry"] : []), "pose and body proportions",
      ...(preserve_clothing ? ["clothing and accessories"] : []),
      ...(preserve_background ? ["background, objects and architecture"] : []), "camera angle, framing and aspect ratio"
    ];
    return { content: [{ type: "text", text: buildPrompt(preset, intensity, direction, keep) }] };
  });
  server.tool("mmos_manual_grade_info", "Explain local manual lighting capability and AI bridge status.", {},
    async () => ({ content: [{ type: "text", text: "MMOS V4 provides local global grading and broad directional light simulation. AI subject-aware relighting requires a compatible configured ComfyUI workflow or external image model; it is not enabled by default." }] }));
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => { void transport.close(); void server.close(); });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("MCP error", error);
    if (!res.headersSent) res.status(500).json({ error: "MCP request failed" });
  }
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = err instanceof Error ? err.message : "Permintaan gagal.";
  res.status(400).json({ error: message });
});

app.listen(port, () => console.log(`MMOS V4 Hybrid Lighting Engine running at http://localhost:${port} (MCP: /mcp)`));
