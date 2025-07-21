import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
import path from "path";

const isWatchMode = process.argv.includes("--watch");

export default defineConfig({
  plugins: [
    viteStaticCopy({
      targets: [{ src: "manifest.json", dest: "." }],
    }),
    viteStaticCopy({
      targets: [{ src: "styles.css", dest: "." }],
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@assets": path.resolve(__dirname, "./assets"),
    },
  },
  build: {
    watch: isWatchMode ? {} : undefined,
    minify: !isWatchMode,
    sourcemap: !isWatchMode,
    outDir: "dist",
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: path.resolve(__dirname, "src/main.ts"),
      formats: ["cjs"], // Obsidian loads CommonJS
      fileName: () => "main.js",
    },
    rollupOptions: {
      external: ["obsidian", "electron"], // don't bundle the host libs
      output: {
        exports: "named",
        assetFileNames: () => "styles.css", // Always output CSS as styles.css
        entryFileNames: "main.js", // Ensure the main entry file is named correctly
      },
    },
  },
  css: {
    modules: false,
  },
});
