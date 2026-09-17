#!/usr/bin/env node
// Pre-bundles @cornerstonejs/dicom-image-loader's DICOM decode web worker
// into a single self-contained ESM file under public/, served as a static
// asset. See the comment in node_modules/@cornerstonejs/dicom-image-loader
// /dist/esm/init.js (patched via patches/) for why this is necessary.

import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

await build({
  entryPoints: [
    path.join(
      projectRoot,
      'node_modules/@cornerstonejs/dicom-image-loader/dist/esm/decodeImageFrameWorker.js'
    ),
  ],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  outfile: path.join(projectRoot, 'public/cornerstone-worker/decodeImageFrameWorker.js'),
  external: ['fs', 'path'],
  logLevel: 'info',
});
