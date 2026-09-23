# Medical Imaging — Feasibility Spike

A spike exploring the DICOM-parsing → 3D-rendering pipeline in a browser: synthetic
patient scans are generated as DICOM files, then loaded and rendered as interactive
3D volumes in an Angular app.

## Structure

- `scripts/generate_synthetic_dicom.py` — generates synthetic DICOM data for 10
  patients (sphere/box/cylinder volumes) using Python, pydicom and numpy.
- `test-data/` — the generated DICOM output (already committed, one folder per patient
  plus a `manifest.json`).
- `imaging-viewer/` — an Angular 22 app that lists patients and renders their volumes
  as interactive 3D scans (orbit/zoom/pan).

## Tech stack

**DICOM parsing & loading**
- [`dicom-parser`](https://github.com/cornerstonejs/dicomParser) — parses the raw
  DICOM binary format (tags, metadata, pixel data).
- [`@cornerstonejs/dicom-image-loader`](https://www.cornerstonejs.org/) — decodes
  DICOM pixel data (incl. compressed transfer syntaxes) for rendering.

**3D rendering**
- [`@cornerstonejs/core`](https://www.cornerstonejs.org/) — rendering engine:
  viewports, cameras, GPU-based rendering of slices and volumes.
- [`@cornerstonejs/tools`](https://www.cornerstonejs.org/) — interaction layer:
  window/level, zoom/pan/rotate, measurement and annotation tools.
- [`@cornerstonejs/metadata`](https://www.cornerstonejs.org/) — metadata provider
  (patient/study/series info, orientation/spacing) used to position volumes correctly.
- [`@kitware/vtk.js`](https://kitware.github.io/vtk-js/) — the underlying WebGL
  visualization engine (JS port of the VTK toolkit) that Cornerstone3D uses for actual
  3D volume rendering, ray casting and camera controls.

**Supporting math/utilities**
- `gl-matrix` — vector/matrix math for 3D transforms and camera positioning.
- `d3-array`, `d3-interpolate` — array stats and value interpolation used internally
  by vtk.js/Cornerstone (e.g. color/transfer functions).
- `events` — browser polyfill for Node's `EventEmitter`, needed by some of the above.

**App shell**
- Angular 22 (standalone components, signals) + Angular Material.
- Build via `ng serve`/`ng build` (esbuild/Vite dev server).
- `patch-package` applies committed patches so Cornerstone3D/vtk.js work correctly
  under Angular's esbuild dev server, plus a worker pre-bundling step
  (`scripts/build-cornerstone-worker.mjs`) needed for the Cornerstone web worker.

## Getting started

```bash
cd imaging-viewer
npm install     # also applies patch-package patches via postinstall
npm start       # pre-bundles the Cornerstone worker, then runs `ng serve`
```

Open http://localhost:4200/. Use `npm start` rather than `ng serve` directly — it
runs the worker pre-bundling step the app depends on.

### Regenerating test data

```bash
python scripts/generate_synthetic_dicom.py
```

See `imaging-viewer/README.md` for the standard Angular CLI commands (build, test, etc).
