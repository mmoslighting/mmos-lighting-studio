# MMOS V4 — Hybrid AI + Manual Professional Lighting Engine

## What this build does
- Preserves the MMOS dark/gold interface and eight lighting presets.
- Adds manual controls for key-light direction, power, softness, light color, exposure, contrast, saturation, and warmth.
- Applies EXIF auto-orientation before processing.
- Shows original and processed previews side by side.
- Exports a high-quality JPG at the oriented source pixel dimensions.
- Exposes MCP prompt/preset tools.
- Adds a ComfyUI connectivity status bridge.

## Important capability boundary
The local manual engine applies global color adjustments and a broad directional light wash. It is **not** semantic/subject-aware AI relighting: it does not segment people, understand face geometry, or create physically accurate cast shadows. The ComfyUI panel only checks whether the ComfyUI server is reachable. A compatible relighting workflow/model and workflow-to-API mapping must still be installed and tested before automated AI relighting is enabled.

No API key is required for local manual mode. GPU inference or hosted image APIs may incur costs.

## Requirements
- Node.js 20+ (Node 22 recommended)
- npm

## Install and run
```bash
cp .env.example .env
npm install
npm run typecheck
npm run dev
```
Open http://localhost:8787

## ComfyUI bridge
Set `COMFYUI_URL` to the ComfyUI server reachable from the same machine as MMOS. Set `COMFYUI_ENABLED=true` only when ready to test. The `/api/ai-status` endpoint checks `/system_stats`. This version does not submit a relighting workflow automatically; workflow mapping is the next integration milestone.

## MCP
Endpoint: `/mcp`. For remote ChatGPT app use, deploy behind HTTPS and configure access controls. Do not expose an unauthenticated local service publicly.

## Security
- Keep `.env` private.
- Add authentication, rate limiting, CSRF protection, storage retention/deletion, and consent handling before public multi-user deployment.
- Do not upload client wedding photos to third-party AI providers without appropriate consent.
