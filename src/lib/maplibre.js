// MapLibre GL JS with its CSS and web worker. Vite copies the worker file into
// /assets/ (hashed), so it is served by us, cached like the rest of the build.
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';

maplibregl.setWorkerUrl(workerUrl);

export default maplibregl;
