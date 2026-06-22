import { defineConfig } from "vite";
import reactSwc from "@vitejs/plugin-react-swc";
import reactBabel from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    process.env.VITE_BUILD_BABEL === "1" ? reactBabel() : reactSwc(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  build: {
    sourcemap: false,
    reportCompressedSize: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
