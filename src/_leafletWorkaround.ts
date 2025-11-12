// No-op workaround under Deno + CDN setup.
//
// When running this project under Node/npm, the original code imported the
// marker images from the `leaflet` package and adjusted the default icon
// URLs. Under Deno we load the Leaflet CSS from the CDN (see `index.html`),
// and that CSS references marker images hosted on the CDN, so we don't need
// to import local image assets here. Keep this file as a harmless module so
// `import "./_leafletWorkaround.ts"` in `main.ts` continues to work.

export {};
