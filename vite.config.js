import { defineConfig, searchForWorkspaceRoot } from "vite";

// See canvas-recorder-lib's README, "Notes for a project that uses this library".
export default defineConfig({
  // Relative paths so the build works from GitHub Pages or any subdirectory.
  base: "./",
  build: {
    // If something fails in production, it should still be debuggable.
    sourcemap: "inline",
    chunkSizeWarningLimit: 5000,
    target: "esnext",
    rolldownOptions: {
      output: {
        // The Visual Editor writes TypeScript that names each component's class (the "Sync diffs"
        // file, and properties/*.txt).  Without this, minifying turns those names into "hi" and "Nr".
        keepNames: true,
      },
    },
  },
  resolve: {
    // This project and canvas-recorder-lib both use phil-lib.  Make sure there's only one copy.
    dedupe: ["phil-lib"],
  },
  optimizeDeps: {
    // Only the transcription worker imports this, and Vite doesn't look inside workers at startup.
    // Without this line, the first Import audio (or the first transcript) makes the dev server
    // find it, prepare it, and reload the page.  `npm run dev` only; builds aren't affected.
    include: ["canvas-recorder-lib > @huggingface/transformers"],
  },
  server: {
    // Always the same port.  The video editor saves its work in the browser (IndexedDB),
    // and the browser keeps a separate copy for each port.  See canvas-recorder-lib's README, "Ports".
    port: 5178,
    strictPort: true,
    fs: {
      // Only matters after `npm link ../canvas-recorder-lib`.  Then the library lives outside this
      // project, and its transcription worker is loaded by URL, so the folder has to be allowed explicitly.
      // Setting this turns off Vite's default, so this project's own folder has to be listed too.
      allow: [searchForWorkspaceRoot(process.cwd()), "../canvas-recorder-lib"],
    },
  },
});
