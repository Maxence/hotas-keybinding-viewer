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
  - joystick ids from `<options type="joystick" instance="...">` even if no binding exists
  - Human-readable English labels (category + action + control)
- `src/lib/hotspots.ts`
  - LocalStorage persistence for hotspot overrides
  - LocalStorage persistence for optional per-control direction tags
  - CRUD helpers for per-angle hotspots
- JSON export/import helpers for zone sharing
- `src/data/deviceProfiles.ts`
  - Device angle definitions
  - Default hotspot coordinates (seed values)
- `src/data/defaultZones.ts`
  - Bundled project-wide default zone overrides
- `src/data/defaultZoneDirections.ts`
  - Bundled project-wide default direction tags (`center/up/down/left/right`)
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
- `hotas-viewer.zone-directions.v1`

Per-angle key format:
- `throttle:<angleId>`
- `joystick:<angleId>`

Editor mode:
- Enable editor from assignment panel
- Select a control in the control list
- Click + drag on image to draw a rectangle zone
- Control list expands with unbound controls for full mapping (buttons, axes, sliders, hat/pov directions)
- Remove selected zone or clear all zones on current angle
- Assign explicit direction tag to selected control (`left/up/right/down/center`)
- Link additional controls to the same zone rectangle for HAT/POV grouping
- Export full zones data as JSON
- Import zones JSON to restore/share a zone set
- Reset local zones to bundled defaults

Zone grouping behavior:
- If multiple controls share identical zone geometry, UI renders one zone box and one tooltip.
- Tooltip lists each linked control with its resolved direction and actions.

Preview mode filtering:
- Multi-select filter menu by parent family (`Spaceship`, `Player`, etc.) and detailed map (`Spaceship Weapons`, etc.)
- Parent selection includes all maps in the family
- `Clear modes` resets the filter
- Filter checkboxes are custom-styled to match HUD theme

Preview callout layout:
- Tooltips are always visible in preview mode (no hover required)
- Each tooltip is connected to its source zone with a line
- Side-aware placement (`left/right/top/bottom`) with distribution by side to reduce overlap

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
- In preview mode, only zones with actions matching selected filters are shown
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

## 9) Star Citizen Device Order Troubleshooting

When joystick/throttle assignments appear swapped in-game because device order changed, use Star Citizen console commands:

1. Open console (`~`)
2. Dump detected devices:
   - `i_DumpDeviceInformation`
3. Swap two joystick binding slots:
   - `pp_resortdevices joystick <slotA> <slotB>`

Meaning:
- `slotA` and `slotB` are joystick slot indexes used by Star Citizen bindings.
- The command swaps bindings between the two slots.

Known official examples:
- `pp_resortdevices joystick 1 2`
- `pp_resortdevices joystick 4 1`
- `pp_resortdevices joystick 5 2`

Note:
- This fixes device order mismatch, not axis inversion. Axis inversion must be adjusted in control options for the selected joystick.

Reference:
- https://support.robertsspaceindustries.com/hc/en-us/articles/360000183328-Create-export-and-import-custom-profiles

## 10) Maintenance Rule

After each functional change:
1. Update this documentation file in the same commit
2. Mention new commands/files/state keys if any
3. Run `npm run lint` and `npm run build`

## 11) Change Log

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
- Added troubleshooting note for swapped joystick order (`i_DumpDeviceInformation` + `pp_resortdevices`)
- Added multi-control shared-zone workflow with optional direction tags (`center/up/down/left/right`)
- Added grouped rendering for overlapping zones (one tooltip per physical zone)

### 2026-05-27

- Added joystick discovery from XML `<options>` nodes to keep device slots visible even when not bound
- Added editor control catalog expansion for unbound controls (buttons/axes/sliders/hat/pov)
- Added preview mode filter menu with multi-select parent+child categories and clear action
- Updated direction choice ordering to `left/up/right/down/center` for HAT workflows
- Replaced hover-only tooltips in preview with always-visible perimeter callouts connected by guide lines
- Refined preview filter UI styling for a more integrated dark HUD appearance
