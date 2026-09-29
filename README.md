# Video Property

Turns 6 to 8 photos of a property into a ~25 second promotional video (9:16, 16:9 or 1:1), ready for Instagram Reels, TikTok or a listing page.

Each photo becomes a scene. By default the stills are animated inside [Remotion](https://www.remotion.dev/) with a slow zoom and pan, which is free and runs offline. Optionally, scenes can be sent to the [Runway API](https://docs.dev.runwayml.com/) to become real camera-motion clips, with a planner and a spend guard so no credits are used by accident.

> **Status:** prototype. The pipeline works end to end, but the AI video models were not reliable enough at keeping the real room intact, so it was not taken further.

## How it works

```
jobs/<name>/input.json ──► plan.ts ──► what Runway would receive, and what it costs (no network)
        │
        ▼
     make.ts ──► runway.ts (optional, --runway) ──► jobs/<name>/clips/
        │
        ▼
  Remotion composition (src/remotion) ──► jobs/<name>/out/final_9x16.mp4 + thumbnail
```

- **`input.json` is the storyboard:** scene order, seconds per scene, captions, a motion prompt per photo, and which scenes may use AI.
- **`npm run plan`** prints every clip that would be generated (first frame, last frame, model, prompt, credits) and writes the exact cropped frames that would be uploaded. It does not import the generating code, so it cannot spend credits.
- **`npm run make -- ... --runway`** refuses to run unless `--approve <credits>` matches the total that `plan` printed.
- **Generated clips are cached** under `jobs/<name>/clips/`, keyed by photo, last frame and format. Re-rendering never pays twice.
- **Every prompt ends with a "preserve the real property" instruction** (no added furniture, no warped walls), because the video has to show the real place.

## Quick start (no API keys needed)

Requirements: Node.js 20.12+, and `ffmpeg` / `ffprobe` on your PATH.

```bash
npm install
npm run placeholders                      # fills jobs/demo/photos with gradient stand-ins
npm run make -- jobs/demo --preview       # 7.5s watermarked preview
npm run make -- jobs/demo                 # full video
```

The output goes to `jobs/demo/out/`.

## Using your own photos

1. Create a job folder, for example `jobs/my-apartment/`, and copy `jobs/demo/input.json` into it.
2. Put your photos in `jobs/my-apartment/photos/`. Landscape or portrait both work; each one is cropped to the output format.
3. Edit `input.json`:
   - `property_name`, `location`, `cta` and `cta_sub` for the on-screen text, or `"text": false` for footage only.
   - `format`: `9:16`, `16:9` or `1:1`.
   - `style`: use `"walkthrough"` to make each clip end on the next photo, like walking through the place.
   - One entry in `scenes` per photo, in the order you want them. Each entry takes `photo` (path relative to the job folder), `role` (`hero`, `living_room`, `bedroom`, `kitchen`, `bathroom`, `pool`, `balcony`, `view`, `exterior`, `other`, `cta`), `seconds` and an optional short `caption`.
4. Render:

```bash
npm run make -- jobs/my-apartment --preview
npm run make -- jobs/my-apartment --format 16:9
```

Photos, clips and renders are gitignored (`jobs/*/photos/`, `jobs/*/clips/`, `jobs/*/out/`), so your pictures never end up in the repository.

### Optional: logo and music

- **Logo:** put a PNG in the job folder and set `"logo": "logo.png"`.
- **Music:** drop an `.mp3` you have a commercial license for into `assets/music/<category>/` (for example `assets/music/modern/`) and set `"music_category": "modern"`.

## Optional: AI camera motion with Runway

1. Copy `.env.example` to `.env` and set `RUNWAY_API_KEY`.
2. For each scene you want animated, write a `motion_prompt` describing the camera move. Mark scenes with `"ai": false` to keep them as free Remotion zooms, or `"premium": true` to use `RUNWAY_PREMIUM_MODEL`.
3. Check the plan and the cost, then generate:

```bash
npm run plan -- jobs/my-apartment
npm run make -- jobs/my-apartment --runway --approve <credits printed by plan>
```

## Commands

| Command | What it does |
| --- | --- |
| `npm run make -- <job>` | Render the full video |
| `npm run make -- <job> --preview` | Render a 7.5s watermarked preview |
| `npm run make -- <job> --format 16:9` | Override the aspect ratio |
| `npm run plan -- <job>` | Show what Runway would receive and cost, without calling it |
| `npm run make -- <job> --runway --approve N` | Generate missing Runway clips, then render |
| `npm run placeholders` | Create stand-in photos for `jobs/demo` |
| `npm run studio` | Open the Remotion visual editor |
| `npm run typecheck` | Type-check the project |

## Stack

TypeScript, React, Remotion 4, ffmpeg, Runway API (`image_to_video`).
