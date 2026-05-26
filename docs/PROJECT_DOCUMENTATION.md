# Project Documentation

## 1) Goal

This app loads a Star Citizen keybinding XML file and visualizes joystick/throttle bindings on top of device images.

Core requirements implemented:
- Upload XML from UI
- Parse `js1/js2/js3` bindings
- User selects which `js` is throttle and which is joystick
- Display throttle on the left and joystick on the right
- Show binding tooltips attached to controls
- Offer multiple image angles

## 2) Current Architecture

### Frontend stack
- React + Vite + TypeScript

### Main files
- `src/App.tsx`
  - Upload flow
  - Profile parsing orchestration
  - `js -> device type` assignment
  - Left/right rendering
  - Hotspot editor integration
- `src/lib/bindings.ts`
  - XML parser
  - `jsX_...` input extraction
  - Human-readable English labels (category + action + control)
- `src/lib/hotspots.ts`
  - LocalStorage persistence for hotspot overrides
  - CRUD helpers for per-angle hotspots
- `src/data/deviceProfiles.ts`
  - Device angle definitions
  - Default hotspot coordinates (seed values)
- `src/types.ts`
  - Shared type definitions

## 3) Data Flow

1. User uploads XML (`input[type=file]`)
2. XML text parsed with `DOMParser`
3. Each `<actionmap>/<action>/<rebind input="...">` is scanned
4. Only inputs matching `jsN_*` are retained
5. For each binding we store:
   - action map name + readable label
   - action name + readable label
   - joystick id (`N`)
   - control key (`button12`, `x`, `slider1`, etc.)
6. User assigns each `jsN` as `Throttle`, `Joystick`, or `Not displayed`
7. Bindings are rendered onto selected device images through hotspots

## 4) Hotspots & Editing

Hotspots are resolved as:
- `angle defaults` from `src/data/deviceProfiles.ts`
- overridden by user-edited values from LocalStorage

Storage key:
- `hotas-viewer.hotspots.v1`

Per-angle key format:
- `throttle:<angleId>`
- `joystick:<angleId>`

Editor mode:
- Enable editor from assignment panel
- Select a control in the control list
- Click the image to place/move the hotspot
- Remove selected hotspot or reset current angle overrides

## 5) Assets Pipeline

Script:
- `scripts/prepare_assets.py`

Input (ignored in git):
- `sourcefiles/`

Outputs (versioned, app runtime):
- `public/assets/devices/throttle/throttle-main.png`
- `public/assets/devices/joystick/joystick-main.png`
- additional angle references in `public/assets/devices/**`

Current method:
- Automatic background removal from white background source image
- Crop + alpha generation

## 6) UI Notes

- Mobile + desktop responsive layout
- Left panel = throttle, right panel = joystick (when assigned)
- Tooltips contain readable action labels in English
- Unmapped controls are clearly listed so placement can be completed in editor

## 7) Known Limitations

- Default hotspot positions are starter values, not full manufacturer-accurate mapping
- Some additional angle images include printed callouts/text in source marketing visuals
- If XML includes unusual input patterns, normalization may need extension

## 8) Deployment (GitHub Pages)

The project includes a Pages workflow:
- `.github/workflows/deploy-pages.yml`

Build strategy:
- Vite build output from `npm run build`
- Artifact upload from `dist/`
- GitHub Pages deploy action

Base path handling:
- `vite.config.ts` reads `process.env.VITE_BASE_PATH` and defaults to `/`
- CI sets `VITE_BASE_PATH=/<repo-name>/` for project pages URLs

Manual setup on GitHub:
1. Open repository settings
2. Go to `Pages`
3. Set source to `GitHub Actions`
4. Push to `main` (or rerun workflow manually)

## 9) Maintenance Rule

After each functional change:
1. Update this documentation file in the same commit
2. Mention new commands/files/state keys if any
3. Run `npm run lint` and `npm run build`

## 10) Change Log

### 2026-05-26

- Bootstrapped project in React + Vite + TypeScript
- Implemented XML upload and parser for `jsN_*` bindings
- Added joystick assignment UI (`Throttle` / `Joystick` / `Not displayed`)
- Added dual device render area with angle switcher
- Added binding hotspots with tooltip display
- Added hotspot editor and LocalStorage persistence
- Added asset generation script for cutouts and reference angles
- Added/updated project documentation and README
- Added GitHub Pages deployment workflow
- Added Vite base path env support for project-pages URLs
