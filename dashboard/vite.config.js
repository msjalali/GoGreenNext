import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defineConfig } from 'vite'

// node_modules lives inside a Dropbox-synced folder, and Dropbox holds a lock on
// .vite/deps just long enough that Vite's dep optimizer fails its atomic rename
// (EBUSY) and every request for a pre-bundled dep 504s. Keep the cache outside
// the synced tree.
export default defineConfig({
  cacheDir: join(tmpdir(), 'vite-gogreennext-dashboard'),
  server: { port: 5178, strictPort: true },
  // `npm run build` makes a dist/ that opens by double-clicking index.html, with no
  // server: relative asset paths, and one classic script rather than an ES module,
  // which browsers refuse to load over file://.
  base: './',
  build: {
    rollupOptions: {
      output: {
        format: 'iife',
        entryFileNames: 'assets/dashboard.js',
        assetFileNames: 'assets/[name][extname]'
      }
    }
  },
  plugins: [{
    // Vite always writes <script type="module" crossorigin>; over file:// that is a
    // CORS failure and the page stays blank. The bundle is already an IIFE, so a
    // plain deferred script is all it needs. Build only — dev must stay a module.
    name: 'ggn-classic-script',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml: html =>
      html.replace(/<script type="module" crossorigin src=/g, '<script defer src=')
  }]
})
