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
- JSON export/import helpers for zone sharing
- `src/data/deviceProfiles.ts`
  - Device angle definitions
  - Default hotspot coordinates (seed values)
- `src/data/defaultZones.ts`
  - Bundled project-wide default zone overrides
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

Zones are resolved as:
- bundled defaults from `src/data/defaultZones.ts`
- overridden by user-edited values from LocalStorage

Storage key:
- `hotas-viewer.zones.v2`

Per-angle key format:
- `throttle:<angleId>`
- `joystick:<angleId>`

Editor mode:
- Enable editor from assignment panel
- Select a control in the control list
- Click + drag on image to draw a rectangle zone
- Remove selected zone or clear all zones on current angle
- Export full zones data as JSON
- Import zones JSON to restore/share a zone set
- Reset local zones to bundled defaults

Legacy migration:
- If `hotas-viewer.zones.v2` is missing, the app tries to migrate old point-based data from `hotas-viewer.hotspots.v1`.

## 5) Assets Pipeline

Script:
- `scripts/prepare_assets.py`

Input (ignored in git):
- `sourcefiles/`
- `sourcefiles/joydesign/` (new primary image source)

Outputs (versioned, app runtime):
- `public/assets/devices/throttle/throttle-front.png`
- `public/assets/devices/throttle/throttle-angled.png`
- `public/assets/devices/throttle/throttle-multi-angle.png`
- `public/assets/devices/joystick/joystick-front.png`
- `public/assets/devices/joystick/joystick-angled.png`
- `public/assets/devices/joystick/joystick-base-top.png`
- `public/assets/devices/joystick/joystick-grip-closeup.png`

Current method:
- Deterministic crop extraction from curated `joydesign` scenes
- Split combined HOTAS images into per-device views for left/right app panels

## 6) UI Notes

- Mobile + desktop responsive layout
- Left panel = throttle, right panel = joystick (when assigned)
- Tooltips contain readable action labels in English
- Unmapped controls are clearly listed so placement can be completed in editor
- Theme is now dark and clean (black/graphite/white) with subtle turquoise accent only

## 7) Known Limitations

- No automatic 3D button detection; precision comes from manual zone drawing by user
- Imported/exported zone payload validation is permissive (unknown map keys are ignored at runtime)
- If XML includes unusual input patterns, normalization may need extension

## 8) Deployment (GitHub Pages)

The project includes a Pages workflow:
- `.github/workflows/deploy-pages.yml`

Build strategy:
- Vite build output from `npm run build`
- Deployment commit to `gh-pages` branch using `peaceiris/actions-gh-pages`

Base path handling:
- `vite.config.ts` reads `process.env.VITE_BASE_PATH` and defaults to `/`
- CI sets `VITE_BASE_PATH=/<repo-name>/` for project pages URLs
- Device image paths in app data are resolved from `import.meta.env.BASE_URL` to avoid GitHub Pages 404s

Manual setup on GitHub:
1. Open repository settings
2. Go to `Pages`
3. Set source to `Deploy from a branch`
4. Select `gh-pages` and folder `/(root)`
5. Push to `main` (or rerun workflow manually)

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
- Switched Pages deployment strategy to `gh-pages` branch publication for easier bootstrap
- Fixed static image path resolution for project-pages subpath deployments
- Reworked UI skin to dark space/HUD visual style
- Replaced app visual assets with `joydesign` image set and new angle crops
- Tuned UI to a cleaner dark palette with less blue dominance
- Replaced point editor with rectangle-based per-button zone editor
- Fixed editor interaction: image dragging is now disabled in editor mode to allow click-drag zone drawing
- Hardened drag prevention (`dragstart` blocked on canvas/image) and editor hint when no control is selected
- Switched drawing engine to pointer events + pointer capture and auto-fallback to first control key
- Added zone data toolbox (export/import/reset) to persist and share manual mappings
- Added bundled default zones entrypoint (`src/data/defaultZones.ts`) merged with local overrides
